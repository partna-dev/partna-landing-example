import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(here, "..", "data", "catalog.json"), "utf8"));
const PORT = Number(process.env.PORT || 8787);

const partners = catalog.partners || {};
const certificates = catalog.certificates || {};
const limitBp = catalog.discount?.limitBp || 0;

const seen = new Map();

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  response.end(payload);
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

function lead(body) {
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
  const discountBp = Math.min(partners[code] || 0, limitBp);
  const priceMinor = service.priceMinor;
  const afterDiscount = priceMinor - discountMinor(priceMinor, discountBp);

  const certificateCode = normalizeCode(body.certificate);
  const remaining = certificates[certificateCode] || 0;
  const certificateMinor = Math.min(remaining, afterDiscount);

  const leadId = randomUUID();
  const due = afterDiscount - certificateMinor;

  return {
    leadId,
    priceMinor,
    discountBp,
    certificateMinor,
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
          occurredAt: new Date().toISOString(),
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
    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      return json(response, 400, { detail: String(error.message) });
    }

    const key = String(request.headers["idempotency-key"] || body.contact || "");
    const cached = key ? seen.get(key) : undefined;
    if (cached) {
      return json(response, 200, { ...cached, duplicate: true });
    }

    try {
      const answer = lead(body);
      if (key) {
        seen.set(key, answer);
      }
      return json(response, 200, answer);
    } catch (error) {
      return json(response, 422, { detail: String(error.message) });
    }
  }
  return json(response, 404, { detail: "not found" });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`mock backend listens on http://0.0.0.0:${PORT}`);
});
