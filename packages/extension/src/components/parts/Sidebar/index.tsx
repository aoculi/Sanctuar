import { ChevronDown, Folder, Hash, Inbox, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { buildCollectionTree, type CollectionTreeNode } from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

import CreateCollection from '@/components/parts/Bookmarks/CreateCollection'
import HiddenToggle from '@/components/parts/HiddenToggle'
import ThemeToggle from '@/components/parts/ThemeToggle'
import Logo from '@/components/ui/Logo'

import styles from './styles.module.css'

interface SidebarProps {
  selectedCollectionId: string | null
  selectedTagIds: string[]
  onSelectCollection: (id: string | null) => void
  onSelectTag: (id: string) => void
  onManageTags: () => void
}

export default function Sidebar({
  selectedCollectionId,
  selectedTagIds,
  onSelectCollection,
  onSelectTag,
  onManageTags
}: SidebarProps) {
  const { navigate } = useNavigation()
  const { bookmarks } = useBookmarks()
  const { collections } = useCollections()
  const { tags, pinnedTags } = useTags()
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())

  const uncategorizedCount = useMemo(
    () => bookmarks.filter((b: Bookmark) => !b.collectionId && !b.pinned).length,
    [bookmarks]
  )

  const collectionTree = useMemo(() => {
    return buildCollectionTree(collections, bookmarks, 'updated_at')
  }, [collections, bookmarks])

  const toggleExpand = (id: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getCollectionBookmarkCount = (node: CollectionTreeNode): number => {
    let count = node.bookmarks.length
    for (const child of node.children) {
      count += getCollectionBookmarkCount(child)
    }
    return count
  }

  const renderCollectionNode = (node: CollectionTreeNode, depth: number = 0) => {
    const isExpanded = expandedCollections.has(node.collection.id)
    const hasChildren = node.children.length > 0
    const isSelected = selectedCollectionId === node.collection.id
    const count = getCollectionBookmarkCount(node)

    return (
      <div key={node.collection.id}>
        <button
          type="button"
          className={`${styles.navItem} ${isSelected ? styles.navItemActive : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelectCollection(node.collection.id)}
        >
          {hasChildren ? (
            <span
              className={`${styles.expandBtn} ${isExpanded ? styles.expanded : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.collection.id)
              }}
            >
              <ChevronDown size={12} />
            </span>
          ) : (
            <span className={styles.expandPlaceholder} />
          )}
          <Folder size={16} className={styles.navIcon} />
          <span className={styles.navLabel}>{node.collection.name}</span>
          <span className={styles.navCount}>{count}</span>
        </button>
        {hasChildren && isExpanded && (
          <div className={styles.childCollections}>
            {node.children.map(child => renderCollectionNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <Logo />
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          <button
            type="button"
            className={`${styles.navItem} ${selectedCollectionId === null && selectedTagIds.length === 0 ? styles.navItemActive : ''}`}
            onClick={() => onSelectCollection(null)}
          >
            <span className={styles.expandPlaceholder} />
            <Inbox size={16} className={styles.navIcon} />
            <span className={styles.navLabel}>All Bookmarks</span>
            <span className={styles.navCount}>{bookmarks.length}</span>
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Collections</span>
            <CreateCollection compact />
          </div>
          <div className={styles.collectionsList}>
            {collectionTree.map(node => renderCollectionNode(node))}
            {uncategorizedCount > 0 && (
              <button
                type="button"
                className={`${styles.navItem} ${selectedCollectionId === 'uncategorized' ? styles.navItemActive : ''}`}
                onClick={() => onSelectCollection('uncategorized')}
              >
                <span className={styles.expandPlaceholder} />
                <Inbox size={16} className={styles.navIcon} />
                <span className={styles.navLabel}>Uncategorized</span>
                <span className={styles.navCount}>{uncategorizedCount}</span>
              </button>
            )}
          </div>
        </div>

        {pinnedTags.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Tags</span>
              <button
                type="button"
                className={styles.sectionAction}
                onClick={onManageTags}
                title="Manage tags"
              >
                <Settings size={14} />
              </button>
            </div>
            <div className={styles.tagsList}>
              {pinnedTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${styles.tagItem} ${isSelected ? styles.tagItemActive : ''}`}
                    onClick={() => onSelectTag(tag.id)}
                  >
                    <Hash size={14} className={styles.tagIcon} />
                    <span>{tag.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerActions}>
          <HiddenToggle />
          <ThemeToggle />
        </div>
        <button
          type="button"
          className={styles.settingsBtn}
          onClick={() => navigate('/settings')}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
