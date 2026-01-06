import { useMemo, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import {
  countBookmarksPerCollection,
  flattenCollectionsWithDepth,
  handleCollectionDrop
} from '@/lib/collectionUtils'

import {
  CollectionCard,
  type DropZone
} from '@/components/parts/Collections/CollectionCard'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function CollectionList() {
  const { manifest, save } = useManifest()
  const { bookmarks } = useBookmarks()
  const { setFlash } = useNavigation()

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{
    id: string
    zone: DropZone
  } | null>(null)

  const collections = manifest?.collections || []

  const bookmarkCounts = useMemo(
    () => countBookmarksPerCollection(collections, bookmarks),
    [collections, bookmarks]
  )

  const collectionsWithDepth = useMemo(
    () => flattenCollectionsWithDepth(collections),
    [collections]
  )

  const handleDelete = async (id: string) => {
    const collection = collections.find((c) => c.id === id)
    if (!collection || !manifest) return

    if (!confirm(`Delete the collection "${collection.name}"?`)) return

    try {
      await save({
        ...manifest,
        collections: collections.filter((c) => c.id !== id)
      })
    } catch (error) {
      setFlash(`Failed to delete: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  const handleDrop = async (targetId: string, zone: DropZone) => {
    if (!draggedId || !manifest || draggedId === targetId) {
      setDraggedId(null)
      setDragOver(null)
      return
    }

    const result = handleCollectionDrop(collections, draggedId, targetId, zone)

    if ('error' in result) {
      setFlash(result.error)
      setTimeout(() => setFlash(null), 3000)
    } else {
      try {
        await save({ ...manifest, collections: result })
      } catch (error) {
        setFlash(`Failed to move: ${(error as Error).message}`)
        setTimeout(() => setFlash(null), 5000)
      }
    }

    setDraggedId(null)
    setDragOver(null)
  }

  const clearDragState = () => {
    setDraggedId(null)
    setDragOver(null)
  }

  if (collectionsWithDepth.length === 0) {
    return (
      <div className={styles.container}>
        <Text size='2' color='light' style={{ padding: '20px 20px 0' }}>
          No collections yet. Click the + button to create one.
        </Text>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {collectionsWithDepth.map(({ collection, depth }) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            bookmarkCount={bookmarkCounts.get(collection.id) || 0}
            onDelete={handleDelete}
            depth={depth}
            draggable
            isDragging={draggedId === collection.id}
            dropZone={dragOver?.id === collection.id ? dragOver.zone : null}
            onDragStart={() => setDraggedId(collection.id)}
            onDragOver={(_, zone) =>
              draggedId &&
              draggedId !== collection.id &&
              setDragOver({ id: collection.id, zone })
            }
            onDragLeave={() => setDragOver(null)}
            onDrop={(zone) => handleDrop(collection.id, zone)}
            onDragEnd={clearDragState}
          />
        ))}
      </div>
    </div>
  )
}
