import { useEffect, useRef } from 'react'

type Params<T extends { focus: () => void }> = {
  isOpen: boolean
  reset: () => void
  deps?: any[]
  focusRef?: React.RefObject<T | null>
}

/**
 * Run a reset function whenever a modal/drawer opens, optionally focusing an input.
 */
export function useResetOnOpen<
  T extends { focus: () => void } = { focus: () => void }
>({ isOpen, reset, deps = [], focusRef }: Params<T>) {
  const resetRef = useRef(reset)

  // Always keep latest reset handler
  useEffect(() => {
    resetRef.current = reset
  }, [reset])

  useEffect(() => {
    if (!isOpen) return

    resetRef.current?.()

    const target = focusRef?.current
    if (target) {
      setTimeout(() => {
        target.focus?.()
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, focusRef, ...deps])
}
