# partna-landing-example

English · [Русский](README.ru.md)

A reference landing for the Partna partner programme. Clone it, run it, read
[AGENTS.md](AGENTS.md), and build your own page without breaking the money rules.

This is an example, not production. Data is made up, numbers are small, and the
backend is a mock.

## What it shows

| Scenario | Where | What you see |
|---|---|---|
| A client with no partner | `/` | List prices, no discount |
| A client from a partner link | `/?ref=IRON` | 10% partner discount, price recalculated |
| A certificate pays part of it | `/order/p_consult?ref=IRON`, code `CERT5000` | Remaining on the certificate, amount to pay |
| An expired certificate is refused | the same page, code `CERTOLD` | Error, no order |
| An unknown partner code is refused | `/?ref=PIRATE` | No discount, the backend rejects the claim |
| Why the page cannot take money | `/payment` | The boundary between landing, owner backend and core |
| What the server would send | `/order/<service>` after submit | Two facts shaped like the bridge contract |

## Live example

<https://example.partna.dev> — the same code with `noindex` and a memory-only
backend. Nothing is stored, the certificate and the catalogue are reset on restart.

## Run it

```bash
npm install
npm run mock    # mock owner backend on :8787
npm run dev     # landing on :4321
```

Or with Docker:

```bash
docker compose up --build
```

Acceptance checks, no browser needed:

```bash
npm run accept
```

It starts the mock, sends the IRON + `CERT5000` order twice, and verifies the
numbers, idempotency, refusal of a missing key, an unknown partner and an expired
certificate. Exit code 1 on any mismatch.

No keys, no accounts and no Partna services are needed: prices, partners and
certificates come from [data/catalog.json](data/catalog.json).

`PUBLIC_ROBOTS` controls indexing: `index` by default, `noindex` on a stand that
should stay out of search. The mock limits `/api/lead` to ten requests per minute
per address and keeps answers only in memory.

## Structure

```
data/catalog.json          fixtures shaped like the read contract
src/lib/price.ts           the only place where a discounted price is computed
src/lib/catalog.ts         fixtures, partner codes, certificate balances
src/layouts/Base.astro     shell: head, brand, footer
src/pages/index.astro      catalogue
scripts/acceptance.mjs     checks the numbers and idempotency
src/pages/service/[id].astro
src/pages/order/[id].astro  lead form (mock backend)
src/pages/payment.astro    where money actually moves
src/components/PriceTag.vue price with and without discount
src/components/OrderForm.vue lead form, idempotency key, server answer
mock-backend/server.mjs    mock of the owner backend
```

The landing is Astro with Vue islands: text and prices are in the HTML that the
server sends, only the price tag and the form hydrate in the browser.

## The rule that keeps prices honest

The server never trusts a number from the browser, and the page never invents one.
The contract states the formula:

```
discountMinor = priceMinor * discountBp // 10000
clientPriceMinor = priceMinor - discountMinor
```

`src/lib/price.ts` implements exactly this, and the mock backend implements it
again on the server. If the two disagree, the demo shows it.

## The lead contract

`POST /api/lead` is what the landing sends to the owner's backend. The mock
implements it; your backend implements it for real.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `serviceId` | string | yes | which service, from the catalogue |
| `name` | string | yes | who is asking |
| `contact` | string | yes | email or phone; also the client identifier |
| `partner` | string | no | partner code from the link |
| `certificate` | string | no | certificate code the client has |

`Idempotency-Key` header is required. The same key returns the same answer with
`duplicate: true`. Without it the backend answers `400`.

```bash
curl -sS -X POST http://localhost:8787/api/lead \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' \
  -d '{"serviceId":"p_consult","name":"Маша","contact":"masha@example.com","partner":"IRON","certificate":"CERT5000"}'
```

Answer (money parts):

```json
{
  "leadId": "6f1c...",
  "priceMinor": 500000,
  "discountMinor": 50000,
  "clientPriceMinor": 450000,
  "discountBp": 1000,
  "certificateMinor": 300000,
  "certificateLeftMinor": 0,
  "dueMinor": 150000,
  "duplicate": false,
  "facts": []
}
```

Errors: `400` without the key or with a broken body, `422` for an unknown service,
an unknown partner code, an expired certificate or missing name and contact.

The certificate is spent once: the mock keeps the remaining amount and refuses a
code whose `expiresAt` has passed. A real backend does the same in one database
transaction, which is why the landing must never reserve a certificate itself.

## What the facts mean

`amount` is what the client pays after the discount and the certificate;
`retailAmount` is the list price; `certificateAmount` is what the certificate
covered. `personalVolume` is the volume for the calculation; `0` means the tenant
does not use a separate volume. The difference between `retailAmount` and
`amount + certificateAmount` is the partner discount.

The contract lists the field names:
[fields.md](https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/fields.md).

## `discount` in the fixtures

`discount.limitBp` is the tenant's ceiling; no partner can exceed it.
`discount.currentBp` is the percentage a signed-in partner sees for themselves in
`GET /v1/portal/me`; a landing that knows only the code uses `partners[code]` and
clamps it by the ceiling.

## Where the real contracts are

- facts (`claim`, `order`, `refund`, `member`): [partna-bridge/spec](https://github.com/partna-dev/partna-bridge/blob/main/spec/README.md);
- field names and mistakes that cost money: [docs/integrations/fields.md](https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/fields.md);
- reading by partner token: [partna-partner/docs/portal-api.md](https://github.com/partna-dev/partna-partner/blob/main/docs/portal-api.md).

Nothing in this repository overrides those documents.

## Making it yours

1. Replace `data/catalog.json` with your services, partners and certificates; keep
   the field names. The brand moves with it.
2. Point `PUBLIC_API_BASE` at your backend and implement `POST /api/lead` there.
3. Replace the mock calls with bridge calls: `claim`, then `order`, each with its
   own `eventId` that your server creates once and stores.

## License

MIT — see [LICENSE](LICENSE).
