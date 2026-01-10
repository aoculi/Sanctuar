import { Edit, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Bookmark, Tag } from '@/lib/types'

import TagItem from '@/components/parts/TagItem'
import ActionBtn from '@/components/ui/ActionBtn'
import { Dialog } from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface TagManageModalProps {
  open: boolean
  onClose: () => void
  bookmark?: Bookmark | null
}

export default function TagManageModal({
  open,
  onClose,
  bookmark
}: TagManageModalProps) {
  const { tags, showHiddenTags, createTag } = useTags()
  const { updateBookmark } = useBookmarks()
  const { setFlash } = useNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const creatingTagNameRef = useRef<string | null>(null)

  const filteredTags = useMemo(() => {
    const visibleTags = showHiddenTags
      ? tags
      : tags.filter((tag: Tag) => !tag.hidden)

    if (!searchQuery.trim()) {
      return visibleTags
    }

    const query = searchQuery.toLowerCase().trim()
    return visibleTags.filter((tag: Tag) =>
      tag.name.toLowerCase().includes(query)
    )
  }, [tags, searchQuery, showHiddenTags])

  const isTagSelected = (tagId: string): boolean => {
    return bookmark ? bookmark.tags.includes(tagId) : false
  }

  // Watch for newly created tags and add them to bookmark if needed
  useEffect(() => {
    if (!creatingTagNameRef.current || !bookmark) return

    const tagName = creatingTagNameRef.current.toLowerCase()
    const newTag = tags.find((tag: Tag) => tag.name.toLowerCase() === tagName)

    if (newTag && !bookmark.tags.includes(newTag.id)) {
      updateBookmark(bookmark.id, {
        tags: [...bookmark.tags, newTag.id]
      }).catch((error) => {
        setFlash(
          'Tag created but failed to add to bookmark: ' +
            ((error as Error).message ?? 'Unknown error')
        )
        console.error('Failed to add tag to bookmark:', error)
      })
      creatingTagNameRef.current = null
    }
  }, [tags, bookmark, setFlash, updateBookmark])

  const handleTagClick = async (tag: Tag) => {
    if (!bookmark) return

    const isSelected = isTagSelected(tag.id)
    const newTags = isSelected
      ? bookmark.tags.filter((id) => id !== tag.id)
      : [...bookmark.tags, tag.id]

    try {
      await updateBookmark(bookmark.id, { tags: newTags })
    } catch (error) {
      setFlash(
        'Failed to update bookmark tags: ' +
          ((error as Error).message ?? 'Unknown error')
      )
      console.error('Failed to update bookmark tags:', error)
    }
  }

  const handleUpdate = (tag: Tag) => {
    // TODO: Wire up update action
    console.log('Update tag:', tag)
  }

  const handleDelete = (tag: Tag) => {
    // TODO: Wire up delete action
    console.log('Delete tag:', tag)
  }

  const handleCreateTag = async () => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return

    // Check if tag already exists (case-insensitive)
    const existingTag = tags.find(
      (tag: Tag) => tag.name.toLowerCase() === trimmedQuery.toLowerCase()
    )

    if (existingTag) {
      // If tag exists and bookmark is provided, add it to bookmark
      if (bookmark && !isTagSelected(existingTag.id)) {
        try {
          await updateBookmark(bookmark.id, {
            tags: [...bookmark.tags, existingTag.id]
          })
        } catch (error) {
          setFlash(
            'Failed to add tag to bookmark: ' +
              ((error as Error).message ?? 'Unknown error')
          )
          console.error('Failed to add tag to bookmark:', error)
        }
      }
      return
    }

    // Create new tag
    try {
      await createTag({
        name: trimmedQuery,
        hidden: false
      })

      // If bookmark is provided, set ref so useEffect can add it to bookmark
      if (bookmark) {
        creatingTagNameRef.current = trimmedQuery
      }
    } catch (error) {
      creatingTagNameRef.current = null
      setFlash(
        'Failed to create tag: ' + ((error as Error).message ?? 'Unknown error')
      )
      console.error('Failed to create tag:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateTag()
    }
  }

  return (
    <Dialog
      title={bookmark ? 'Add Tags to Bookmark' : 'Manage Tags'}
      open={open}
      onClose={onClose}
      width={420}
      showCloseButton={false}
    >
      <div className={styles.content}>
        <div className={styles.searchContainer}>
          <Input
            type='text'
            placeholder='Search tags or press Enter to create...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
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
                  ? 'No tags found matching your search'
                  : 'No tags available'}
              </Text>
            </div>
          ) : (
            filteredTags.map((tag: Tag) => {
              const selected = isTagSelected(tag.id)
              return (
                <div
                  key={tag.id}
                  className={`${styles.tagRow} ${selected ? styles.tagRowSelected : ''} ${bookmark ? styles.tagRowClickable : ''}`}
                  onClick={bookmark ? () => handleTagClick(tag) : undefined}
                >
                  <div className={styles.tagContent}>
                    <TagItem
                      tagId={tag.id}
                      tagName={tag.name}
                      tags={tags}
                      size='default'
                    />
                    {selected && bookmark && (
                      <span className={styles.selectedIndicator}>✓</span>
                    )}
                  </div>
                  <div
                    className={styles.tagActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionBtn
                      icon={Edit}
                      size='sm'
                      onClick={() => handleUpdate(tag)}
                      title='Update tag'
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
      </div>
    </Dialog>
  )
}
