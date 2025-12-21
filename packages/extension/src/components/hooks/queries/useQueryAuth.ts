import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  fetchLogin,
  fetchLogout,
  fetchRegister,
  RegisterInput,
  RegisterResponse,
  type LoginInput,
  type LoginResponse
} from '@/api/auth-api'
import { fetchVault, fetchVaultManifest } from '@/api/vault-api'
import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { saveManifestData } from '@/components/hooks/useManifest'
import { ApiError } from '@/lib/api'
import { decryptManifest } from '@/lib/manifest'
import { unlock } from '@/lib/unlock'

export const QUERY_KEYS = {
  login: () => ['auth', 'login'] as const,
  register: () => ['auth', 'register'] as const,
  logout: () => ['auth', 'logout'] as const
}

export type AuthPhase =
  | 'idle'
  | 'authenticating'
  | 'fetching'
  | 'unlocking'
  | 'decrypting'

export const useQueryAuth = () => {
  const { setSession, clearSession } = useAuthSession()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<AuthPhase>('idle')

  const login = useMutation<LoginResponse, ApiError, LoginInput>({
    mutationKey: QUERY_KEYS.login(),
    mutationFn: async (variables) => {
      // Phase 1: Authenticate
      setPhase('authenticating')
      const loginData = await fetchLogin(variables)

      // Set session immediately after login
      setSession(loginData)

      // Phase 2: Fetch manifest
      setPhase('fetching')
      let encryptedManifest = await fetchVaultManifest().catch(() => null)

      // If no manifest exists, create vault and try again
      if (!encryptedManifest) {
        await fetchVault()
        encryptedManifest = await fetchVaultManifest().catch(() => null)
      }

      // Phase 3: Unlock vault (derive keys)
      setPhase('unlocking')
      const unlockResult = await unlock({
        password: variables.password,
        userId: loginData.user_id,
        vaultId: loginData.user_id,
        kdf: loginData.kdf,
        wrappedMk: loginData.wrapped_mk
      })

      // Phase 4: Decrypt manifest
      if (encryptedManifest && !unlockResult.isFirstUnlock) {
        setPhase('decrypting')
        const manifest = await decryptManifest(encryptedManifest)
        await saveManifestData({
          manifest,
          etag: encryptedManifest.etag,
          serverVersion: encryptedManifest.version
        })
      }

      setPhase('idle')
      return loginData
    }
  })

  const register = useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationKey: QUERY_KEYS.register(),
    mutationFn: async (variables) => {
      // Phase 1: Register
      setPhase('authenticating')
      const registerData = await fetchRegister(variables)

      // After registration, perform login flow
      const loginData = await fetchLogin(variables)
      setSession(loginData)

      // Phase 2: Fetch manifest
      setPhase('fetching')
      let encryptedManifest = await fetchVaultManifest().catch(() => null)

      if (!encryptedManifest) {
        await fetchVault()
        encryptedManifest = await fetchVaultManifest().catch(() => null)
      }

      // Phase 3: Unlock vault
      setPhase('unlocking')
      const unlockResult = await unlock({
        password: variables.password,
        userId: loginData.user_id,
        vaultId: loginData.user_id,
        kdf: loginData.kdf,
        wrappedMk: loginData.wrapped_mk
      })

      // Phase 4: Decrypt manifest
      if (encryptedManifest && !unlockResult.isFirstUnlock) {
        setPhase('decrypting')
        const manifest = await decryptManifest(encryptedManifest)
        await saveManifestData({
          manifest,
          etag: encryptedManifest.etag,
          serverVersion: encryptedManifest.version
        })
      }

      setPhase('idle')
      return registerData
    }
  })

  const logout = useMutation<void, ApiError, void>({
    mutationKey: QUERY_KEYS.logout(),
    mutationFn: async () => {
      try {
        await fetchLogout()
      } catch (err: unknown) {
        // Ignore 401 errors during logout (already logged out server-side)
        if (
          err &&
          typeof err === 'object' &&
          'status' in err &&
          err.status !== 401
        ) {
          throw err
        }
      }
    },
    onSettled: async () => {
      // Clear session and storage (except settings)
      clearSession()
      // Clear all cached queries
      queryClient.clear()
    }
  })

  return {
    login,
    register,
    logout,
    phase
  }
}
