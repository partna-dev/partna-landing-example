import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.ACCEPT_PORT || 8798);
const BASE = `http://127.0.0.1:${PORT}`;

const checks = [];
let failed = 0;

function check(name, condition, actual) {
  checks.push({ name, ok: Boolean(condition), actual });
  if (!condition) {
    failed += 1;
  }
}

async function post(body, key) {
  const response = await fetch(`${BASE}/api/lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function waitForHealth(attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // сервер ещё поднимается
    }
    await sleep(150);
  }
  return false;
}

const server = spawn("node", ["mock-backend/server.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

try {
  const alive = await waitForHealth();
  if (!alive) {
    throw new Error(`mock backend did not start on ${BASE}`);
  }

  const order = {
    serviceId: "p_consult",
    name: "Маша",
    contact: "masha@example.com",
    partner: "IRON",
    certificate: "CERT5000",
  };

  const first = await post(order, "accept-1");
  check("status 200", first.status === 200, first.status);
  check("price 500000", first.body.priceMinor === 500000, first.body.priceMinor);
  check("discount 50000", first.body.discountMinor === 50000, first.body.discountMinor);
  check("client price 450000", first.body.clientPriceMinor === 450000, first.body.clientPriceMinor);
  check("certificate 300000", first.body.certificateMinor === 300000, first.body.certificateMinor);
  check("due 150000", first.body.dueMinor === 150000, first.body.dueMinor);
  check("facts are two", first.body.facts.length === 2, first.body.facts.length);
  check("claim fact first", first.body.facts[0].path === "/v1/claim", first.body.facts[0].path);
  check("order fact has eventId", Boolean(first.body.facts[1].body.eventId), first.body.facts[1].body.eventId);

  const repeat = await post(order, "accept-1");
  check("repeat is duplicate", repeat.body.duplicate === true, repeat.body.duplicate);
  check("repeat returns same lead", repeat.body.leadId === first.body.leadId, repeat.body.leadId);

  const noKey = await post(order, "");
  check("no key is refused", noKey.status === 400, noKey.status);

  const unknownPartner = await post({ ...order, partner: "PIRATE" }, "accept-2");
  check("unknown partner is refused", unknownPartner.status === 422, unknownPartner.status);

  const expired = await post({ ...order, certificate: "CERTOLD" }, "accept-3");
  check("expired certificate is refused", expired.status === 422, expired.status);

  const second = await post({ ...order, certificate: "CERT5000" }, "accept-4");
  check("certificate is spent", second.body.certificateMinor === 0, second.body.certificateMinor);
} finally {
  server.kill("SIGTERM");
}

for (const item of checks) {
  const mark = item.ok ? "ok  " : "FAIL";
  console.log(`${mark} ${item.name}${item.ok ? "" : ` — got ${JSON.stringify(item.actual)}`}`);
}

if (failed > 0) {
  console.error(`\n${failed} of ${checks.length} checks failed`);
  process.exit(1);
}
console.log(`\nall ${checks.length} checks passed`);
