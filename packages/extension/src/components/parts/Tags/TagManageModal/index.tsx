import { Edit, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useTags } from '@/components/hooks/useTags'
import type { Tag } from '@/lib/types'

import TagItem from '@/components/parts/TagItem'
import ActionBtn from '@/components/ui/ActionBtn'
import { Dialog } from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface TagManageModalProps {
  open: boolean
  onClose: () => void
}

export default function TagManageModal({ open, onClose }: TagManageModalProps) {
  const { tags, showHiddenTags } = useTags()
  const [searchQuery, setSearchQuery] = useState('')

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

  const handleUpdate = (tag: Tag) => {
    // TODO: Wire up update action
    console.log('Update tag:', tag)
  }

  const handleDelete = (tag: Tag) => {
    // TODO: Wire up delete action
    console.log('Delete tag:', tag)
  }

  return (
    <Dialog title='Manage Tags' open={open} onClose={onClose} width={420} showCloseButton={false}>
      <div className={styles.content}>
        <div className={styles.searchContainer}>
          <Input
            type='text'
            placeholder='Search tags...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            filteredTags.map((tag: Tag) => (
              <div key={tag.id} className={styles.tagRow}>
                <div className={styles.tagContent}>
                  <TagItem
                    tagId={tag.id}
                    tagName={tag.name}
                    tags={tags}
                    size='default'
                  />
                </div>
                <div className={styles.tagActions}>
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
            ))
          )}
        </div>
      </div>
    </Dialog>
  )
}
