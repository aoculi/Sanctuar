import { ListFilter, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useTags } from '@/entrypoints/components/hooks/useTags'
import { useTagVisibilityPreference } from '@/entrypoints/components/hooks/useTagVisibilityPreference'
import { StatusIndicator } from '@/entrypoints/components/parts/StatusIndicator'
import Button from '@/entrypoints/components/ui/Button'
import { DropdownMenu } from '@/entrypoints/components/ui/DropdownMenu'
import type { Bookmark, Tag as EntityTag } from '@/entrypoints/lib/types'
import TagComponent from './Tag'
import TagHeader from './TagHeader'
import { TagModal } from './TagModal'

import styles from './styles.module.css'

export default function Tags({
  bookmarks,
  currentTagId,
  onSelectTag
}: {
  bookmarks: Bookmark[]
  currentTagId: string | null
  onSelectTag: (id: string) => void
}) {
  const { tags, createTag, renameTag, deleteTag } = useTags()
  const [message, setMessage] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentTag, setCurrentTag] = useState<EntityTag | null>(null)
  const { showHiddenTags } = useTagVisibilityPreference()

  const onAddTag = () => {
    setCurrentTag(null)
    setIsModalOpen(true)
  }

  const onEditTag = (tag: EntityTag) => {
    setCurrentTag(tag)
    setIsModalOpen(true)
  }

  const handleSaveTag = async (data: { name: string; hidden: boolean }) => {
    try {
      if (currentTag) {
        // Editing existing tag
        await renameTag(currentTag.id, data.name, data.hidden)
      } else {
        // Creating new tag
        await createTag({ name: data.name, hidden: data.hidden ?? false })
      }
      setIsModalOpen(false)
      setCurrentTag(null)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save tag'
      setMessage(errorMessage)
      setTimeout(() => setMessage(null), 5000)
      throw error // Re-throw to let modal handle loading state
    }
  }

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
        setMessage(errorMessage)
        setTimeout(() => setMessage(null), 5000)
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
      <TagHeader onAddTag={onAddTag} />

      <div className={styles.content}>
        <div className={styles.contentActions}>
          <Button
            size='sm'
            onClick={() => onSelectTag('all')}
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
                  onClick={() => onSelectTag(tag.id)}
                  name={tag.name}
                  count={count}
                  all={false}
                  active={currentTagId === tag.id}
                  onEdit={() => onEditTag(tag)}
                  onDelete={() => onDeleteTag(tag.id)}
                />
              )
            )}
        </div>
      </div>

      <TagModal
        isOpen={isModalOpen}
        tag={currentTag}
        onClose={() => {
          setIsModalOpen(false)
          setCurrentTag(null)
        }}
        onSave={handleSaveTag}
      />
      <div className={styles.status}>
        <StatusIndicator />
      </div>
    </div>
  )
}
