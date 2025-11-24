import { importSPKI, jwtVerify } from 'jose'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config.js'
import { KeyStore } from '../src/key-store.js'
import { PrivateKeyProvider } from '../src/secret-manager.js'
import { PRIVATE_KEY, PUBLIC_KEY } from './fixtures/keys.js'

const createConfig = (): AppConfig => ({
  port: 0,
  issuer: 'https://issuer.test',
  audience: 'test-audience',
  kid: 'unit-test-kid',
  expiresIn: '5m',
  jwksCacheMaxAge: 60,
  tokenApiKey: undefined,
  googleSecretResource: undefined,
  localPrivateKey: PRIVATE_KEY,
  localPublicKey: PUBLIC_KEY,
})

describe('KeyStore', () => {
  let keyStore: KeyStore

  beforeEach(async () => {
    const config = createConfig()
    const provider = new PrivateKeyProvider(config)
    keyStore = new KeyStore(config, provider)
    await keyStore.initialize()
  })

  it('builds a JWKS with the configured kid', () => {
    const jwks = keyStore.getJwks()

    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0]?.kid).toBe('unit-test-kid')
  })

  it('signs JWTs that can be verified with the public key', async () => {
    const token = await keyStore.signToken({
      sub: 'user-1',
      role: 'admin',
      email: 'user@test.com',
      displayName: 'Unit Test',
      permissions: ['blog:write'],
      metadata: { team: 'platform' },
    })

    const publicKey = await importSPKI(PUBLIC_KEY, 'RS256')
    const result = await jwtVerify(token, publicKey, {
      issuer: 'https://issuer.test',
      audience: 'test-audience',
    })

    expect(result.payload.sub).toBe('user-1')
    expect(result.payload.role).toBe('admin')
  })
})
