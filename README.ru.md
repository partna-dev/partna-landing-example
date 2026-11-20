# partna-landing-example

[English](README.md) · Русский

Эталонный лендинг партнёрской программы Partna. Склонируйте, запустите, прочитайте
[AGENTS.md](AGENTS.md) — и собирайте свою страницу, не нарушая правила про деньги.

Это пример, а не продакшен. Данные вымышленные, суммы маленькие, бэкенд —
заглушка.

## Что показано

| Сценарий | Где | Что видно |
|---|---|---|
| Клиент без партнёра | `/` | Цены без скидки |
| Клиент по ссылке партнёра | `/?ref=IRON` | Скидка 10 %, цена пересчитана |
| Сертификат покрывает часть | `/order/p_consult?ref=IRON`, код `CERT5000` | Остаток сертификата и сумма к оплате |
| Почему страница не принимает деньги | `/payment` | Граница между лендингом, бэкендом владельца и ядром |
| Что сервер отправит | `/order/<услуга>` после отправки | Два факта в форме контракта моста |

## Запуск

```bash
npm install
npm run mock    # заглушка бэкенда владельца на :8787
npm run dev     # лендинг на :4321
```

Или через Docker:

```bash
docker compose up --build
```

Ключи, аккаунты и сервисы Partna не нужны: цены, партнёры и сертификаты лежат в
[data/catalog.json](data/catalog.json).

## Структура

```
data/catalog.json          фикстуры в форме контракта чтения
src/lib/price.ts           единственное место, где считается цена со скидкой
src/lib/catalog.ts         фикстуры, коды партнёров, остатки сертификатов
src/layouts/Base.astro     оболочка: head, бренд, подвал
src/pages/index.astro      каталог
src/pages/service/[id].astro
src/pages/order/[id].astro  форма заявки (заглушка бэкенда)
src/pages/payment.astro    где на самом деле двигаются деньги
src/components/PriceTag.vue цена со скидкой и без
src/components/OrderForm.vue заявка, ключ идемпотентности, ответ сервера
mock-backend/server.mjs    заглушка бэкенда владельца
```

Лендинг собран на Astro с Vue-островами: тексты и цены есть в HTML, который
отдаёт сервер, в браузере оживают только цена и форма.

## Правило, из-за которого цены сходятся

Сервер не доверяет числам из браузера, а страница не придумывает свои. Формула
записана в контракте:

```
discountMinor = priceMinor * discountBp // 10000
clientPriceMinor = priceMinor - discountMinor
```

`src/lib/price.ts` реализует ровно её, и заглушка бэкенда повторяет её на сервере.
Если они разойдутся, это будет видно в демо.

## Где настоящие контракты

- факты (`claim`, `order`, `refund`, `member`): [partna-bridge/spec](https://github.com/partna-dev/partna-bridge/blob/main/spec/README.md);
- поля и ошибки, которые стоят денег: [docs/integrations/fields.md](https://github.com/partna-dev/partna-bridge/blob/main/docs/integrations/fields.md);
- чтение по токену партнёра: [partna-partner/docs/portal-api.md](https://github.com/partna-dev/partna-partner/blob/main/docs/portal-api.md).

Ничто в этом репозитории не отменяет эти документы.

## Как сделать своим

1. Замените `data/catalog.json` на свои услуги, сохранив имена полей.
2. Направьте `PUBLIC_API_BASE` на свой бэкенд и реализуйте там `POST /api/lead`.
3. Замените вызовы заглушки на вызовы моста: сначала `claim`, затем `order`,
   у каждого свой `eventId`, который сервер создаёт один раз и хранит.

## Лицензия

MIT — см. [LICENSE](LICENSE).
