import { useEffect, useState } from 'react'

import { settingsStore } from '@/entrypoints/store/settings'

/**
 * Subscribe to the user's "show hidden tags" preference.
 */
export function useTagVisibilityPreference() {
  const [showHiddenTags, setShowHiddenTags] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      const currentState = await settingsStore.getState()
      if (!cancelled) {
        setShowHiddenTags(currentState.showHiddenTags)
        setIsReady(true)
      }
    }

    void loadSettings()

    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState()
      if (!cancelled) {
        setShowHiddenTags(state.showHiddenTags)
      }
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return { showHiddenTags, isReady }
}
