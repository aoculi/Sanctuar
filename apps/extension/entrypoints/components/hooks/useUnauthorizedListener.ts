import { useEffect } from 'react'

import { sessionManager } from '@/entrypoints/store/session'

type UnauthorizedHandler = () => void

/**
 * Subscribes to sessionManager unauthorized events with proper cleanup.
 */
export function useUnauthorizedListener(handler: UnauthorizedHandler) {
  useEffect(() => {
    if (!handler) return
    const unsubscribe = sessionManager.onUnauthorized(handler)
    return unsubscribe
  }, [handler])
}
