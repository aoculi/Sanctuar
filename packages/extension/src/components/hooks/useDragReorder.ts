import { useCallback, useState } from 'react'

export type DropZone = 'above' | 'center' | 'below'
export type SimpleDropZone = 'above' | 'below'

interface DropTarget<T extends string> {
  id: string
  zone: T
}

interface UseDragReorderOptions {
  /** Include 'center' zone for nesting (collections) */
  includeCenter?: boolean
}

/**
 * Generic hook for drag and drop reordering
 */
export function useDragReorder<T extends DropZone | SimpleDropZone = SimpleDropZone>(
  options: UseDragReorderOptions = {}
) {
  const { includeCenter = false } = options
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget<T> | null>(null)

  const getDropZone = useCallback(
    (e: React.DragEvent): T => {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top

      if (includeCenter) {
        const threshold = rect.height * 0.25
        if (y < threshold) return 'above' as T
        if (y > rect.height - threshold) return 'below' as T
        return 'center' as T
      }

      return (y < rect.height / 2 ? 'above' : 'below') as T
    },
    [includeCenter]
  )

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      if (draggedId && draggedId !== targetId) {
        const zone = getDropZone(e)
        setDropTarget({ id: targetId, zone })
      }
    },
    [draggedId, getDropZone]
  )

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const clearDragState = useCallback(() => {
    setDraggedId(null)
    setDropTarget(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    clearDragState()
  }, [clearDragState])

  const isDragging = useCallback(
    (id: string) => draggedId === id,
    [draggedId]
  )

  const getDropZoneForTarget = useCallback(
    (id: string): T | null => {
      if (dropTarget?.id !== id) return null
      return dropTarget.zone
    },
    [dropTarget]
  )

  return {
    draggedId,
    dropTarget,
    getDropZone,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    clearDragState,
    isDragging,
    getDropZoneForTarget
  }
}
