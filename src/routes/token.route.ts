import crypto from 'crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import type { KeyStore } from '../key-store.js'
import type { TokenRequest } from '../types.js'

const tokenRequestSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['admin', 'writer', 'reader']),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120).optional(),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  audience: z.union([z.string(), z.array(z.string())]).optional(),
  expiresIn: z.string().optional(),
})

export const registerTokenRoute = (
  app: FastifyInstance,
  keyStore: KeyStore,
  config: AppConfig
): void => {
  app.post('/token', async (request, reply) => {
    if (config.tokenApiKey) {
      const rawHeader = request.headers['x-api-key']
      const providedKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

      // DEBUG logging
      app.log.info({
        hasTokenApiKey: !!config.tokenApiKey,
        tokenApiKeyLength: config.tokenApiKey?.length,
        hasProvidedKey: !!providedKey,
        providedKeyLength: providedKey?.length,
      })

      // Use a timing-safe comparison to avoid leaking API key validity via response timing.
      // Hash both values to a fixed length and compare digests with crypto.timingSafeEqual.
      const providedDigest = crypto
        .createHash('sha256')
        .update(providedKey ?? '')
        .digest()
      const expectedDigest = crypto.createHash('sha256').update(config.tokenApiKey).digest()

      let authorized = false
      try {
        authorized = crypto.timingSafeEqual(providedDigest, expectedDigest)
      } catch (_err) {
        // timingSafeEqual throws if buffers are of different lengths; hashes are same length so shouldn't occur,
        // but defensively treat as unauthorized on error.
        authorized = false
      }

      app.log.info({ authorized })

      if (!authorized) {
        reply.code(401)
        return { error: 'Unauthorized' }
      }
    }

    const parsed = tokenRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      reply.code(400)
      return { error: parsed.error.flatten() }
    }

    const payload = parsed.data as TokenRequest
    const token = await keyStore.signToken(payload)

    return {
      token,
      expiresIn: payload.expiresIn ?? config.expiresIn,
      kid: config.kid,
      issuer: config.issuer,
      audience: payload.audience ?? config.audience,
    }
  })
}
