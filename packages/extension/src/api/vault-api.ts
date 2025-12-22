import { apiClient } from '@/lib/api'

export type VaultResponse = {
  vault_id: string
  version: number
  bytes_total: number
  has_manifest: boolean
  updated_at: number
}

export const fetchVault = () =>
  apiClient<VaultResponse>('/vault').then((r) => r.data)

export type VaultManifestResponse = {
  vault_id: string
  version: number
  etag: string
  nonce: string
  ciphertext: string
  size?: number
  updated_at: number
}

export const fetchVaultManifest = () =>
  apiClient<VaultManifestResponse>('/vault/manifest').then((r) => r.data)

export type VaultManifestUpdateResponse = {
  vault_id: string
  version: number
  etag: string
  updated_at: number
}

export type VaultManifestUpdateInput = {
  body: VaultManifestUpdateBody
  headers?: Record<string, string>
}

export type VaultManifestUpdateBody = {
  version: number
  nonce: string
  ciphertext: string
}

export const putVaultManifest = ({ body, headers }: VaultManifestUpdateInput) =>
  apiClient<VaultManifestUpdateResponse>('/vault/manifest', {
    method: 'PUT',
    body,
    headers
  }).then((r) => r.data)
