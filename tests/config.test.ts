import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { PRIVATE_KEY, PUBLIC_KEY } from './fixtures/keys.js'

const REQUIRED_ENV = {
  PORT: '4100',
  JWT_ISSUER: 'https://issuer.test',
  JWT_AUDIENCE: 'test-audience',
  JWT_KID: 'kid-test',
  JWT_EXPIRES_IN: '5m',
  JWKS_CACHE_MAX_AGE: '60',
  TOKEN_API_KEY: 'test-key-1234567890123456789012345',
  LOCAL_PRIVATE_KEY: PRIVATE_KEY.replace(/\n/g, '\\n'),
  LOCAL_PUBLIC_KEY: PUBLIC_KEY.replace(/\n/g, '\\n'),
}

const setEnv = (overrides: Partial<typeof REQUIRED_ENV> = {}): void => {
  const values = { ...REQUIRED_ENV, ...overrides }
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = value
  })
}

const clearEnv = (): void => {
  Object.keys(REQUIRED_ENV).forEach(key => {
    delete process.env[key]
  })
}

afterEach(() => {
  clearEnv()
})

describe('loadConfig', () => {
  it('parses environment variables and normalizes PEM values', () => {
    setEnv()

    const config = loadConfig()

    expect(config.port).toBe(4100)
    expect(config.localPrivateKey).toContain('\n')
    expect(config.localPublicKey).toContain('\n')
    expect(config.tokenApiKey).toBe('test-key-1234567890123456789012345')
  })

  it('throws when neither Secret Manager nor local pem pair is configured', () => {
    setEnv()
    delete process.env.LOCAL_PRIVATE_KEY
    delete process.env.LOCAL_PUBLIC_KEY

    expect(() => loadConfig()).toThrowError(/must be provided/)
  })
})
