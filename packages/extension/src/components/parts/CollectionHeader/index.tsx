import { Folder, Inbox, Library, Trash2 } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'

import ActionBtn from '@/components/ui/ActionBtn'
import IconPickerModal from '@/components/ui/IconPickerModal'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface CollectionHeaderProps {
  collectionId: string | null
  onCollectionDeleted?: () => void
}

export default function CollectionHeader({
  collectionId,
  onCollectionDeleted
}: CollectionHeaderProps) {
  const { bookmarks } = useBookmarks()
  const { collections, updateCollection, deleteCollection } = useCollections()
  const { setFlash } = useNavigation()

  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const editingNameRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)

  const collection = collectionId
    ? collections.find((c) => c.id === collectionId)
    : null

  useEffect(() => {
    editingNameRef.current = editingName
  }, [editingName])

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  // Special case for "all" (no filter)
  if (!collectionId || collectionId === 'all') {
    return (
      <div className={styles.component}>
        <div className={styles.content}>
          <Library size={18} strokeWidth={2} className={styles.icon} />
          <Text as='span' size='3' weight='medium'>
            All Bookmarks
          </Text>
        </div>
      </div>
    )
  }

  // Special case for uncategorized
  if (collectionId === 'uncategorized') {
    return (
      <div className={styles.component}>
        <div className={styles.content}>
          <Inbox size={18} strokeWidth={2} className={styles.icon} />
          <Text as='span' size='3' weight='medium'>
            Uncategorized
          </Text>
        </div>
      </div>
    )
  }

  if (!collection) {
    return null
  }

  // Check if collection has bookmarks
  const hasBookmarks = bookmarks.some((b) => b.collectionId === collectionId)

  // Check if collection has children
  const hasChildren = collections.some((c) => c.parentId === collectionId)

  const canDelete = !hasBookmarks && !hasChildren

  const getIcon = (iconName?: string) => {
    if (!iconName) return Folder
    const Icon = (Icons as unknown as Record<string, typeof Folder>)[iconName]
    return Icon || Folder
  }

  const Icon = getIcon(collection.icon)

  const startEditing = () => {
    setEditingName(collection.name)
    setIsEditingName(true)
  }

  const saveEditing = async () => {
    const trimmedName = editingNameRef.current.trim()
    if (!trimmedName) {
      cancelEditing()
      return
    }
    try {
      await updateCollection(collection.id, { name: trimmedName })
    } catch (error) {
      setFlash(`Failed to update collection: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
    cancelEditing()
  }

  const cancelEditing = () => {
    setIsEditingName(false)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditing()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  const handleIconChange = async (icon: string | undefined) => {
    try {
      await updateCollection(collection.id, { icon })
    } catch (error) {
      setFlash(`Failed to update icon: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
    setIsIconModalOpen(false)
  }

  const handleDelete = async () => {
    if (!canDelete) {
      if (hasBookmarks) {
        setFlash('Cannot delete collection with bookmarks. Move or delete them first.')
      } else if (hasChildren) {
        setFlash('Cannot delete collection with sub-collections. Delete them first.')
      }
      setTimeout(() => setFlash(null), 5000)
      return
    }

    if (!confirm(`Delete "${collection.name}" collection?`)) {
      return
    }

    try {
      await deleteCollection(collection.id)
      onCollectionDeleted?.()
      setFlash('Collection deleted')
      setTimeout(() => setFlash(null), 3000)
    } catch (error) {
      setFlash(`Failed to delete: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div
          className={styles.iconButton}
          role='button'
          tabIndex={0}
          onClick={() => setIsIconModalOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && setIsIconModalOpen(true)}
          title='Change icon'
        >
          <Icon size={18} strokeWidth={2} className={styles.icon} />
        </div>
        {isEditingName ? (
          <input
            ref={inputRef}
            type='text'
            className={styles.input}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEditing}
          />
        ) : (
          <span className={styles.name} onClick={startEditing}>
            <Text as='span' size='3' weight='medium'>
              {collection.name}
            </Text>
          </span>
        )}
      </div>
      <ActionBtn
        icon={Trash2}
        size='sm'
        onClick={handleDelete}
        title={
          canDelete
            ? 'Delete collection'
            : hasBookmarks
              ? 'Cannot delete: has bookmarks'
              : 'Cannot delete: has sub-collections'
        }
        disabled={!canDelete}
      />
      <IconPickerModal
        open={isIconModalOpen}
        onClose={() => setIsIconModalOpen(false)}
        value={collection.icon}
        onChange={handleIconChange}
      />
    </div>
  )
}
