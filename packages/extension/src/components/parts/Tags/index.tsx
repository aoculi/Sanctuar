import { FolderOpen, Funnel, Plus, TagIcon, TagsIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSelection } from '@/components/hooks/providers/useSelectionProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Tag as EntityTag } from '@/lib/types'

import TagComponent from '@/components/parts/Tags/Tag'
import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import ErrorCallout from '@/components/ui/ErrorCallout'

import { getTagColor } from '@/lib/bookmarkUtils'
import styles from './styles.module.css'

export default function Tags({
  currentTagId,
  onSelectFilterTag
}: {
  currentTagId: string | null
  onSelectFilterTag: (id: string) => void
}) {
  const { setSelectedTag } = useSelection()
  const [error, setError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name')
  const { tags, showHiddenTags, deleteTag } = useTags()
  const { bookmarks } = useBookmarks()
  const { navigate } = useNavigation()

  const onDeleteTag = async (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this tag? It will be removed from all bookmarks.'
      )
    ) {
      try {
        await deleteTag(id)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete tag'
        setError(errorMessage)
        setTimeout(() => setError(null), 5000)
      }
    }
  }

  const sortedTags = useMemo(() => {
    let tagsWithCounts = tags.map((tag: EntityTag) => {
      const count = bookmarks.filter((bookmark) =>
        bookmark.tags.includes(tag.id)
      ).length
      return { tag, count }
    })

    if (!showHiddenTags) {
      tagsWithCounts = tagsWithCounts.filter(
        (tag: { tag: EntityTag }) => !tag.tag.hidden
      )
    }

    if (sortMode === 'name') {
      return [...tagsWithCounts].sort(
        (a: { tag: EntityTag }, b: { tag: EntityTag }) =>
          a.tag.name.localeCompare(b.tag.name)
      )
    } else {
      return [...tagsWithCounts].sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      )
    }
  }, [tags, bookmarks, sortMode, showHiddenTags])

  const bookmarkWithoutTags = bookmarks.filter(
    (bookmark) => bookmark.tags.length === 0
  )

  return (
    <div className={styles.container}>
      {error && <ErrorCallout>{error}</ErrorCallout>}

      <div className={styles.content}>
        <div className={styles.contentActionsButtons}>
          <TagComponent
            key='all'
            onClick={() => onSelectFilterTag('all')}
            name='All bookmarks'
            color={null}
            count={bookmarks.length}
            all={true}
            active={currentTagId === 'all'}
            onEdit={() => {
              setSelectedTag('all')
              navigate('/tag')
            }}
            onDelete={() => onDeleteTag('all')}
            icon={<TagsIcon size={18} strokeWidth={2} />}
          />

          <TagComponent
            key='unsorted'
            onClick={() => onSelectFilterTag('unsorted')}
            name='Unsorted'
            color={null}
            count={bookmarkWithoutTags.length}
            all={true}
            active={currentTagId === 'unsorted'}
            onEdit={() => {
              setSelectedTag('unsorted')
              navigate('/tag')
            }}
            onDelete={() => onDeleteTag('unsorted')}
            icon={<FolderOpen size={18} strokeWidth={2} />}
          />
        </div>

        <div className={styles.headerActions}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button asIcon={true} size='sm' variant='ghost' color='light'>
                <Funnel strokeWidth={2} size={16} />
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

          <Button
            asIcon={true}
            size='sm'
            color='light'
            onClick={() => navigate('/tag')}
          >
            <Plus strokeWidth={2} size={16} />
          </Button>
        </div>

        <div className={styles.list}>
          {tags.length === 0 && (
            <p className={styles.emptyState}>No tags yet</p>
          )}

          {sortedTags.length > 0 &&
            sortedTags.map(
              ({ tag, count }: { tag: EntityTag; count: number }) => {
                const colorInfo = getTagColor(tag.id, tags)
                return (
                  <TagComponent
                    key={tag.id}
                    icon={
                      <TagIcon
                        size={16}
                        strokeWidth={2}
                        style={{ color: colorInfo?.tagColor ?? 'inherit' }}
                      />
                    }
                    color={colorInfo?.tagColor ?? null}
                    onClick={() => onSelectFilterTag(tag.id)}
                    name={tag.name}
                    count={count}
                    all={false}
                    active={currentTagId === tag.id}
                    onEdit={() => {
                      setSelectedTag(tag.id)
                      navigate('/tag')
                    }}
                    onDelete={() => onDeleteTag(tag.id)}
                  />
                )
              }
            )}
        </div>
      </div>
    </div>
  )
}
