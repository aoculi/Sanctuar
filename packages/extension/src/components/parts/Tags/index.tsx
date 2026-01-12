import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Tag } from '@/lib/types'

import TagItem from '@/components/parts/Tags/TagItem'
import TagEditForm from '@/components/parts/Tags/TagManageModal/TagEditForm'
import ActionBtn from '@/components/ui/ActionBtn'
import { Dialog } from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface TagsProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export default function Tags({
  searchQuery: initialSearchQuery = '',
  onSearchChange
}: TagsProps) {
  const { tags, showHiddenTags, createTag, deleteTag } = useTags()
  const { bookmarks } = useBookmarks()
  const { setFlash, navigate } = useNavigation()

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

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

  const getBookmarkCount = (tagId: string): number => {
    return bookmarks.filter((b) => b.tags.includes(tagId)).length
  }

  const handleTagClick = (tagId: string) => {
    navigate('/app', { tag: tagId })
  }

  const handleDelete = async (tag: Tag) => {
    const count = getBookmarkCount(tag.id)

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

  const handleCreateTag = async () => {
    const name = searchQuery.trim()
    if (!name) return

    const existing = tags.find(
      (t: Tag) => t.name.toLowerCase() === name.toLowerCase()
    )

    if (existing) {
      setFlash('A tag with this name already exists')
      return
    }

    try {
      await createTag({ name, hidden: false })
      setSearchQuery('')
    } catch (error) {
      setFlash(`Failed to create tag: ${(error as Error).message}`)
    }
  }

  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <Text as='h1' size='5' weight='medium'>
              Tags
            </Text>
            <Text size='2' color='light'>
              Manage your tags and click on any tag to view its bookmarks
            </Text>
          </div>

          <div className={styles.searchContainer}>
            <Input
              type='text'
              placeholder='Search or create tag...'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                onSearchChange?.(e.target.value)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              size='md'
            >
              <Search size={16} />
            </Input>
            {searchQuery.trim() &&
              !tags.find(
                (t: Tag) =>
                  t.name.toLowerCase() === searchQuery.toLowerCase().trim()
              ) && (
                <button
                  type='button'
                  className={styles.createButton}
                  onClick={handleCreateTag}
                >
                  <Plus size={16} />
                  <span>Create "{searchQuery.trim()}"</span>
                </button>
              )}
          </div>

          <div className={styles.tagsList}>
            {filteredTags.length === 0 ? (
              <div className={styles.emptyState}>
                <Text size='2' color='light'>
                  {searchQuery.trim()
                    ? 'No tags found. Press Enter to create one.'
                    : 'No tags yet. Create your first tag above.'}
                </Text>
              </div>
            ) : (
              filteredTags.map((tag: Tag) => {
                const count = getBookmarkCount(tag.id)
                return (
                  <div key={tag.id} className={styles.tagRow}>
                    <button
                      type='button'
                      className={styles.tagContent}
                      onClick={() => handleTagClick(tag.id)}
                    >
                      <TagItem
                        tagId={tag.id}
                        tagName={tag.name}
                        tags={tags}
                        size='default'
                      />
                      <Text size='1' color='light' className={styles.tagCount}>
                        {count} bookmark{count !== 1 ? 's' : ''}
                      </Text>
                    </button>
                    <div className={styles.tagActions}>
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
        </div>
      </div>

      <Dialog
        title='Edit Tag'
        open={!!editingTag}
        onClose={() => setEditingTag(null)}
        width={420}
        showCloseButton={false}
      >
        {editingTag && (
          <TagEditForm tag={editingTag} onClose={() => setEditingTag(null)} />
        )}
      </Dialog>
    </div>
  )
}
