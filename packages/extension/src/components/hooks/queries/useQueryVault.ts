import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchVault,
  fetchVaultManifest,
  putVaultManifest,
  VaultManifestResponse,
  VaultResponse
} from '@/api/vault-api'
import { type ApiError } from '@/lib/api'
import {
  saveManifest as saveManifestFn,
  type SaveManifestInput,
  type SaveManifestResult
} from '@/lib/manifest'

const QUERY_KEYS = {
  vault: () => ['vault'] as const,
  manifest: () => ['vault', 'manifest'] as const,
  manifestSave: () => ['vault', 'manifest', 'save'] as const
}

const manifestApi = {
  save: putVaultManifest,
  fetch: fetchVaultManifest
}

export function useQueryVault() {
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
    staleTime: 0,
    retry: false
  })

  const prefetchVaultManifest = async () => {
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.manifest(),
      queryFn: fetchVaultManifest
    })

    const exist = queryClient.getQueryData(QUERY_KEYS.manifest())

    if (!exist) {
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

  const saveManifest = useMutation<
    SaveManifestResult,
    ApiError,
    SaveManifestInput
  >({
    mutationKey: QUERY_KEYS.manifestSave(),
    mutationFn: (input) => saveManifestFn(input, manifestApi)
  })

  return {
    getVault,
    getManifest,
    prefetchVaultManifest,
    saveManifest
  }
}

export default useQueryVault
