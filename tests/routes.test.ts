import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { importSPKI, jwtVerify } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config.js'
import { KeyStore } from '../src/key-store.js'
import { registerJwksRoute } from '../src/routes/jwks.route.js'
import { registerTokenRoute } from '../src/routes/token.route.js'
import { PrivateKeyProvider } from '../src/secret-manager.js'
import { PRIVATE_KEY, PUBLIC_KEY } from './fixtures/keys.js'

const createConfig = (): AppConfig => ({
  port: 0,
  issuer: 'https://issuer.test',
  audience: 'test-audience',
  kid: 'integration-test-kid',
  expiresIn: '15m',
  jwksCacheMaxAge: 120,
  tokenApiKey: 'integration-api-key-123456789012345678',
  googleSecretResource: undefined,
  localPrivateKey: PRIVATE_KEY,
  localPublicKey: PUBLIC_KEY,
})

describe('Fastify routes', () => {
  const config = createConfig()
  const provider = new PrivateKeyProvider(config)
  const keyStore = new KeyStore(config, provider)
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    await keyStore.initialize()

    await app.register(helmet)
    await app.register(cors, { origin: false })
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

    app.get('/health', () => ({ status: 'ok' }))

    registerJwksRoute(app, keyStore, config)
    registerTokenRoute(app, keyStore, config)
  })

  afterAll(async () => {
    await app.close()
  })

  it('responds with ok on /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('returns JWKS document', async () => {
    const response = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ keys: Array<{ kid: string }> }>()
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0]?.kid).toBe('integration-test-kid')
  })

  it('rejects /token without API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/token',
      payload: { sub: '123', role: 'admin' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('issues JWTs when API key is provided', async () => {
    const payload = {
      sub: 'user-55',
      role: 'writer' as const,
      email: 'writer@test.com',
    }
    const response = await app.inject({
      method: 'POST',
      url: '/token',
      headers: { 'x-api-key': config.tokenApiKey },
      payload,
    })

    expect(response.statusCode).toBe(200)
    const json = response.json<{ token: string }>()
    expect(json.token).toBeTypeOf('string')

    const publicKey = await importSPKI(PUBLIC_KEY, 'RS256')
    const verified = await jwtVerify(json.token, publicKey, {
      issuer: config.issuer,
      audience: config.audience,
    })

    expect(verified.payload.sub).toBe(payload.sub)
    expect(verified.payload.role).toBe('writer')
  })
})
