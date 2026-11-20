import type { Price } from './market.types.js'

function isSamePrice(a: Price, b: Price): boolean {
  return (
    a.price === b.price &&
    a.change24h === b.change24h &&
    a.high24h === b.high24h &&
    a.low24h === b.low24h &&
    a.volume24h === b.volume24h
  )
}

export class PriceStore {
  private prices = new Map<string, Price>()
  private dirty = new Set<string>() // symbols changed since last takeChanges()

  set(price: Price): void {
    const prev = this.prices.get(price.symbol)
    if (prev && isSamePrice(prev, price)) {
      // Keep latest timestamp without broadcasting a no-op update
      this.prices.set(price.symbol, { ...prev, updatedAt: price.updatedAt })
      return
    }
    this.prices.set(price.symbol, price)
    this.dirty.add(price.symbol)
  }

  get(symbol: string): Price | undefined {
    return this.prices.get(symbol)
  }

  all(): Price[] {
    return [...this.prices.values()]
  }

  // Returns only the prices that changed, then clears the list
  takeChanges(): Price[] {
    const changed = [...this.dirty].flatMap((symbol) => {
      const price = this.prices.get(symbol)
      return price ? [price] : []
    })
    this.dirty.clear()
    return changed
  }
}

// One shared instance for the whole app
export const priceStore = new PriceStore()
