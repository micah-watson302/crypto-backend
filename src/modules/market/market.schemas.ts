import { z } from 'zod'
import { isKnownSymbol } from '../../config/coins.js'

export const GRANULARITIES = [60, 300, 900, 3600, 21600, 86400] as const

export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((s) => isKnownSymbol(s), {
    message: 'Unknown coin symbol',
  })

export const candlesParamsSchema = z.object({ symbol: symbolSchema })

export const candlesQuerySchema = z.object({
  granularity: z.coerce
    .number()
    .refine((g) => (GRANULARITIES as readonly number[]).includes(g), {
      message: `granularity must be one of ${GRANULARITIES.join(', ')}`,
    })
    .default(3600),
})
