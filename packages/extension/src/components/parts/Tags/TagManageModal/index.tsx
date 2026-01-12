import { Edit, Pin, PinOff, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Bookmark, Tag } from '@/lib/types'

import TagItem from '@/components/parts/Tags/TagItem'
import ActionBtn from '@/components/ui/ActionBtn'
import { Dialog } from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'
import TagEditForm from './TagEditForm'

import styles from './styles.module.css'

interface TagManageModalProps {
  open: boolean
  onClose: () => void
  bookmark?: Bookmark | null
  bookmarkIds?: string[]
}

export default function TagManageModal({
  open,
  onClose,
  bookmark,
  bookmarkIds
}: TagManageModalProps) {
  const { tags, showHiddenTags, createTag, deleteTag, togglePinTag } = useTags()
  const { updateBookmark, updateBookmarks, bookmarks } = useBookmarks()
  const { setFlash } = useNavigation()

  const [searchQuery, setSearchQuery] = useState('')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  const isBulkMode = bookmarkIds && bookmarkIds.length > 0

  // Get latest bookmark data for single bookmark mode
  const currentBookmark = useMemo(() => {
    if (!bookmark) return null
    return bookmarks.find((b: Bookmark) => b.id === bookmark.id) || bookmark
  }, [bookmark, bookmarks])

  // Get all bookmarks for bulk mode
  const bulkBookmarks = useMemo(() => {
    if (!isBulkMode) return []
    return bookmarks.filter((b: Bookmark) => bookmarkIds.includes(b.id))
  }, [isBulkMode, bookmarkIds, bookmarks])

  // Filter tags by search and visibility
  const filteredTags = useMemo(() => {
    const visibleTags = showHiddenTags
      ? tags
      : tags.filter((tag: Tag) => !tag.hidden)

    if (!searchQuery.trim()) return visibleTags

    const query = searchQuery.toLowerCase().trim()
    return visibleTags.filter((tag: Tag) =>
      tag.name.toLowerCase().includes(query)
    )
  }, [tags, searchQuery, showHiddenTags])

  const isTagSelected = (tagId: string): boolean => {
    if (isBulkMode) {
      // In bulk mode, tag is selected if ALL bookmarks have it
      return bulkBookmarks.length > 0 && bulkBookmarks.every((b: Bookmark) => b.tags.includes(tagId))
    }
    return currentBookmark?.tags.includes(tagId) ?? false
  }

  const handleTagClick = async (tag: Tag) => {
    if (isBulkMode) {
      const isSelected = isTagSelected(tag.id)
      try {
        for (const b of bulkBookmarks) {
          const newTags = isSelected
            ? b.tags.filter((id: string) => id !== tag.id)
            : [...b.tags, tag.id]
          await updateBookmark(b.id, { tags: newTags })
        }
      } catch (error) {
        setFlash(`Failed to update tags: ${(error as Error).message}`)
      }
      return
    }

    if (!currentBookmark) return

    const isSelected = isTagSelected(tag.id)
    const newTags = isSelected
      ? currentBookmark.tags.filter((id) => id !== tag.id)
      : [...currentBookmark.tags, tag.id]

    try {
      await updateBookmark(currentBookmark.id, { tags: newTags })
    } catch (error) {
      setFlash(`Failed to update tags: ${(error as Error).message}`)
    }
  }

  const handleDelete = async (tag: Tag) => {
    const count = bookmarks.filter((b: Bookmark) =>
      b.tags.includes(tag.id)
    ).length

    const message =
      count === 0
        ? `Delete tag "${tag.name}"?`
        : `Delete tag "${tag.name}"? It will be removed from ${count} bookmark${count === 1 ? '' : 's'}.`

    if (confirm(message)) {
      try {
        await deleteTag(tag.id)
      } catch (error) {
        setFlash(`Failed to delete tag: ${(error as Error).message}`)
      }
    }
  }

  const handleTogglePin = async (tag: Tag) => {
    try {
      await togglePinTag(tag.id)
    } catch (error) {
      setFlash(`Failed to update tag: ${(error as Error).message}`)
    }
  }

  const handleCreateTag = async () => {
    const name = searchQuery.trim()
    if (!name) return

    const existing = tags.find(
      (t: Tag) => t.name.toLowerCase() === name.toLowerCase()
    )

    if (existing) {
      if (isBulkMode && bulkBookmarks.length > 0) {
        try {
          for (const b of bulkBookmarks) {
            if (!b.tags.includes(existing.id)) {
              await updateBookmark(b.id, { tags: [...b.tags, existing.id] })
            }
          }
        } catch (error) {
          setFlash(`Failed to add tag: ${(error as Error).message}`)
        }
      } else if (currentBookmark && !isTagSelected(existing.id)) {
        try {
          await updateBookmark(currentBookmark.id, {
            tags: [...currentBookmark.tags, existing.id]
          })
        } catch (error) {
          setFlash(`Failed to add tag: ${(error as Error).message}`)
        }
      }
      setSearchQuery('')
      return
    }

    try {
      const newTag = await createTag({ name, hidden: false })
      if (isBulkMode && newTag) {
        for (const b of bulkBookmarks) {
          await updateBookmark(b.id, { tags: [...b.tags, newTag.id] })
        }
      } else if (currentBookmark && newTag) {
        await updateBookmark(currentBookmark.id, {
          tags: [...currentBookmark.tags, newTag.id]
        })
      }
      setSearchQuery('')
    } catch (error) {
      setFlash(`Failed to create tag: ${(error as Error).message}`)
    }
  }

  const handleClose = () => {
    setEditingTag(null)
    setSearchQuery('')
    onClose()
  }

  return (
    <Dialog
      title={
        editingTag
          ? 'Edit Tag'
          : isBulkMode
            ? `Add Tags to ${bookmarkIds.length} Bookmarks`
            : bookmark
              ? 'Add Tags to Bookmark'
              : 'Manage Tags'
      }
      open={open}
      onClose={handleClose}
      width={420}
      showCloseButton={false}
    >
      <div className={styles.content}>
        {editingTag ? (
          <TagEditForm tag={editingTag} onClose={() => setEditingTag(null)} />
        ) : (
          <>
            <div className={styles.searchContainer}>
              <Input
                type='text'
                placeholder='Search or create tag...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                size='md'
              >
                <Search size={16} />
              </Input>
            </div>

            <div className={styles.tagsList}>
              {filteredTags.length === 0 ? (
                <div className={styles.emptyState}>
                  <Text size='2' color='light'>
                    {searchQuery.trim()
                      ? 'Press Enter to create tag'
                      : 'No tags yet'}
                  </Text>
                </div>
              ) : (
                filteredTags.map((tag: Tag) => {
                  const selected = isTagSelected(tag.id)
                  return (
                    <div
                      key={tag.id}
                      className={`${styles.tagRow} ${selected ? styles.tagRowSelected : ''} ${isBulkMode || currentBookmark ? styles.tagRowClickable : ''}`}
                      onClick={
                        isBulkMode || currentBookmark ? () => handleTagClick(tag) : undefined
                      }
                    >
                      <div className={styles.tagContent}>
                        <TagItem
                          tagId={tag.id}
                          tagName={tag.name}
                          tags={tags}
                          size='default'
                        />
                      </div>
                      <div
                        className={styles.tagActions}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionBtn
                          icon={tag.pinned ? PinOff : Pin}
                          size='sm'
                          onClick={() => handleTogglePin(tag)}
                          title={tag.pinned ? 'Unpin tag' : 'Pin tag'}
                        />
                        <ActionBtn
                          icon={Edit}
                          size='sm'
                          onClick={() => setEditingTag(tag)}
                          title='Edit tag'
                        />
                        <ActionBtn
                          icon={Trash2}
                          size='sm'
                          danger
                          onClick={() => handleDelete(tag)}
                          title='Delete tag'
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
