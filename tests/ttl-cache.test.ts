import { describe, it, expect, vi, afterEach } from 'vitest'
import { TtlCache } from '../src/lib/ttl-cache.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('TtlCache', () => {
  it('calls the loader once while the entry is fresh', async () => {
    const cache = new TtlCache<number>(1_000)
    const loader = vi.fn(async () => 42)

    expect(await cache.get('btc', loader)).toBe(42)
    expect(await cache.get('btc', loader)).toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('serves stale data immediately and refreshes in the background', async () => {
    vi.useFakeTimers()
    const cache = new TtlCache<number>(1_000)
    let value = 1
    const loader = vi.fn(async () => value++)

    expect(await cache.get('btc', loader)).toBe(1)
    vi.advanceTimersByTime(1_001)

    // Expired: still returns stale payload right away
    expect(await cache.get('btc', loader)).toBe(1)
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(await cache.get('btc', loader)).toBe(2)
  })

  it('keeps separate entries per key', async () => {
    const cache = new TtlCache<string>(1_000)

    expect(await cache.get('btc', async () => 'b')).toBe('b')
    expect(await cache.get('eth', async () => 'e')).toBe('e')
  })
})
