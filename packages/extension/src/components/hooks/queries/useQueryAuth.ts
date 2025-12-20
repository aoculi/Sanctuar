import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  fetchLogin,
  fetchRegister,
  RegisterInput,
  RegisterResponse,
  type LoginInput,
  type LoginResponse
} from '@/api/auth-api'
import { fetchVault, fetchVaultManifest } from '@/api/vault-api'
import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { ApiError } from '@/lib/api'
import { STORAGE_KEYS } from '@/lib/constants'
import { decryptManifest } from '@/lib/manifest'
import { setStorageItem } from '@/lib/storage'
import { unlock } from '@/lib/unlock'

export const QUERY_KEYS = {
  login: () => ['auth', 'login'] as const,
  register: () => ['auth', 'register'] as const
}

export type AuthPhase =
  | 'idle'
  | 'authenticating'
  | 'fetching'
  | 'unlocking'
  | 'decrypting'

export const useQueryAuth = () => {
  const { setSession } = useAuthSession()
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

      // Cache the encrypted manifest
      // if (encryptedManifest) {
      //   queryClient.setQueryData(['vault', 'manifest'], encryptedManifest)
      // }

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
        setStorageItem(STORAGE_KEYS.MANIFEST, manifest)
        // queryClient.setQueryData(['vault', 'manifest', 'decrypted'], manifest)
        // console.log('decrypting in query', manifest)
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

      // if (encryptedManifest) {
      //   queryClient.setQueryData(['vault', 'manifest'], encryptedManifest)
      // }

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
        setStorageItem(STORAGE_KEYS.MANIFEST, manifest)
        // queryClient.setQueryData(['vault', 'manifest', 'decrypted'], manifest)
      }

      setPhase('idle')
      return registerData
    }
  })

  return {
    login,
    register,
    phase
  }
}
