import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, "..", "data", "catalog.json"), "utf8"));
const PORT = Number(process.env.PORT || 8787);

const partners = catalog.partners || {};
const limitBp = catalog.discount?.limitBp || 0;
const certificates = new Map(
  Object.entries(catalog.certificates || {}).map(([code, item]) => [code, { ...item }]),
);

const seen = new Map();
const hits = new Map();

const RATE_LIMIT = Number(process.env.RATE_LIMIT || 10);
const RATE_WINDOW_MS = 60_000;
const SEEN_TTL_MS = 60 * 60 * 1000;
const SEEN_MAX = 500;

function clientAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function allow(address, moment) {
  const recent = (hits.get(address) || []).filter((at) => moment - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(address, recent);
    return false;
  }
  recent.push(moment);
  hits.set(address, recent);
  return true;
}

function trimSeen(moment) {
  for (const [key, value] of seen) {
    if (moment - value.at > SEEN_TTL_MS) {
      seen.delete(key);
    }
  }
  while (seen.size > SEEN_MAX) {
    const oldest = seen.keys().next().value;
    seen.delete(oldest);
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error("body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("body is not JSON"));
      }
    });
    request.on("error", reject);
  });
}

function discountMinor(priceMinor, discountBp) {
  if (priceMinor <= 0 || discountBp <= 0) {
    return 0;
  }
  return Math.floor((priceMinor * discountBp) / 10_000);
}

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

function certificateState(code, moment) {
  const item = certificates.get(code);
  if (!item) {
    return { known: false, remainingMinor: 0, expired: false };
  }
  const expired = Boolean(item.expiresAt) && new Date(item.expiresAt) < moment;
  return { known: true, remainingMinor: item.remainingMinor, expired };
}

function lead(body, moment) {
  const service = catalog.services.find((item) => item.serviceId === body.serviceId);
  if (!service) {
    throw new Error("unknown service");
  }
  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  if (!name || !contact) {
    throw new Error("name and contact are required");
  }

  const code = normalizeCode(body.partner);
  if (code && partners[code] === undefined) {
    throw new Error("unknown partner code");
  }
  const discountBp = Math.min(partners[code] || 0, limitBp);
  const priceMinor = service.priceMinor;
  const discount = discountMinor(priceMinor, discountBp);
  const afterDiscount = priceMinor - discount;

  const certificateCode = normalizeCode(body.certificate);
  const certificate = certificateState(certificateCode, moment);
  if (certificateCode && certificate.expired) {
    throw new Error("certificate expired");
  }
  const certificateMinor = Math.min(certificate.remainingMinor, afterDiscount);
  if (certificateCode && certificate.known) {
    certificates.set(certificateCode, {
      ...certificates.get(certificateCode),
      remainingMinor: certificate.remainingMinor - certificateMinor,
    });
  }

  const leadId = randomUUID();
  const due = afterDiscount - certificateMinor;

  return {
    leadId,
    priceMinor,
    discountMinor: discount,
    clientPriceMinor: afterDiscount,
    discountBp,
    certificateMinor,
    certificateLeftMinor: certificate.known
      ? certificate.remainingMinor - certificateMinor
      : 0,
    dueMinor: due,
    duplicate: false,
    facts: [
      {
        method: "POST",
        path: "/v1/claim",
        body: {
          code: code || null,
          externalAccountId: contact,
        },
      },
      {
        method: "POST",
        path: "/v1/order",
        body: {
          eventId: randomUUID(),
          occurredAt: moment.toISOString(),
          orderId: leadId,
          memberId: contact,
          amount: due,
          currency: catalog.currency,
          personalVolume: 0,
          productId: service.serviceId,
          retailAmount: priceMinor,
          certificateAmount: certificateMinor,
        },
      },
    ],
  };
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    return json(response, 204, {});
  }
  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, { status: "ok", services: catalog.services.length });
  }
  if (request.method === "POST" && request.url === "/api/lead") {
    const key = String(request.headers["idempotency-key"] || "").trim();
    if (!key) {
      return json(response, 400, { detail: "Idempotency-Key header is required" });
    }

    const moment = new Date();
    if (!allow(clientAddress(request), moment.getTime())) {
      return json(response, 429, { detail: "too many requests" });
    }

    trimSeen(moment.getTime());
    const cached = seen.get(key);
    if (cached) {
      return json(response, 200, { ...cached.answer, duplicate: true });
    }

    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      return json(response, 400, { detail: String(error.message) });
    }

    try {
      const answer = lead(body, moment);
      seen.set(key, { at: moment.getTime(), answer });
      return json(response, 200, answer);
    } catch (error) {
      return json(response, 422, { detail: String(error.message) });
    }
  }
  return json(response, 404, { detail: "not found" });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`mock backend listens on http://0.0.0.0:${PORT}`);
});
