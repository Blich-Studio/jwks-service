import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import type { AppConfig } from './config.js'

export class PrivateKeyProvider {
  private readonly client = new SecretManagerServiceClient()

  private cachedPem?: Promise<string>

  constructor(private readonly config: AppConfig) {}

  async getPrivateKeyPem(): Promise<string> {
    this.cachedPem ??= this.loadPrivateKey()

    return this.cachedPem
  }

  private async loadPrivateKey(): Promise<string> {
    if (this.config.googleSecretResource) {
      const [version] = await this.client.accessSecretVersion({
        name: this.config.googleSecretResource,
      })

      const payload = version.payload?.data?.toString()

      if (!payload) {
        throw new Error('Secret Manager returned an empty payload for the private key')
      }

      return payload
    }

    if (!this.config.localPrivateKey) {
      throw new Error('LOCAL_PRIVATE_KEY not provided')
    }

    return this.config.localPrivateKey
  }
}
