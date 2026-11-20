interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>()
  private inFlight = new Map<string, Promise<T>>()

  constructor(private readonly ttlMs: number) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key)
    const now = Date.now()

    if (hit && hit.expiresAt > now) return hit.value

    // Stale-while-revalidate: under load, keep serving the last good payload
    // while a single refresh runs in the background.
    if (hit) {
      if (!this.inFlight.has(key)) {
        void this.refresh(key, load)
      }
      return hit.value
    }

    const pending = this.inFlight.get(key)
    if (pending) return pending

    return this.refresh(key, load)
  }

  private refresh(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) return existing

    const promise = load()
      .then((value) => {
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
        return value
      })
      .finally(() => this.inFlight.delete(key))

    this.inFlight.set(key, promise)
    return promise
  }
}
