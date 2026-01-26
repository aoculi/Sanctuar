import { Folder, Inbox } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useMemo } from 'react'

import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { buildCollectionTree, type CollectionTreeNode } from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

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
  const { collections } = useCollections()
  const { settings } = useSettings()

  // Get non-pinned bookmarks (same filtering as CollectionsList)
  const nonPinnedBookmarks = useMemo(() => {
    let filtered = bookmarks.filter((b: Bookmark) => !b.pinned)
    if (!settings.showHiddenBookmarks) {
      filtered = filtered.filter((bookmark) => !bookmark.hidden)
    }
    return filtered
  }, [bookmarks, settings.showHiddenBookmarks])

  // Build tree structure
  const collectionTree = useMemo(
    () => buildCollectionTree(collections, nonPinnedBookmarks, 'updated_at'),
    [collections, nonPinnedBookmarks]
  )

  // Count uncategorized bookmarks
  const uncategorizedCount = useMemo(
    () => nonPinnedBookmarks.filter((b: Bookmark) => !b.collectionId).length,
    [nonPinnedBookmarks]
  )

  const getIcon = (iconName?: string) => {
    if (!iconName) return Folder
    const Icon = (Icons as unknown as Record<string, typeof Folder>)[iconName]
    return Icon || Folder
  }

  const renderNode = (node: CollectionTreeNode, depth: number) => {
    const Icon = getIcon(node.collection.icon)
    const isSelected = selectedCollectionId === node.collection.id

    return (
      <div key={node.collection.id}>
        <button
          className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() =>
            onSelectCollection(isSelected ? null : node.collection.id)
          }
        >
          <Icon size={16} strokeWidth={2} className={styles.icon} />
          <Text as='span' size='2' className={styles.name}>
            {node.collection.name}
          </Text>
          <div className={styles.count}>
            <Text as='span' size='1'>
              {node.bookmarks.length}
            </Text>
          </div>
        </button>
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
        {collectionTree.map((node) => renderNode(node, 0))}
        {uncategorizedCount > 0 && (
          <button
            className={`${styles.item} ${selectedCollectionId === 'uncategorized' ? styles.itemSelected : ''}`}
            style={{ paddingLeft: '12px' }}
            onClick={() =>
              onSelectCollection(
                selectedCollectionId === 'uncategorized' ? null : 'uncategorized'
              )
            }
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
        )}
      </div>
    </div>
  )
}
