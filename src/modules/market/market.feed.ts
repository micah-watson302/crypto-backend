import ky from 'ky'
import { getCoins } from '../../config/coins.js'
import { env } from '../../config/env.js'
import { logger } from '../../lib/logger.js'
import type { PriceStore } from './market.store.js'

const log = logger.child({ module: 'market-feed' })

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

interface AllTickersResponse {
  code: string
  data: {
    ticker: {
      symbol: string
      last: string
      changeRate: string
      high: string
      low: string
      vol: string
    }[]
  }
}

/**
 * Poll KuCoin allTickers for every tracked USDT pair.
 * Per-symbol WebSocket snapshots cannot cover 800+ markets (KuCoin caps
 * subscriptions at 300/session), so REST allTickers is the scalable path
 * while staying on the same KuCoin data source.
 */
export function startMarketFeed(store: PriceStore): () => void {
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  let backoff = MIN_BACKOFF_MS

  async function poll(): Promise<void> {
    if (stopped) return
    try {
      const res = await ky
        .get('https://api.kucoin.com/api/v1/market/allTickers', {
          timeout: 15_000,
          headers: { 'User-Agent': 'crypto-backend' },
        })
        .json<AllTickersResponse>()

      const known = new Set(getCoins().map((c) => c.symbol))
      const now = Date.now()
      let applied = 0

      for (const ticker of res.data?.ticker ?? []) {
        if (!ticker.symbol.endsWith('-USDT')) continue
        const symbol = ticker.symbol.slice(0, -5)
        if (!known.has(symbol)) continue

        const price = Number(ticker.last)
        if (!Number.isFinite(price)) continue

        store.set({
          symbol,
          price,
          change24h: Math.round(Number(ticker.changeRate) * 10_000) / 100,
          high24h: Number(ticker.high),
          low24h: Number(ticker.low),
          volume24h: Number(ticker.vol),
          updatedAt: now,
        })
        applied += 1
      }

      backoff = MIN_BACKOFF_MS
      log.debug({ applied }, 'polled KuCoin allTickers')
      timer = setTimeout(() => void poll(), env.PUSH_INTERVAL_MS)
    } catch (err) {
      log.error({ err: (err as Error).message }, 'allTickers poll failed')
      timer = setTimeout(() => void poll(), backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
  }

  void poll()

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
