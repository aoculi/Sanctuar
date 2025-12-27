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
import {
  saveManifestData,
  useManifest
} from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
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
  const { setManifestFromLogin, clear: clearManifest } = useManifest()
  const { setFlash } = useNavigation()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<AuthPhase>('idle')

  const login = useMutation<LoginResponse, ApiError, LoginInput>({
    mutationKey: QUERY_KEYS.login(),
    retry: false,
    onMutate: () => {
      setFlash(null)
    },
    mutationFn: async (variables) => {
      // Phase 1: Authenticate
      setPhase('authenticating')
      const loginData = await fetchLogin(variables)

      // Set session immediately after login
      await setSession(loginData)

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
      await unlock({
        password: variables.password,
        userId: loginData.user_id,
        vaultId: loginData.user_id,
        kdf: loginData.kdf,
        wrappedMk: loginData.wrapped_mk
      })

      // Phase 4: Decrypt manifest (if it exists)
      if (encryptedManifest) {
        setPhase('decrypting')
        const manifest = await decryptManifest(encryptedManifest)
        const manifestData = {
          manifest,
          etag: encryptedManifest.etag,
          serverVersion: encryptedManifest.version
        }
        await saveManifestData(manifestData)
        setManifestFromLogin(manifestData)
      }

      setPhase('idle')
      return loginData
    }
  })

  const register = useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationKey: QUERY_KEYS.register(),
    retry: false,
    onMutate: () => {
      setFlash(null)
    },
    mutationFn: async (variables) => {
      // Phase 1: Register
      setPhase('authenticating')
      const registerData = await fetchRegister(variables)

      // After registration, perform login flow
      const loginData = await fetchLogin(variables)
      await setSession(loginData)

      // Phase 2: Fetch manifest
      setPhase('fetching')
      let encryptedManifest = await fetchVaultManifest().catch(() => null)
      if (!encryptedManifest) {
        await fetchVault()
        encryptedManifest = await fetchVaultManifest().catch(() => null)
      }

      // Phase 3: Unlock vault
      setPhase('unlocking')
      await unlock({
        password: variables.password,
        userId: loginData.user_id,
        vaultId: loginData.user_id,
        kdf: loginData.kdf,
        wrappedMk: loginData.wrapped_mk
      })

      // Phase 4: Decrypt manifest (if it exists)
      if (encryptedManifest) {
        setPhase('decrypting')
        const manifest = await decryptManifest(encryptedManifest)
        const manifestData = {
          manifest,
          etag: encryptedManifest.etag,
          serverVersion: encryptedManifest.version
        }
        await saveManifestData(manifestData)
        setManifestFromLogin(manifestData)
      }

      setPhase('idle')
      return registerData
    }
  })

  const logout = useMutation<void, ApiError, void>({
    mutationKey: QUERY_KEYS.logout(),
    onMutate: () => {
      setFlash(null)
    },
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
      await clearSession()
      clearManifest()
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
