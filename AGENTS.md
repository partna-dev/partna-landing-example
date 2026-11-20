# AGENTS.md

Read this before writing code in this repository. It exists so that an agent can
build a landing for a partner programme without breaking prices, attribution or
payouts.

This repository is an example. The truth about contracts lives in
`partna-bridge` and `partna-partner`, not here.

## Hard rules

1. **Money is computed on the server.** The page shows numbers, it does not decide
   them. `priceMinor`, `discountBp` and the certificate balance arrive from a
   server. `src/lib/price.ts` is the only place that turns them into a displayed
   price, and it implements the contract formula:

   ```
   discountMinor = priceMinor * discountBp // 10000
   clientPriceMinor = priceMinor - discountMinor
   ```

2. **`eventId` is unique forever.** One fact, one identifier. A retry must reuse
   the identifier already stored, never create a new one. A new `eventId` on every
   attempt turns one payment into two accruals.

3. **The tenant key never reaches the browser.** Facts are signed with it. The page
   calls the owner's backend; the backend calls the bridge. There is no path from
   `src/` to the core API.

4. **Personal data stays with the owner.** Only identifiers travel to the core:
   `memberId`, `orderId`, amounts. A landing that starts sending names and phones
   to the core is wrong even when it works.

5. **Payment and certificates are not the landing's job.** The page collects a
   lead. Discount and certificate are applied by the owner's backend and shown as a
   result. A page that reserves a certificate by itself can spend it twice.

## Before writing code, answer these

1. Where does the catalogue come from — fixtures or `GET /v1/portal/me/services`?
2. Which partner code is in play, and what is the discount limit for the tenant?
3. Who computes the price the client sees, and where is that formula written?
4. Where is `eventId` created, and where is it stored before the first request?
5. What happens when the bridge is down: queue, retry later, or show an error?
   (The example does not answer this; the bridge does, see its integration levels.)
6. Which fields are required by `POST /v1/order` for this service?
7. Does the flow ever refund? If yes, who sends `refund` and with which `orderId`?
8. What does the page do with a certificate code that is expired or already used?
9. Which numbers are shown before the server answers, and are they marked as
   preliminary?
10. What is checked to prove the same payment did not produce two accruals?

## How to verify the example

```bash
npm install
npm run accept   # numbers, idempotency, refusals
npm run mock &
npm run dev
```

- `/` — list prices;
- `/?ref=IRON` — 10% discount, computed from `discountBp`;
- `/order/p_consult?ref=IRON` with `CERT5000` — partial certificate coverage;
- submit the same form twice with the same `Idempotency-Key` and check that the
  answer returns `duplicate: true` and the same `leadId`;
- open `/payment` and check that no page calls the core API directly:
  `grep -rn "v1/" src/` should return nothing;
- `CERTOLD` is refused as expired, `PIRATE` as an unknown partner, and a request
  without `Idempotency-Key` as `400`.

## Map

- `data/catalog.json` — fixtures: services, partners, certificates, discount limit;
- `src/lib/price.ts` — money and discount;
- `src/lib/catalog.ts` — reading fixtures, partner code normalisation;
- `src/pages/` — routes;
- `mock-backend/server.mjs` — what the owner backend does: validates the partner,
  spends the certificate once, computes the money, keeps the idempotency map;
- `scripts/acceptance.mjs` — the checks above as a script;
- `README.md`, `README.ru.md` — the human tour.

## Deployment note

`PUBLIC_ROBOTS=noindex` is set on the public stand, `index` is the default. The mock
limits `/api/lead` per address and keeps state in memory only: nothing survives a
restart, which is why the stand can be public without a database.

## Contracts

- facts: https://github.com/partna-dev/partna-bridge/blob/main/spec/README.md
- fields and costly mistakes: https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/fields.md
- integration levels: https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/README.md
- reading by partner token: https://github.com/partna-dev/partna-partner/blob/main/docs/portal-api.md
