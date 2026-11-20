import { Router } from 'express'
import { getCandles } from './market.candles.js'
import { candlesParamsSchema, candlesQuerySchema } from './market.schemas.js'
import { priceStore } from './market.store.js'

export const marketRouter = Router()

/**
 * GET /api/market/prices
 * GET /api/market/prices?symbols=BTC,ETH,SOL
 * Reads only from the in-memory store.
 */
marketRouter.get('/prices', (req, res) => {
  const raw = typeof req.query.symbols === 'string' ? req.query.symbols : ''
  res.setHeader('Cache-Control', 'no-store')

  if (!raw.trim()) {
    res.json(priceStore.all())
    return
  }

  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 100)

  res.json(
    symbols.flatMap((symbol) => {
      const price = priceStore.get(symbol)
      return price ? [price] : []
    }),
  )
})

// GET /api/market/candles/BTC?granularity=3600
marketRouter.get('/candles/:symbol', async (req, res) => {
  const { symbol } = candlesParamsSchema.parse(req.params)
  const { granularity } = candlesQuerySchema.parse(req.query)
  const candles = await getCandles(symbol, granularity)
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=240',
  )
  res.json({ symbol, granularity, candles })
})
