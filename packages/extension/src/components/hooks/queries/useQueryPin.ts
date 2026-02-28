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
import { type ApiError } from '@/lib/api'
import { STORAGE_KEYS } from '@/lib/constants'
import { getLockState } from '@/lib/lockState'
import { decryptManifest } from '@/lib/manifest'
import {
  clearStorageItem,
  getStorageItem,
  setStorageItem,
  type LockState
} from '@/lib/storage'
import { unlockWithPin } from '@/lib/unlock'

export const QUERY_KEYS = {
  unlockWithPin: () => ['pin', 'unlock'] as const
}

export type PinPhase = 'idle' | 'verifying' | 'unlocking' | 'loading'

/**
 * Re-lock the vault to restore a consistent locked state.
 * Called when PIN crypto succeeds but the subsequent manifest fetch fails,
 * preventing the extension from being stuck in a partial "unlocked" state.
 */
async function relockVault(): Promise<void> {
  await Promise.allSettled([
    setStorageItem(STORAGE_KEYS.IS_SOFT_LOCKED, true),
    clearStorageItem(STORAGE_KEYS.KEYSTORE)
  ])
}

export const useQueryPin = () => {
  const { setManifestFromLogin } = useManifest()
  const { setFlash, navigate } = useNavigation()
  const { session, clearSession } = useAuthSession()
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
      const currentSession = await getStorageItem<AuthSession>(STORAGE_KEYS.SESSION)
      if (currentSession && currentSession.expiresAt) {
        const timeUntilExpiry = currentSession.expiresAt - Date.now()
        // If token is expired or expires in less than 60 seconds, refresh it
        if (timeUntilExpiry <= 60000) {
          try {
            const refreshResponse = await fetchRefreshToken()
            const updatedSession: AuthSession = {
              ...currentSession,
              token: refreshResponse.token,
              expiresAt: refreshResponse.expires_at
            }
            await setStorageItem(STORAGE_KEYS.SESSION, updatedSession)
          } catch (error) {
            const apiError = error as ApiError
            if (apiError?.status === 401) {
              // Session is expired server-side — re-lock and surface the error
              await relockVault()
              const sessionExpiredError = new Error('Session expired. Please login again.')
              ;(sessionExpiredError as ApiError & Error).status = 401
              throw sessionExpiredError
            }
            // For other errors (network issues), continue and let the manifest
            // fetch attempt handle it
            console.warn('Token refresh failed in PIN unlock, continuing:', error)
          }
        }
      }

      // Phase 3: Fetch and decrypt manifest from server
      setPhase('loading')
      try {
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
      } catch (error) {
        // Re-lock the vault so the extension doesn't end up in an inconsistent
        // state where the keystore is set but no manifest is loaded.
        // The user will be prompted for their PIN again on next popup open.
        await relockVault()
        throw error
      }

      setPhase('idle')
      return result
    },
    onError: async (error: Error) => {
      setPhase('idle')
      const userId = session.userId || ''
      const state = await getLockState(userId)
      setLockState(state)

      // If the session expired, clear it and redirect to login
      if ((error as ApiError & Error).status === 401) {
        await clearSession('hard')
        setFlash('Your session has expired. Please login again.')
        navigate('/login')
      }
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
