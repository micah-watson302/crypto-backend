# crypto-backend

Express + Socket.IO backend that streams live crypto prices from KuCoin.

## Requirements

- Node.js 20+
- Internet access to `api.kucoin.com`

## Setup

```bash
npm install
cp .env.example .env   # optional; defaults work without it
npm run dev
```

The server starts on `http://localhost:4000` (or `PORT`).

## Configuration

All variables are optional. See `.env.example`.

| Variable           | Default                 | Purpose                                     |
| ------------------ | ----------------------- | ------------------------------------------- |
| `NODE_ENV`         | `development`           | `development`, `test`, or `production`      |
| `PORT`             | `4000`                  | HTTP and Socket.IO port                     |
| `CORS_ORIGIN`      | `http://localhost:5173` | Allowed browser origin                      |
| `LOG_LEVEL`        | `info`                  | Pino log level                              |
| `PUSH_INTERVAL_MS` | `1000`                  | Poll + Socket.IO batch interval (ms)        |
| `CANDLE_TTL_MS`    | `60000`                 | Candle cache lifetime                       |

Invalid values stop the server at startup with a clear error.

## Coins

On startup the server loads **all tradable USDT pairs** from KuCoin
(`GET /api/v1/symbols` + currency names), typically 800+. The list refreshes
every 6 hours.

Live prices come from KuCoin `GET /api/v1/market/allTickers` (polled every
`PUSH_INTERVAL_MS`). Per-symbol WebSocket snapshots cannot cover the full
market (KuCoin limits ~300 subscriptions/session), so allTickers is the
scalable path on the same data source.

If KuCoin is unreachable at boot, a small fallback list is used until the
next successful refresh.

## Scripts

| Command                        | What it does                                    |
| ------------------------------ | ----------------------------------------------- |
| `npm run dev`                  | Dev server with auto-restart on file changes    |
| `npm run build`                | Compile to `dist/`                              |
| `npm start`                    | Run the compiled build                          |
| `npm test`                     | Run Vitest tests in `tests/`                    |
| `npm run typecheck`            | TypeScript check without emitting files         |
| `npm run lint`                 | ESLint                                          |
| `npm run format`               | Prettier                                        |
| `node scripts/test-socket.mjs` | Manual Socket.IO check (server must be running) |

## Project layout

```
src/
  app.ts                 Express app (middleware, routes, error handling)
  server.ts              HTTP server, feed, Socket.IO, graceful shutdown
  config/                Env validation and coin list
  lib/                   Errors, logger, TTL cache
  middlewares/           Error handler
  modules/
coins/               /api/coins
health/              /health, /ready
market/              KuCoin feed, price store, candles, routes
realtime/            Socket.IO gateway
tests/                   Vitest tests
scripts/test-socket.mjs  Manual Socket.IO client check
```

---

## For frontend developers

**Base URL:** `http://localhost:4000`. The server only allows the origin in `CORS_ORIGIN` (default `http://localhost:5173`). If your dev server runs elsewhere, ask the backend dev to change it.

### Data types

```ts
interface LivePrice {
  symbol: string // "BTC"
  price: number // in USDT (treat as USD)
  change24h: number // percent, 2 decimals, e.g. -1.25
  high24h: number
  low24h: number
  volume24h: number
  updatedAt: number // ms timestamp
}

interface Candle {
  time: number // unix SECONDS (not ms), start of candle
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Coin {
  symbol: string
  name: string
  live: LivePrice | null // null until the first price arrives
}
```

### HTTP endpoints

| Method | Path                                           | Response                                                                          |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/health`                                      | Liveness check, 200                                                               |
| GET    | `/ready`                                       | `{ ready: boolean, pricesLoaded: number }`; 200 once prices have loaded, else 503 |
| GET    | `/api/coins?limit=40&offset=0&sort=volume&q=`  | Paginated page from memory: `{ items, total, limit, offset, sort, q }`            |
| GET    | `/api/coins/symbols`                           | `string[]` of symbols (no prices)                                                 |
| GET    | `/api/coins/:symbol`                           | `Coin` (symbol is case-insensitive)                                               |
| GET    | `/api/market/prices?symbols=BTC,ETH`           | `LivePrice[]` (optional `symbols` filter; empty = all in memory)                  |
| GET    | `/api/market/candles/:symbol?granularity=3600` | `{ symbol, granularity, candles: Candle[] }`, oldest first                        |

`granularity` is in seconds: `60`, `300`, `900`, `3600` (default), `21600`, `86400`. Any other value returns 400.

```bash
curl "http://localhost:4000/api/market/candles/BTC?granularity=3600"
```

### Errors

All errors are JSON with an `error` field:

```json
{ "error": "Coin not found" }
{ "error": "Invalid request", "details": [{ "path": "granularity", "message": "..." }] }
```

| Status | Meaning        |
| ------ | -------------- |
| 400    | Invalid symbol |
