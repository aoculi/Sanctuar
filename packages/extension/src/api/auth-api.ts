import { apiClient } from '@/lib/api'

/**
 * KDF (Key Derivation Function) parameters
 */
export type KdfParams = {
  algo: string
  salt: string
  m: number
  t: number
  p: number
  hkdf_salt?: string | null
}

export type RegisterResponse = {
  user_id: string
  kdf: KdfParams
}

export type RegisterInput = {
  login: string
  password: string
}

export const fetchRegister = (input: RegisterInput) =>
  apiClient<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input
  }).then((r) => r.data)

export type LoginInput = {
  login: string
  password: string
}

export type LoginResponse = {
  user_id: string
  token: string
  expires_at: number
  created_at: number
  kdf: KdfParams
  wrapped_mk: string | null
}

export const fetchLogin = (input: LoginInput) =>
  apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input
  }).then((r) => r.data)

export const fetchLogout = () => apiClient('/auth/logout', { method: 'POST' })

export type SessionResponse = {
  user_id: string
  valid: boolean
  expires_at: number
}

export type RefreshTokenResponse = {
  token: string
  expires_at: number
  created_at: number
}

export const fetchSession = () =>
  apiClient<SessionResponse>('/auth/session').then((r) => r.data)

export const fetchRefreshToken = () =>
  apiClient<RefreshTokenResponse>('/auth/refresh', {
    method: 'POST'
  }).then((r) => r.data)
