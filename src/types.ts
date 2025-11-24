export type UserRole = 'admin' | 'writer' | 'reader'

export interface TokenRequest {
  sub: string
  role: UserRole
  email?: string
  displayName?: string
  permissions?: string[]
  metadata?: Record<string, unknown>
  audience?: string | string[]
  expiresIn?: string
}
