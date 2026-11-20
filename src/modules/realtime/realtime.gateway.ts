import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { env } from '../../config/env.js'
import { logger } from '../../lib/logger.js'
import type { Price } from '../market/market.types.js'
import type { PriceStore } from '../market/market.store.js'

const MAX_WATCH = 100

type SocketData = {
  symbols: Set<string>
}

function normalizeSymbols(input: unknown): Set<string> {
  if (!Array.isArray(input)) return new Set()
  return new Set(
    input
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().toUpperCase())
      .slice(0, MAX_WATCH),
  )
}

function snapshotFor(store: PriceStore, symbols: Set<string>): Price[] {
  const out: Price[] = []
  for (const symbol of symbols) {
    const price = store.get(symbol)
    if (price) out.push(price)
  }
  return out
}

export function startRealtimeGateway(
  httpServer: HttpServer,
  store: PriceStore,
) {
  const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGIN } })

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData
    data.symbols = new Set()
    logger.info({ id: socket.id }, 'client connected')

    // Client tells us which symbols are on screen (one page / one coin).
    socket.on('prices:subscribe', (symbols: unknown) => {
      data.symbols = normalizeSymbols(symbols)
      socket.emit('prices:snapshot', snapshotFor(store, data.symbols))
      logger.debug(
        { id: socket.id, count: data.symbols.size },
        'prices:subscribe',
      )
    })
  })

  const timer = setInterval(() => {
    if (io.engine.clientsCount === 0) return
    const changes = store.takeChanges()
    if (changes.length === 0) return

    for (const socket of io.sockets.sockets.values()) {
      const watched = (socket.data as SocketData).symbols
      if (!watched || watched.size === 0) continue
      const filtered = changes.filter((p) => watched.has(p.symbol))
      if (filtered.length > 0) socket.emit('prices:update', filtered)
    }
  }, env.PUSH_INTERVAL_MS)

  return async () => {
    clearInterval(timer)
    await io.close()
  }
}
