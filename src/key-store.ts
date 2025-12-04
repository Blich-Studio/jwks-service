import crypto from 'crypto'
import type { JWK, KeyLike } from 'jose'
import { importPKCS8, SignJWT } from 'jose'
import type { AppConfig } from './config.js'
import type { PrivateKeyProvider } from './secret-manager.js'
import type { TokenRequest } from './types.js'

export class KeyStore {
  private privateKey?: KeyLike

  private publicJwk?: JWK

  constructor(
    private readonly config: AppConfig,
    private readonly keyProvider: PrivateKeyProvider
  ) {}

  async initialize(): Promise<void> {
    const privateKeyPem = await this.keyProvider.getPrivateKeyPem()

    // Import private key for signing
    this.privateKey = await importPKCS8(privateKeyPem, 'RS256')
    
    // Extract public key from private key and convert to JWK
    const privateKey = crypto.createPrivateKey(privateKeyPem)
    const publicKey = crypto.createPublicKey(privateKey)
    const jwk = publicKey.export({ format: 'jwk' }) as JWK

    this.publicJwk = {
      ...jwk,
      use: 'sig',
      alg: 'RS256',
      kid: this.config.kid,
    }
  }

  async signToken(payload: TokenRequest): Promise<string> {
    if (!this.privateKey) {
      throw new Error('KeyStore not initialized')
    }

    return new SignJWT({
      role: payload.role,
      email: payload.email,
      displayName: payload.displayName,
      permissions: payload.permissions,
      metadata: payload.metadata,
    })
      .setProtectedHeader({ alg: 'RS256', kid: this.config.kid })
      .setIssuer(this.config.issuer)
      .setAudience(payload.audience ?? this.config.audience)
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(payload.expiresIn ?? this.config.expiresIn)
      .sign(this.privateKey)
  }

  getJwks(): { keys: JWK[] } {
    if (!this.publicJwk) {
      throw new Error('KeyStore not initialized')
    }

    return { keys: [this.publicJwk] }
  }

}
