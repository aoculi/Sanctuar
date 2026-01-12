import { useState, useEffect, useRef } from 'react'
import { useAuthSession } from './providers/useAuthSessionProvider'
import { useUnlockState } from './providers/useUnlockStateProvider'
import { useManifest } from './providers/useManifestProvider'

export function useAppLoading() {
  const { isLoading: authLoading } = useAuthSession()
  const { isLoading: unlockLoading } = useUnlockState()
  const { isLoading: manifestLoading } = useManifest()

  const [isAppLoading, setIsAppLoading] = useState(true)
  const initialLoadComplete = useRef(false)

  useEffect(() => {
    if (initialLoadComplete.current) {
      return
    }

    const allLoaded = !authLoading && !unlockLoading && !manifestLoading

    if (allLoaded) {
      initialLoadComplete.current = true
      setIsAppLoading(false)
    }
  }, [authLoading, unlockLoading, manifestLoading])

  return isAppLoading
}
