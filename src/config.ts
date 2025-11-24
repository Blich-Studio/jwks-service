import { MissingEnvironmentVariableError } from '@blich-studio/shared'
import { z } from 'zod'

const BaseSchema = z.object({
  PORT: z.coerce.number().default(3100),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_KID: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWKS_CACHE_MAX_AGE: z.coerce.number().default(300),
  TOKEN_API_KEY: z.string().min(32, 'TOKEN_API_KEY must be at least 32 characters').optional(),
  GOOGLE_PRIVATE_KEY_SECRET: z.string().optional(),
  LOCAL_PRIVATE_KEY: z.string().optional(),
  LOCAL_PUBLIC_KEY: z.string().optional(),
})

export interface AppConfig {
  port: number
  issuer: string
  audience: string
  kid: string
  expiresIn: string
  jwksCacheMaxAge: number
  tokenApiKey?: string
  googleSecretResource?: string
  localPrivateKey?: string
  localPublicKey?: string
}

const CONTEXT = 'JWKS Service'

export const loadConfig = (): AppConfig => {
  const result = BaseSchema.safeParse(process.env)

  if (!result.success) {
    const [{ path, message }] = result.error.issues
    throw new MissingEnvironmentVariableError(`${path.join('.')}: ${message}`, CONTEXT)
  }

  const {
    PORT,
    JWT_ISSUER,
    JWT_AUDIENCE,
    JWT_KID,
    JWT_EXPIRES_IN,
    JWKS_CACHE_MAX_AGE,
    TOKEN_API_KEY,
    GOOGLE_PRIVATE_KEY_SECRET,
    LOCAL_PRIVATE_KEY,
    LOCAL_PUBLIC_KEY,
  } = result.data

  if (!GOOGLE_PRIVATE_KEY_SECRET && (!LOCAL_PRIVATE_KEY || !LOCAL_PUBLIC_KEY)) {
    throw new MissingEnvironmentVariableError(
      'GOOGLE_PRIVATE_KEY_SECRET or both LOCAL_PRIVATE_KEY/LOCAL_PUBLIC_KEY must be provided',
      CONTEXT
    )
  }

  return {
    port: PORT,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    kid: JWT_KID,
    expiresIn: JWT_EXPIRES_IN,
    jwksCacheMaxAge: JWKS_CACHE_MAX_AGE,
    tokenApiKey: TOKEN_API_KEY,
    googleSecretResource: GOOGLE_PRIVATE_KEY_SECRET,
    localPrivateKey: LOCAL_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    localPublicKey: LOCAL_PUBLIC_KEY?.replace(/\\n/g, '\n'),
  }
}
