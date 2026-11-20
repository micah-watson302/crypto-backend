import ky from 'ky'
import { setCoins, type CoinInfo } from '../../config/coins.js'
import { env } from '../../config/env.js'
import { logger } from '../../lib/logger.js'

const log = logger.child({ module: 'coins-loader' })

interface SymbolsResponse {
  code: string
  data: {
    symbol: string
    baseCurrency: string
    quoteCurrency: string
    enableTrading: boolean
  }[]
}

interface CurrenciesResponse {
  code: string
  data: {
    currency: string
    fullName?: string
    name?: string
  }[]
}

const http = ky.create({
  prefix: 'https://api.kucoin.com/api/v1/',
  timeout: 20_000,
  retry: { limit: 2 },
  headers: { 'User-Agent': 'crypto-backend' },
})

export async function fetchUsdtCoinsFromKucoin(): Promise<CoinInfo[]> {
  const [symbolsRes, currenciesRes] = await Promise.all([
    http.get('symbols').json<SymbolsResponse>(),
    http.get('currencies').json<CurrenciesResponse>(),
  ])

  const names = new Map<string, string>()
  for (const currency of currenciesRes.data ?? []) {
    const label = currency.fullName || currency.name || currency.currency
    names.set(currency.currency.toUpperCase(), label)
  }

  const coins: CoinInfo[] = []
  for (const row of symbolsRes.data ?? []) {
    if (row.quoteCurrency !== 'USDT' || !row.enableTrading) continue
    const symbol = row.baseCurrency.toUpperCase()
    coins.push({
      symbol,
      name: names.get(symbol) ?? symbol,
    })
  }

  return coins
}

export async function loadCoinsFromKucoin(): Promise<number> {
  const coins = await fetchUsdtCoinsFromKucoin()
  if (coins.length === 0) {
    throw new Error('KuCoin returned no tradable USDT pairs')
  }
  setCoins(coins)
  log.info({ count: coins.length }, 'loaded USDT markets from KuCoin')
  return coins.length
}

/** Periodic refresh so newly listed pairs appear without restart. */
export function startCoinsRefresh(intervalMs = 6 * 60 * 60 * 1000): () => void {
  if (env.NODE_ENV === 'test') return () => undefined

  const timer = setInterval(() => {
    void loadCoinsFromKucoin().catch((err) => {
      log.warn(
        { err: (err as Error).message },
        'coin list refresh failed; keeping previous list',
      )
    })
  }, intervalMs)
  timer.unref?.()

  return () => clearInterval(timer)
}
