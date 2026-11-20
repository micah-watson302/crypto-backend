import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://127.0.0.1:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  PUSH_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  // Freshness window for candle cache; stale data may still be served longer
  CANDLE_TTL_MS: z.coerce.number().int().positive().default(300_000),
})

const checked = schema.superRefine((cfg, ctx) => {
  if (cfg.NODE_ENV !== 'production') return
  const localOnly = cfg.CORS_ORIGIN.every(
    (o) => o.includes('localhost') || o.includes('127.0.0.1'),
  )
  if (cfg.CORS_ORIGIN.length === 0 || localOnly) {
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGIN'],
      message: 'Set CORS_ORIGIN to your real frontend URL in production',
    })
  }
})

const parsed = checked.safeParse(process.env)

if (!parsed.success) {
  // Fail fast: a misconfigured server should never start
  console.error('Invalid environment:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
