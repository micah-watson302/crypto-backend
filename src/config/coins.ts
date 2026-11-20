export interface CoinInfo {
  symbol: string
  name: string
}

/** Used in tests and as a last-resort fallback if KuCoin is unreachable. */
export const FALLBACK_COINS: readonly CoinInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'LINK', name: 'Chainlink' },
]

let coins: CoinInfo[] = [...FALLBACK_COINS]
const bySymbol = new Map<string, CoinInfo>(
  FALLBACK_COINS.map((c) => [c.symbol, c]),
)

export function getCoins(): readonly CoinInfo[] {
  return coins
}

export function getCoin(symbol: string): CoinInfo | undefined {
  return bySymbol.get(symbol.toUpperCase())
}

export function isKnownSymbol(symbol: string): boolean {
  return bySymbol.has(symbol.toUpperCase())
}

/** Replace the in-memory registry (tests / KuCoin loader). */
export function setCoins(next: readonly CoinInfo[]): void {
  const unique = new Map<string, CoinInfo>()
  for (const coin of next) {
    const symbol = coin.symbol.toUpperCase()
    if (!symbol || unique.has(symbol)) continue
    unique.set(symbol, { symbol, name: coin.name || symbol })
  }
  coins = [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
  bySymbol.clear()
  for (const coin of coins) bySymbol.set(coin.symbol, coin)
}
