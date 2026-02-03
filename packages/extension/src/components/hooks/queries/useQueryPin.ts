/**
 * React Query hooks for PIN operations
 */

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { fetchRefreshToken } from '@/api/auth-api'
import { fetchVaultManifest } from '@/api/vault-api'
import {
  useManifest,
  saveManifestData
} from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import {
  useAuthSession,
  type AuthSession
} from '@/components/hooks/providers/useAuthSessionProvider'
import { STORAGE_KEYS } from '@/lib/constants'
import { getLockState } from '@/lib/lockState'
import { decryptManifest } from '@/lib/manifest'
import { getStorageItem, setStorageItem, type LockState } from '@/lib/storage'
import { unlockWithPin } from '@/lib/unlock'

export const QUERY_KEYS = {
  unlockWithPin: () => ['pin', 'unlock'] as const
}

export type PinPhase = 'idle' | 'verifying' | 'unlocking' | 'loading'

export const useQueryPin = () => {
  const { setManifestFromLogin } = useManifest()
  const { setFlash } = useNavigation()
  const { session } = useAuthSession()
  const [phase, setPhase] = useState<PinPhase>('idle')
  const [lockState, setLockState] = useState<LockState | null>(null)

  const unlockWithPinMutation = useMutation({
    mutationKey: QUERY_KEYS.unlockWithPin(),
    retry: false,
    onMutate: async () => {
      setFlash(null)
      const userId = session.userId || ''
      const state = await getLockState(userId)
      setLockState(state)
    },
    mutationFn: async (pin: string) => {
      // Phase 1: Verify PIN and decrypt MAK (restores keystore)
      setPhase('verifying')
      const result = await unlockWithPin(pin)

      // Phase 2: Check if token needs refresh before API calls
      // This handles the case where the token expired while popup was closed
      const session = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
      if (session && session.expiresAt) {
        const timeUntilExpiry = session.expiresAt - Date.now()
        // If token is expired or expires in less than 60 seconds, refresh it
        if (timeUntilExpiry <= 60000) {
          try {
            const refreshResponse = await fetchRefreshToken()
            const updatedSession: AuthSession = {
              ...session,
              token: refreshResponse.token,
              expiresAt: refreshResponse.expires_at
            }
            await setStorageItem(STORAGE_KEYS.SESSION, updatedSession)
          } catch (error) {
            // If refresh fails (e.g., no connection), we'll try the API call anyway
            // The API call will fail with 401 if token is truly invalid
            console.warn('Token refresh failed in PIN unlock, continuing:', error)
          }
        }
      }

      // Phase 3: Fetch and decrypt manifest from server
      setPhase('loading')
      const vaultManifestResponse = await fetchVaultManifest()
      const decryptedManifest = await decryptManifest(vaultManifestResponse)

      // Save to storage and set in provider
      const manifestData = {
        manifest: decryptedManifest,
        etag: vaultManifestResponse.etag,
        serverVersion: vaultManifestResponse.version
      }
      await saveManifestData(manifestData)
      setManifestFromLogin(manifestData)

      setPhase('idle')
      return result
    },
    onError: async () => {
      setPhase('idle')
      const userId = session.userId || ''
      const state = await getLockState(userId)
      setLockState(state)
    },
    onSuccess: () => {
      setPhase('idle')
    }
  })

  return {
    unlockWithPin: unlockWithPinMutation,
    phase,
    lockState
  }
}
