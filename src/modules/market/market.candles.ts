import ky from 'ky'
import { env } from '../../config/env.js'
import { upstreamError } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'
import { TtlCache } from '../../lib/ttl-cache.js'
import type { Candle } from './market.types.js'

const http = ky.create({
  prefix: 'https://api.kucoin.com/api/v1/',
  timeout: 10_000,
  retry: { limit: 2 },
  headers: { 'User-Agent': 'crypto-backend' },
})

// Our granularity (seconds) → KuCoin's interval name
const INTERVALS: Record<number, string> = {
  60: '1min',
  300: '5min',
  900: '15min',
  3600: '1hour',
  21600: '6hour',
  86400: '1day',
}

/** Longer windows change slower → keep them cached longer to protect KuCoin. */
const TTL_BY_GRANULARITY: Record<number, number> = {
  60: env.CANDLE_TTL_MS,
  300: Math.max(env.CANDLE_TTL_MS, 120_000),
  900: Math.max(env.CANDLE_TTL_MS, 180_000),
  3600: Math.max(env.CANDLE_TTL_MS, 300_000),
  21600: Math.max(env.CANDLE_TTL_MS, 600_000),
  86400: Math.max(env.CANDLE_TTL_MS, 900_000),
}

// KuCoin's raw candle: [time, open, close, high, low, volume, turnover], all strings
type RawCandle = [string, string, string, string, string, string, string]

interface CandlesResponse {
  code: string
  data: RawCandle[]
}

const caches = new Map<number, TtlCache<Candle[]>>()

function cacheFor(granularity: number): TtlCache<Candle[]> {
  const ttl = TTL_BY_GRANULARITY[granularity] ?? env.CANDLE_TTL_MS
  let cache = caches.get(granularity)
  if (!cache) {
    cache = new TtlCache<Candle[]>(ttl)
    caches.set(granularity, cache)
  }
  return cache
}

export function getCandles(
  symbol: string,
  granularity: number,
): Promise<Candle[]> {
  return cacheFor(granularity).get(`${symbol}:${granularity}`, () =>
    fetchCandles(symbol, granularity),
  )
}

/** Warm popular pairs so the first wave of users rarely hits KuCoin cold. */
export function warmPopularCandles(
  symbols: string[] = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'],
  granularity = 3600,
): void {
  for (const symbol of symbols) {
    void getCandles(symbol, granularity).catch(() => undefined)
  }
}

async function fetchCandles(
  symbol: string,
  granularity: number,
): Promise<Candle[]> {
  try {
    const res = await http
      .get('market/candles', {
        searchParams: {
          symbol: `${symbol}-USDT`,
          type: INTERVALS[granularity],
        },
      })
      .json<CandlesResponse>()

    return res.data
      .map(([time, open, close, high, low, volume]) => ({
        time: Number(time),
        open: Number(open),
        close: Number(close),
        high: Number(high),
        low: Number(low),
        volume: Number(volume),
      }))
      .sort((a, b) => a.time - b.time)
  } catch (err) {
    logger.warn({ err: (err as Error).message, symbol }, 'candle fetch failed')
    throw upstreamError()
  }
}
