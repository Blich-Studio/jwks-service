import type { FastifyInstance } from 'fastify'
import type { AppConfig } from '../config.js'
import type { KeyStore } from '../key-store.js'

export const registerJwksRoute = (
  app: FastifyInstance,
  keyStore: KeyStore,
  config: AppConfig
): void => {
  app.get('/.well-known/jwks.json', async (_request, reply) => {
    const jwks = keyStore.getJwks()
    reply.header('Cache-Control', `public, max-age=${config.jwksCacheMaxAge}`)
    return jwks
  })
}
