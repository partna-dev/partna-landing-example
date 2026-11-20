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
| Why the page cannot take money | `/payment` | The boundary between landing, owner backend and core |
| What the server would send | `/order/<service>` after submit | Two facts shaped like the bridge contract |

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

No keys, no accounts and no Partna services are needed: prices, partners and
certificates come from [data/catalog.json](data/catalog.json).

## Structure

```
data/catalog.json          fixtures shaped like the read contract
src/lib/price.ts           the only place where a discounted price is computed
src/lib/catalog.ts         fixtures, partner codes, certificate balances
src/layouts/Base.astro     shell: head, brand, footer
src/pages/index.astro      catalogue
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

## Where the real contracts are

- facts (`claim`, `order`, `refund`, `member`): [partna-bridge/spec](https://github.com/partna-dev/partna-bridge/blob/main/spec/README.md);
- field names and mistakes that cost money: [docs/integrations/fields.md](https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/fields.md);
- reading by partner token: [partna-partner/docs/portal-api.md](https://github.com/partna-dev/partna-partner/blob/main/docs/portal-api.md).

Nothing in this repository overrides those documents.

## Making it yours

1. Replace `data/catalog.json` with your services; keep the field names.
2. Point `PUBLIC_API_BASE` at your backend and implement `POST /api/lead` there.
3. Replace the mock calls with bridge calls: `claim`, then `order`, each with its
   own `eventId` that your server creates once and stores.

## License

MIT — see [LICENSE](LICENSE).
