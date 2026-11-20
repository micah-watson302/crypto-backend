import { getCoins, type CoinInfo } from '../../config/coins.js'
import { priceStore } from '../market/market.store.js'
import type { Price } from '../market/market.types.js'

export type CoinSort = 'volume' | 'change' | 'price' | 'name' | 'high'
export type CoinOrder = 'asc' | 'desc'

export type CoinRow = CoinInfo & { live: Price | null }

export type CoinsPage = {
  items: CoinRow[]
  total: number
  limit: number
  offset: number
  sort: CoinSort
  order: CoinOrder
  q: string
}

const SORTS = new Set<CoinSort>(['volume', 'change', 'price', 'name', 'high'])

export function parseCoinSort(value: unknown): CoinSort {
  if (typeof value === 'string' && SORTS.has(value as CoinSort)) {
    return value as CoinSort
  }
  return 'volume'
}

export function parseCoinOrder(value: unknown): CoinOrder | undefined {
  if (value === 'asc' || value === 'desc') return value
  return undefined
}

function metric(row: CoinRow, sort: CoinSort): number | string {
  switch (sort) {
    case 'change':
      return row.live?.change24h ?? Number.NEGATIVE_INFINITY
    case 'price':
      return row.live?.price ?? Number.NEGATIVE_INFINITY
    case 'high':
      return row.live?.high24h ?? Number.NEGATIVE_INFINITY
    case 'name':
      return row.name.toLowerCase()
    case 'volume':
    default:
      return row.live?.volume24h ?? Number.NEGATIVE_INFINITY
  }
}

function sortRows(rows: CoinRow[], sort: CoinSort, order: CoinOrder): CoinRow[] {
  const dir = order === 'asc' ? 1 : -1
  const next = [...rows]
  next.sort((a, b) => {
    const av = metric(a, sort)
    const bv = metric(b, sort)
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir
    }
    return ((av as number) - (bv as number)) * dir
  })
  return next
}

export function queryCoinsPage(input: {
  limit?: number
  offset?: number
  sort?: CoinSort
  order?: CoinOrder
  q?: string
}): CoinsPage {
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 40)))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  const sort = input.sort ?? 'volume'
  const q = (input.q ?? '').trim().toLowerCase()
  const order = input.order ?? (sort === 'name' ? 'asc' : 'desc')

  let rows: CoinRow[] = getCoins().map((coin) => ({
    ...coin,
    live: priceStore.get(coin.symbol) ?? null,
  }))

  if (q) {
    rows = rows.filter(
      (coin) =>
        coin.symbol.toLowerCase().includes(q) ||
        coin.name.toLowerCase().includes(q),
    )
  }

  rows = sortRows(rows, sort, order)
  const total = rows.length
  const items = rows.slice(offset, offset + limit)

  return { items, total, limit, offset, sort, order, q }
}
