import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  fetchLogin,
  fetchRegister,
  RegisterInput,
  RegisterResponse,
  type LoginInput,
  type LoginResponse
} from '@/api/auth-api'
import { VaultManifestResponse } from '@/api/vault-api'
import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { ApiError } from '@/lib/api'
import { decryptManifest } from '@/lib/manifest'
import { unlock } from '@/lib/unlock'
import useQueryVault from './useQueryVault'

export const QUERY_KEYS = {
  login: () => ['auth', 'login'] as const,
  register: () => ['auth', 'register'] as const
}

export const useQueryAuth = () => {
  const { setSession } = useAuthSession()
  const { prefetchVaultManifest } = useQueryVault()
  const queryClient = useQueryClient()

  const login = useMutation<LoginResponse, ApiError, LoginInput>({
    mutationKey: QUERY_KEYS.login(),
    mutationFn: fetchLogin,
    onSuccess: async (data, variables) => {
      setSession(data)
      await prefetchVaultManifest()

      // Get the encrypted manifest to extract vault_id
      const encryptedManifest = queryClient.getQueryData<VaultManifestResponse>(
        ['vault', 'manifest']
      )

      // Unlock vault (derive keys and store MAK)
      await unlock({
        password: variables.password,
        userId: data.user_id,
        vaultId: encryptedManifest?.vault_id ?? data.user_id,
        kdf: data.kdf,
        wrappedMk: data.wrapped_mk
      })

      // Decrypt the manifest
      if (encryptedManifest) {
        const manifest = await decryptManifest(encryptedManifest)
        // Store decrypted manifest in query cache for components to use
        queryClient.setQueryData(['vault', 'manifest', 'decrypted'], manifest)
      }
    }
  })

  const register = useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationKey: QUERY_KEYS.register(),
    mutationFn: fetchRegister,
    onSuccess: async (_data, variables) => {
      // Login with the same credentials used for registration
      // handles session, prefetch, unlock and decrypt manifest
      await login.mutateAsync(variables)
    }
  })

  return {
    login,
    register
  }
}
