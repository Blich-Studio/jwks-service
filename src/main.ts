import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { loadConfig } from './config.js'
import { KeyStore } from './key-store.js'
import { registerJwksRoute } from './routes/jwks.route.js'
import { registerTokenRoute } from './routes/token.route.js'
import { PrivateKeyProvider } from './secret-manager.js'

const bootstrap = async (): Promise<void> => {
  const config = loadConfig()
  const keyProvider = new PrivateKeyProvider(config)
  const keyStore = new KeyStore(config, keyProvider)
  await keyStore.initialize()

  const app = Fastify({ logger: true })

  await app.register(helmet)
  await app.register(cors, { origin: false })
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })

  app.get('/health', () => ({ status: 'ok' }))

  registerJwksRoute(app, keyStore, config)
  registerTokenRoute(app, keyStore, config)

  await app.listen({ port: config.port, host: '0.0.0.0' })
}

bootstrap().catch(error => {
  console.error('Failed to start JWKS service', error)
  process.exit(1)
})
