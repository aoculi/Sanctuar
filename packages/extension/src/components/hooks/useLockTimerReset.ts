import { useCallback, useEffect, useRef } from 'react'

import { resetLockTimer } from '@/lib/unlock'

const DEBOUNCE_MS = 60000 // 60 seconds

/**
 * Hook that resets the auto-lock timer on user interaction
 * Debounced to avoid excessive storage writes
 */
export function useLockTimerReset() {
  const lastResetRef = useRef(0)

  const handleInteraction = useCallback(() => {
    const now = Date.now()
    if (now - lastResetRef.current > DEBOUNCE_MS) {
      lastResetRef.current = now
      resetLockTimer()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('click', handleInteraction)
    document.addEventListener('keydown', handleInteraction)
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [handleInteraction])
}
