import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchVault,
  fetchVaultManifest,
  VaultManifestResponse,
  VaultResponse
} from '@/api/vault-api'
import { type ApiError } from '@/lib/api'

const QUERY_KEYS = {
  vault: () => ['vault'] as const,
  manifest: () => ['vault', 'manifest'] as const
}

export default function useQueryVault() {
  const queryClient = useQueryClient()

  const getVault = useQuery<VaultResponse, ApiError>({
    queryKey: QUERY_KEYS.vault(),
    queryFn: fetchVault,
    enabled: false,
    staleTime: 0
  })

  const getManifest = useQuery<VaultManifestResponse, ApiError>({
    queryKey: QUERY_KEYS.manifest(),
    queryFn: fetchVaultManifest,
    enabled: false,
    staleTime: 0
  })

  const prefetchVaultManifest = async () => {
    // 1) Prefetch the manifest
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.manifest(),
      queryFn: fetchVaultManifest
    })

    const exist = queryClient.getQueryData(QUERY_KEYS.manifest())

    if (!exist) {
      // Prefetch Vault (lazy created by the api on call)
      await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.vault(),
        queryFn: fetchVault
      })

      await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: fetchVaultManifest
      })

      return true
    }
  }

  return {
    getVault,
    getManifest,
    prefetchVaultManifest
  }
}
