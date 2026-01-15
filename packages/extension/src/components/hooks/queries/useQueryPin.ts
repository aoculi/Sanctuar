/**
 * React Query hooks for PIN operations
 */

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { fetchVaultManifest } from '@/api/vault-api'
import {
  useManifest,
  saveManifestData
} from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { getLockState } from '@/lib/lockState'
import { decryptManifest } from '@/lib/manifest'
import type { LockState } from '@/lib/storage'
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

      // Phase 2: Fetch and decrypt manifest from server
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
