import { Router } from 'express'
import { getCoin, getCoins } from '../../config/coins.js'
import { notFound } from '../../lib/errors.js'
import { priceStore } from '../market/market.store.js'
import {
  parseCoinOrder,
  parseCoinSort,
  queryCoinsPage,
} from './coins.query.js'

export const coinsRouter = Router()

/**
 * GET /api/coins?limit=40&offset=0&sort=volume&order=desc&q=btc
 * One page of coins from the in-memory store (never hits KuCoin).
 */
coinsRouter.get('/', (req, res) => {
  const limit = Number(req.query.limit)
  const offset = Number(req.query.offset)
  const page = queryCoinsPage({
    limit: Number.isFinite(limit) ? limit : 40,
    offset: Number.isFinite(offset) ? offset : 0,
    sort: parseCoinSort(req.query.sort),
    order: parseCoinOrder(req.query.order),
    q: typeof req.query.q === 'string' ? req.query.q : '',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.json(page)
})

/** Lightweight symbol list for sitemap / SEO — no price payloads. */
coinsRouter.get('/symbols', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json(getCoins().map((c) => c.symbol))
})

// GET /api/coins/BTC
coinsRouter.get('/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase()
  const coin = getCoin(symbol)
  if (!coin) throw notFound('Coin not found')
  res.setHeader('Cache-Control', 'no-store')
  res.json({ ...coin, live: priceStore.get(symbol) ?? null })
})
