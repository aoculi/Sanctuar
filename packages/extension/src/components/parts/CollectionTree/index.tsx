import { ExternalLink, Folder, Inbox, Library } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useMemo } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useDragReorder, type DropZone } from '@/components/hooks/useDragReorder'
import {
  buildCollectionTree,
  handleCollectionDrop,
  type CollectionTreeNode
} from '@/lib/collectionUtils'
import { openUrlsInTabs } from '@/lib/tabs'
import type { Bookmark } from '@/lib/types'

import ActionBtn from '@/components/ui/ActionBtn'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface CollectionTreeProps {
  selectedCollectionId: string | null
  onSelectCollection: (collectionId: string | null) => void
}

export default function CollectionTree({
  selectedCollectionId,
  onSelectCollection
}: CollectionTreeProps) {
  const { bookmarks } = useBookmarks()
  const { collections, reorderCollections } = useCollections()
  const { settings } = useSettings()
  const { setFlash } = useNavigation()

  const {
    draggedId,
    getDropZone,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    clearDragState,
    isDragging,
    getDropZoneForTarget
  } = useDragReorder<DropZone>({ includeCenter: true })

  const nonPinnedBookmarks = useMemo(() => {
    let filtered = bookmarks.filter((b: Bookmark) => !b.pinned)
    if (!settings.showHiddenBookmarks) {
      filtered = filtered.filter((bookmark) => !bookmark.hidden)
    }
    return filtered
  }, [bookmarks, settings.showHiddenBookmarks])

  const collectionTree = useMemo(
    () => buildCollectionTree(collections, nonPinnedBookmarks, 'updated_at'),
    [collections, nonPinnedBookmarks]
  )

  const uncategorizedCount = useMemo(
    () => nonPinnedBookmarks.filter((b: Bookmark) => !b.collectionId).length,
    [nonPinnedBookmarks]
  )

  const getIcon = (iconName?: string) => {
    if (!iconName) return Folder
    const Icon = (Icons as unknown as Record<string, typeof Folder>)[iconName]
    return Icon || Folder
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      clearDragState()
      return
    }

    const zone = getDropZone(e)
    const result = handleCollectionDrop(collections, draggedId, targetId, zone)

    if ('error' in result) {
      setFlash(result.error)
      setTimeout(() => setFlash(null), 3000)
      clearDragState()
      return
    }

    try {
      await reorderCollections(result)
    } catch (error) {
      setFlash(`Failed to move: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
    clearDragState()
  }

  const handleOpenAllBookmarks = (
    e: React.MouseEvent,
    nodeBookmarks: Bookmark[]
  ) => {
    e.stopPropagation()
    openUrlsInTabs(nodeBookmarks.map((b) => b.url))
  }

  const getDropZoneClass = (collectionId: string) => {
    const zone = getDropZoneForTarget(collectionId)
    if (!zone) return ''
    switch (zone) {
      case 'above':
        return styles.dropAbove
      case 'below':
        return styles.dropBelow
      case 'center':
        return styles.dropCenter
      default:
        return ''
    }
  }

  const renderNode = (node: CollectionTreeNode, depth: number) => {
    const Icon = getIcon(node.collection.icon)
    const isSelected = selectedCollectionId === node.collection.id
    const dragging = isDragging(node.collection.id)
    const dropZoneClass = getDropZoneClass(node.collection.id)

    return (
      <div key={node.collection.id}>
        <div
          className={`${styles.itemWrapper} ${dragging ? styles.dragging : ''} ${dropZoneClass}`}
          draggable
          onDragStart={() => handleDragStart(node.collection.id)}
          onDragOver={(e) => handleDragOver(e, node.collection.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.collection.id)}
          onDragEnd={handleDragEnd}
        >
          <button
            className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
            style={{ paddingLeft: `${depth * 16 + 10}px` }}
            onClick={() =>
              onSelectCollection(isSelected ? null : node.collection.id)
            }
          >
            <Icon size={16} strokeWidth={2} className={styles.icon} />
            <Text as='span' size='2' className={styles.name}>
              {node.collection.name}
            </Text>
            {node.bookmarks.length > 0 && (
              <div className={styles.actions}>
                <ActionBtn
                  icon={ExternalLink}
                  size='sm'
                  onClick={(e) => handleOpenAllBookmarks(e, node.bookmarks)}
                  title='Open all bookmarks'
                />
              </div>
            )}
            <div className={styles.count}>
              <Text as='span' size='1'>
                {node.bookmarks.length}
              </Text>
            </div>
          </button>
        </div>
        {node.children.length > 0 && (
          <div className={styles.children}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.component}>
      <div className={styles.header}>
        <Text as='span' size='1' weight='medium' color='light'>
          Collections
        </Text>
      </div>
      <div className={styles.tree}>
        {/* All Bookmarks - shows everything */}
        <div className={styles.itemWrapper}>
          <button
            className={`${styles.item} ${selectedCollectionId === null ? styles.itemSelected : ''}`}
            style={{ paddingLeft: '10px' }}
            onClick={() => onSelectCollection(null)}
          >
            <Library size={16} strokeWidth={2} className={styles.icon} />
            <Text as='span' size='2' className={styles.name}>
              All Bookmarks
            </Text>
            <div className={styles.count}>
              <Text as='span' size='1'>
                {nonPinnedBookmarks.length}
              </Text>
            </div>
          </button>
        </div>
        {collectionTree.map((node) => renderNode(node, 0))}
        {uncategorizedCount > 0 && (
          <div className={styles.itemWrapper}>
            <button
              className={`${styles.item} ${selectedCollectionId === 'uncategorized' ? styles.itemSelected : ''}`}
              style={{ paddingLeft: '10px' }}
              onClick={() => onSelectCollection('uncategorized')}
            >
              <Inbox size={16} strokeWidth={2} className={styles.icon} />
              <Text as='span' size='2' className={styles.name}>
                Uncategorized
              </Text>
              <div className={styles.count}>
                <Text as='span' size='1'>
                  {uncategorizedCount}
                </Text>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
