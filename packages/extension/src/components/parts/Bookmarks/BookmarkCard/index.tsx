import {
  Edit,
  HeartMinus,
  HeartPlus,
  Tag as TagIcon,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import {
  createTagMap,
  getTagColor,
  getTagNameFromMap
} from '@/lib/bookmarkUtils'
import type { Bookmark, Tag } from '@/lib/types'
import { formatDate, getHostname } from '@/lib/utils'

import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { TagSelectorField } from '@/components/ui/TagSelectorField'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type BookmarkCardProps = {
  bookmark: Bookmark
  tags: Tag[]
  onDelete: (id: string) => void
  isSelected: boolean
  onToggleSelect: () => void
}

export function BookmarkCard({
  bookmark,
  tags,
  onDelete,
  isSelected,
  onToggleSelect
}: BookmarkCardProps) {
  const { navigate, setFlash } = useNavigation()
  const { updateBookmark } = useBookmarks()
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>(bookmark.tags)

  const tagMap = useMemo(() => createTagMap(tags), [tags])

  // Sync selectedTags with bookmark.tags when bookmark changes
  useEffect(() => {
    setSelectedTags(bookmark.tags)
  }, [bookmark.tags])

  const handleTagsChange = async (newTags: string[]) => {
    setSelectedTags(newTags)
    try {
      await updateBookmark(bookmark.id, { tags: newTags })
    } catch (error) {
      // Revert on error
      setSelectedTags(bookmark.tags)
      setFlash(
        'Failed to update bookmark tags: ' +
          ((error as Error).message ?? 'Unknown error')
      )
      console.error('Failed to update bookmark tags:', error)
    }
  }

  const handleTogglePinned = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await updateBookmark(bookmark.id, { pinned: !(bookmark.pinned ?? false) })
    } catch (error) {
      setFlash(
        'Failed to update bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
      console.error('Failed to update bookmark pinned status:', error)
    }
  }

  return (
    <div className={styles.component}>
      <a
        className={styles.card}
        href={bookmark.url}
        target='_blank'
        title={bookmark.url}
        rel='noopener noreferrer'
      >
        <div className={styles.checkboxWrapper}>
          <Checkbox
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
            title='Select bookmark'
          />
        </div>

        {bookmark.picture && (
          <div className={styles.picture}>
            <img src={bookmark.picture} alt={bookmark?.title} />
          </div>
        )}

        <div className={styles.content}>
          <Text size='2' weight='medium' color='white' className={styles.name}>
            {bookmark.title || '(Untitled)'}
          </Text>

          <div className={styles.secondaryLine}>
            <Text size='2' color='light'>
              {getHostname(bookmark.url)}
            </Text>

            <div className={styles.tagsContainer}>
              <div className={styles.tagsWrapper}>
                {bookmark.tags.length > 0 && (
                  <div className={styles.tags}>
                    {bookmark.tags.map((tagId: string) => {
                      const colorInfo = getTagColor(tagId, tags)
                      return (
                        <span
                          key={tagId}
                          className={[
                            styles.tag,
                            colorInfo ? styles.colored : ''
                          ].join(' ')}
                          style={{
                            backgroundColor:
                              colorInfo?.tagColor ?? 'transparent',
                            color: colorInfo?.textColor ?? 'white'
                          }}
                        >
                          {getTagNameFromMap(tagId, tagMap)}
                        </span>
                      )
                    })}
                  </div>
                )}
                <DropdownMenu.Root
                  open={tagManagerOpen}
                  onOpenChange={setTagManagerOpen}
                >
                  <DropdownMenu.Trigger asChild>
                    <Button
                      asIcon={bookmark.tags.length > 0}
                      size='sm'
                      variant='ghost'
                      color='dark'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title='Manage tags'
                      className={styles.tagButton}
                    >
                      <TagIcon size={16} />
                      {bookmark.tags.length === 0 && (
                        <span className={styles.tagButtonLabel}>Add tags</span>
                      )}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content className={styles.tagManagerDropdown}>
                    <TagSelectorField
                      tags={tags}
                      selectedTags={selectedTags}
                      onChange={handleTagsChange}
                    />
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>

              <Text size='1' color='light' className={styles.updatedText}>
                Updated: {formatDate(bookmark.updated_at)}
              </Text>
            </div>
          </div>
        </div>
      </a>

      <div className={styles.actions}>
        <Button
          asIcon={true}
          color={(bookmark.pinned ?? false) ? 'light' : 'dark'}
          onClick={handleTogglePinned}
          title={(bookmark.pinned ?? false) ? 'Unpin' : 'Pin'}
        >
          {(bookmark.pinned ?? false) ? (
            <HeartMinus size={16} />
          ) : (
            <HeartPlus size={16} />
          )}
        </Button>
        <Button
          asIcon={true}
          color='dark'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate('/bookmark', { bookmark: bookmark.id })
          }}
          title='Edit'
        >
          <Edit size={16} />
        </Button>
        <Button
          asIcon={true}
          color='dark'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(bookmark.id)
          }}
          title='Delete'
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  )
}
