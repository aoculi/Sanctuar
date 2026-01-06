import { Edit, Folder, GripVertical, Trash2 } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { getIconByName } from '@/components/ui/IconPicker'
import type { Collection } from '@/lib/types'

import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export type DropZone = 'above' | 'center' | 'below'

type Props = {
  collection: Collection
  bookmarkCount: number
  onDelete?: (id: string) => void
  depth?: number
  draggable?: boolean
  isDragging?: boolean
  dropZone?: DropZone | null
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent, zone: DropZone) => void
  onDragLeave?: () => void
  onDrop?: (zone: DropZone) => void
  onDragEnd?: () => void
}

export function CollectionCard({
  collection,
  bookmarkCount,
  onDelete,
  depth = 0,
  draggable = false,
  isDragging = false,
  dropZone = null,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: Props) {
  const { navigate } = useNavigation()
  const Icon = collection.icon ? getIconByName(collection.icon) : Folder

  const getZone = (e: React.DragEvent): DropZone => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const threshold = rect.height * 0.25
    if (y < threshold) return 'above'
    if (y > rect.height - threshold) return 'below'
    return 'center'
  }

  const zoneClass = dropZone
    ? styles[`drop${dropZone.charAt(0).toUpperCase() + dropZone.slice(1)}`]
    : ''

  return (
    <div
      className={`${styles.component} ${isDragging ? styles.dragging : ''} ${zoneClass}`}
      style={{ paddingLeft: `${depth * 20}px` }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver?.(e, getZone(e))
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.(getZone(e))
      }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.card}>
        {draggable && (
          <div className={styles.dragHandle}>
            <GripVertical size={14} />
          </div>
        )}
        <div className={styles.content}>
          <div className={styles.collectionInfo}>
            <Icon size={16} className={styles.icon} />
            <Text size='2' weight='medium' className={styles.name}>
              {collection.name}
            </Text>
            {bookmarkCount > 0 && (
              <span className={styles.badge}>{bookmarkCount}</span>
            )}
          </div>
          <div className={styles.tagInfo}>
            <Text size='1' color='light'>
              {collection.tagFilter.tagIds.length} tag
              {collection.tagFilter.tagIds.length !== 1 ? 's' : ''} •{' '}
              {collection.tagFilter.mode === 'any' ? 'Match any' : 'Match all'}
            </Text>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            asIcon
            color='dark'
            onClick={(e) => {
              e.stopPropagation()
              navigate('/collection', { collection: collection.id })
            }}
            title='Edit'
          >
            <Edit size={16} />
          </Button>
          {onDelete && (
            <Button
              asIcon
              color='dark'
              onClick={(e) => {
                e.stopPropagation()
                onDelete(collection.id)
              }}
              title='Delete'
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
