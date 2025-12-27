import {
  ArrowUpDown,
  ChevronDown,
  HeartMinus,
  HeartPlus,
  Search,
  Tag,
  Tags,
  Trash2
} from 'lucide-react'
import { useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useTags } from '@/components/hooks/useTags'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { TagSelectorField } from '@/components/ui/TagSelectorField'

import styles from './styles.module.css'

export default function BookmarkHeader({
  searchQuery,
  onSearchChange,
  sortMode,
  onSortModeChange,
  selectedTags,
  onSelectedTagsChange,
  selectedBookmarkIds,
  onDeleteSelected
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortMode: 'updated_at' | 'title'
  onSortModeChange: (mode: 'updated_at' | 'title') => void
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  selectedBookmarkIds: Set<string>
  onDeleteSelected: () => void
}) {
  const { tags } = useTags()
  const { navigate, setFlash } = useNavigation()
  const { manifest, save } = useManifest()
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Check if all selected bookmarks are pinned
  const allSelectedPinned = manifest
    ? Array.from(selectedBookmarkIds).every((id) => {
        const bookmark = manifest.items?.find((item) => item.id === id)
        return bookmark?.pinned ?? false
      })
    : false

  const handleBulkDelete = async () => {
    const count = selectedBookmarkIds.size
    const message =
      count === 1
        ? 'Are you sure you want to delete this bookmark?'
        : `Are you sure you want to delete ${count} bookmarks?`

    if (confirm(message)) {
      try {
        if (!manifest) return

        await save({
          ...manifest,
          items: (manifest.items || []).filter(
            (item) => !selectedBookmarkIds.has(item.id)
          )
        })
        onDeleteSelected()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete bookmarks'
        setFlash(errorMessage)
        setTimeout(() => setFlash(null), 5000)
      }
    }
  }

  const handleBulkPin = async () => {
    try {
      if (!manifest) return

      const shouldPin = !allSelectedPinned

      await save({
        ...manifest,
        items: (manifest.items || []).map((item) =>
          selectedBookmarkIds.has(item.id)
            ? { ...item, pinned: shouldPin, updated_at: Date.now() }
            : item
        )
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update bookmarks'
      setFlash(errorMessage)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  const hasSelection = selectedBookmarkIds.size > 0

  return (
    <div className={styles.container}>
      <div className={styles.actionsContainer}>
        {!hasSelection && (
          <>
            <DropdownMenu.Root open={sortOpen} onOpenChange={setSortOpen}>
              <DropdownMenu.Trigger asChild>
                <Button
                  size='sm'
                  variant='ghost'
                  color='light'
                  className={styles.actionButton}
                  title='Sort bookmarks'
                >
                  <ArrowUpDown strokeWidth={2} size={16} />
                  <span className={styles.actionLabel}>Sort</span>
                  <ChevronDown
                    strokeWidth={2}
                    size={14}
                    className={`${styles.chevron} ${sortOpen ? styles.chevronOpen : ''}`}
                  />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onClick={() => onSortModeChange('updated_at')}
                  disabled={sortMode === 'updated_at'}
                >
                  Sort by updated date
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => onSortModeChange('title')}
                  disabled={sortMode === 'title'}
                >
                  Sort by title
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <DropdownMenu.Root open={filterOpen} onOpenChange={setFilterOpen}>
              <DropdownMenu.Trigger asChild>
                <Button
                  size='sm'
                  variant='ghost'
                  color='light'
                  className={styles.actionButton}
                  title='Filter bookmarks by tags'
                >
                  <Tags strokeWidth={2} size={16} />
                  {selectedTags.length > 0 && (
                    <span className={styles.tagBadge}>
                      {selectedTags.length}
                    </span>
                  )}
                  <span className={styles.actionLabel}>Filter</span>
                  <ChevronDown
                    strokeWidth={2}
                    size={14}
                    className={`${styles.chevron} ${filterOpen ? styles.chevronOpen : ''}`}
                  />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className={styles.filterDropdown}>
                <TagSelectorField
                  tags={tags}
                  selectedTags={selectedTags}
                  onChange={onSelectedTagsChange}
                />
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <Button
              onClick={() => navigate('/tag')}
              size='sm'
              variant='ghost'
              color='light'
              className={styles.actionButton}
              title='Create a new tag'
            >
              <Tag strokeWidth={2} size={16} />
              <span className={styles.actionLabel}>New tag</span>
            </Button>
          </>
        )}
        {hasSelection && (
          <>
            <Button
              onClick={handleBulkPin}
              size='sm'
              variant='ghost'
              color='light'
              className={styles.actionButton}
              title={allSelectedPinned ? 'Unpin selected' : 'Pin selected'}
            >
              {allSelectedPinned ? (
                <HeartMinus strokeWidth={2} size={16} />
              ) : (
                <HeartPlus strokeWidth={2} size={16} />
              )}
              <span className={styles.actionLabel}>
                {allSelectedPinned ? 'Unpin' : 'Pin'}
              </span>
            </Button>
            <Button
              onClick={handleBulkDelete}
              size='sm'
              variant='ghost'
              color='light'
              className={styles.actionButton}
              title='Delete selected bookmarks'
            >
              <Trash2 strokeWidth={2} size={16} />
              <span className={styles.actionLabel}>Delete</span>
            </Button>
          </>
        )}
      </div>
      <div className={styles.searchBarContainer}>
        <Search strokeWidth={1} size={16} />
        <input
          type='text'
          placeholder='Search bookmarks...'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>
    </div>
  )
}
