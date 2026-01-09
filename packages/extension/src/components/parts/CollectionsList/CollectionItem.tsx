import { Folder, X } from 'lucide-react'
import { useState } from 'react'

import { getIconByName } from '@/components/ui/IconPicker'
import type { Bookmark, Collection } from '@/lib/types'

import BookmarkRow from '@/components/parts/BookmarkRow'
import ActionBtn from '@/components/ui/ActionBtn'
import Collapsible from '@/components/ui/Collapsible'
import IconPickerModal from '@/components/ui/IconPickerModal'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

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
  onIconChange?: (id: string, icon: string | undefined) => void
  containerRef: (el: HTMLDivElement | null) => void
  inputRef: (el: HTMLInputElement | null) => void
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
  onIconChange,
  containerRef,
  inputRef
}: CollectionItemProps) {
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const Icon = collection.icon ? getIconByName(collection.icon) : Folder

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

  return (
    <div ref={containerRef}>
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
              />
            ))}
          </div>
        )}
      </Collapsible>
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
