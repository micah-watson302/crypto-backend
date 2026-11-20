import { createServer } from 'node:http'
import { createApp } from './app.js'
import { FALLBACK_COINS, setCoins } from './config/coins.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import {
  loadCoinsFromKucoin,
  startCoinsRefresh,
} from './modules/coins/coins.loader.js'
import { warmPopularCandles } from './modules/market/market.candles.js'
import { startMarketFeed } from './modules/market/market.feed.js'
import { priceStore } from './modules/market/market.store.js'
import { startRealtimeGateway } from './modules/realtime/realtime.gateway.js'

async function bootstrap() {
  try {
    await loadCoinsFromKucoin()
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      'could not load KuCoin markets; using fallback coin list',
    )
    setCoins(FALLBACK_COINS)
  }

  const httpServer = createServer(createApp())
  const stopFeed = startMarketFeed(priceStore)
  const stopGateway = startRealtimeGateway(httpServer, priceStore)
  const stopRefresh = startCoinsRefresh()
  warmPopularCandles()

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API listening')
  })

  async function shutdown(signal: string) {
    logger.info({ signal }, 'shutting down')
    setTimeout(() => process.exit(1), 10_000).unref() // force exit if stuck
    stopRefresh()
    stopFeed()
    await stopGateway()
    httpServer.close(() => process.exit(0))
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

void bootstrap().catch((err) => {
  logger.fatal({ err: (err as Error).message }, 'failed to start')
  process.exit(1)
})
