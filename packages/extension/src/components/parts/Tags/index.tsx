import { ListFilter, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Tag as EntityTag } from '@/lib/types'

import TagComponent from '@/components/parts/Tags/Tag'
import TagHeader from '@/components/parts/Tags/TagHeader'
import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import ErrorCallout from '@/components/ui/ErrorCallout'

import styles from './styles.module.css'

export default function Tags({
  currentTagId,
  onSelectFilterTag,
  setSelectedTag
}: {
  currentTagId: string | null
  onSelectFilterTag: (id: string) => void
  setSelectedTag: (id: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name')
  const { tags, showHiddenTags, deleteTag } = useTags()
  const { bookmarks } = useBookmarks()

  const onDeleteTag = (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this tag? It will be removed from all bookmarks.'
      )
    ) {
      try {
        deleteTag(id)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete tag'
        setError(errorMessage)
        setTimeout(() => setError(null), 5000)
      }
    }
  }

  const sortedTags = useMemo(() => {
    let tagsWithCounts = tags.map((tag: EntityTag) => ({
      tag,
      count: bookmarks.filter((bookmark) => bookmark.tags.includes(tag.id))
        .length
    }))

    // Filter hidden tags based on settings
    if (!showHiddenTags) {
      tagsWithCounts = tagsWithCounts.filter(
        (tag: { tag: EntityTag }) => !tag.tag.hidden
      )
    }

    if (sortMode === 'name') {
      return tagsWithCounts.sort(
        (a: { tag: EntityTag }, b: { tag: EntityTag }) =>
          a.tag.name.localeCompare(b.tag.name)
      )
    } else {
      return tagsWithCounts.sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      )
    }
  }, [tags, bookmarks, sortMode, showHiddenTags])

  return (
    <div className={styles.container}>
      <TagHeader />

      {error && <ErrorCallout>{error}</ErrorCallout>}

      <div className={styles.content}>
        <div className={styles.contentActions}>
          <Button
            size='sm'
            onClick={() => onSelectFilterTag('all')}
            variant={currentTagId === 'all' ? 'solid' : 'ghost'}
            color={currentTagId === 'all' ? 'primary' : 'light'}
          >
            <Tag size={16} strokeWidth={2} />
            All tags ({bookmarks.length})
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button asIcon={true} size='sm' color='light'>
                <ListFilter strokeWidth={1} size={15} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onClick={() => setSortMode('name')}
                disabled={sortMode === 'name'}
              >
                Sort by name
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => setSortMode('count')}
                disabled={sortMode === 'count'}
              >
                Sort by bookmark count
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>

        <div className={styles.list}>
          {tags.length === 0 && (
            <p className={styles.emptyState}>No tags yet</p>
          )}

          {sortedTags.length > 0 &&
            sortedTags.map(
              ({ tag, count }: { tag: EntityTag; count: number }) => (
                <TagComponent
                  key={tag.id}
                  onClick={() => onSelectFilterTag(tag.id)}
                  name={tag.name}
                  count={count}
                  all={false}
                  active={currentTagId === tag.id}
                  onEdit={() => setSelectedTag(tag.id)}
                  onDelete={() => onDeleteTag(tag.id)}
                />
              )
            )}
        </div>
      </div>

      <div className={styles.status}>{/* <StatusIndicator /> */}</div>
    </div>
  )
}
