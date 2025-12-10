import { useEffect } from 'react'

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
  useEffect(() => {
    if (!isOpen) return

    reset()

    const target = focusRef?.current
    if (target) {
      setTimeout(() => {
        target.focus?.()
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset, focusRef, ...deps])
}
