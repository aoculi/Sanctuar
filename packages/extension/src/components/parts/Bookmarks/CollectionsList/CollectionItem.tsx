import { ExternalLink, Folder, GripVertical, X } from 'lucide-react'
import { useState } from 'react'

import { getIconByName } from '@/components/ui/IconPicker'
import { openUrlsInTabs } from '@/lib/tabs'
import type { Bookmark, Collection } from '@/lib/types'

import BookmarkRow, {
  BOOKMARK_DRAG_TYPE
} from '@/components/parts/Bookmarks/BookmarkRow'
import ActionBtn from '@/components/ui/ActionBtn'
import Collapsible from '@/components/ui/Collapsible'
import IconPickerModal from '@/components/ui/IconPickerModal'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export type DropZone = 'above' | 'center' | 'below'
export type DragType = 'collection' | 'bookmark'

interface CollectionItemProps {
  collection: Collection
  bookmarks: Bookmark[]
  depth: number
  tags: Array<{ id: string; name: string }>
  isEditing: boolean
  editingName: string
  onStartEdit: (id: string, name: string) => void
  onSave: (id: string) => void
  onCancel: () => void
  onNameChange: (name: string) => void
  onTogglePin: (bookmark: Bookmark) => void
  onDelete: (id: string) => void
  onEdit?: (bookmark: Bookmark) => void
  onAddTags?: (bookmark: Bookmark) => void
  onIconChange?: (id: string, icon: string | undefined) => void
  containerRef: (el: HTMLDivElement | null) => void
  inputRef: (el: HTMLInputElement | null) => void
  draggable?: boolean
  isDragging?: boolean
  dropZone?: DropZone | null
  dropType?: DragType | null
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent, zone: DropZone, type: DragType) => void
  onDragLeave?: () => void
  onDrop?: (zone: DropZone, type: DragType, bookmarkId?: string) => void
  onDragEnd?: () => void
  draggedBookmarkId?: string | null
  onBookmarkDragStart?: (bookmarkId: string) => void
  onBookmarkDragEnd?: () => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export default function CollectionItem({
  collection,
  bookmarks,
  depth,
  tags,
  isEditing,
  editingName,
  onStartEdit,
  onSave,
  onCancel,
  onNameChange,
  onTogglePin,
  onDelete,
  onEdit,
  onAddTags,
  onIconChange,
  containerRef,
  inputRef,
  draggable = false,
  isDragging = false,
  dropZone = null,
  dropType = null,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  draggedBookmarkId,
  onBookmarkDragStart,
  onBookmarkDragEnd,
  selectedIds = new Set(),
  onToggleSelect
}: CollectionItemProps) {
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const Icon = collection.icon ? getIconByName(collection.icon) : Folder

  const getDragType = (e: React.DragEvent): DragType => {
    return e.dataTransfer.types.includes(BOOKMARK_DRAG_TYPE)
      ? 'bookmark'
      : 'collection'
  }

  const getZone = (e: React.DragEvent, dragType: DragType): DropZone => {
    // Bookmarks can only drop into center (move to collection)
    if (dragType === 'bookmark') return 'center'

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const threshold = rect.height * 0.25
    if (y < threshold) return 'above'
    if (y > rect.height - threshold) return 'below'
    return 'center'
  }

  // Only show drop zone class if it's a valid drop target
  const showDropZone =
    dropZone && (dropType === 'collection' || dropZone === 'center')
  const zoneClass = showDropZone
    ? styles[`drop${dropZone.charAt(0).toUpperCase() + dropZone.slice(1)}`]
    : ''

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave(collection.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onIconChange) {
      setIsIconModalOpen(true)
    }
  }

  const handleIconChange = (icon: string | undefined) => {
    if (onIconChange) {
      onIconChange(collection.id, icon)
    }
  }

  const handleOpenAllBookmarks = (e: React.MouseEvent) => {
    e.stopPropagation()
    openUrlsInTabs(bookmarks.map((bookmark) => bookmark.url))
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.collectionWrapper} ${isDragging ? styles.dragging : ''} ${zoneClass}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        const dragType = getDragType(e)
        const zone = getZone(e, dragType)
        onDragOver?.(e, zone, dragType)
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const dragType = getDragType(e)
        const zone = getZone(e, dragType)
        const bookmarkId =
          e.dataTransfer.getData(BOOKMARK_DRAG_TYPE) || undefined
        onDrop?.(zone, dragType, bookmarkId)
      }}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <div className={styles.dragHandle}>
          <GripVertical size={14} />
        </div>
      )}
      <div className={styles.collapsibleWrapper}>
        <Collapsible
          key={collection.id}
          icon={Icon}
          onIconClick={onIconChange ? handleIconClick : undefined}
          label={
            isEditing ? (
              <div className={styles.labelContent}>
                <div
                  className={styles.inputWrapper}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={inputRef}
                    type='text'
                    className={styles.input}
                    value={editingName}
                    onChange={(e) => onNameChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    placeholder='Collection name'
                  />
                </div>
                <ActionBtn
                  icon={X}
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel()
                  }}
                />
              </div>
            ) : (
              <div className={styles.labelContent}>
                <span
                  className={styles.collectionName}
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartEdit(collection.id, collection.name)
                  }}
                >
                  <Text as='span' size='2' weight='medium'>
                    {collection.name}
                  </Text>
                </span>
                {bookmarks.length > 0 && (
                  <ActionBtn
                    icon={ExternalLink}
                    size='sm'
                    onClick={handleOpenAllBookmarks}
                    title='Open all bookmarks in new tabs'
                  />
                )}
              </div>
            )
          }
          count={bookmarks.length}
          depth={depth}
          defaultOpen={false}
          editable={isEditing}
        >
          {bookmarks.length > 0 && (
            <div className={styles.bookmarksList}>
              {bookmarks.map((bookmark: Bookmark) => (
                <BookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  tags={tags}
                  onTogglePin={() => onTogglePin(bookmark)}
                  onEdit={onEdit ? () => onEdit(bookmark) : undefined}
                  onDelete={() => onDelete(bookmark.id)}
                  onAddTags={onAddTags ? () => onAddTags(bookmark) : undefined}
                  draggable
                  isDragging={draggedBookmarkId === bookmark.id}
                  onDragStart={() => onBookmarkDragStart?.(bookmark.id)}
                  onDragEnd={onBookmarkDragEnd}
                  selected={selectedIds.has(bookmark.id)}
                  onToggleSelect={
                    onToggleSelect
                      ? () => onToggleSelect(bookmark.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </Collapsible>
      </div>
      {onIconChange && (
        <IconPickerModal
          open={isIconModalOpen}
          onClose={() => setIsIconModalOpen(false)}
          value={collection.icon}
          onChange={handleIconChange}
        />
      )}
    </div>
  )
}
