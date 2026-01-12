import { Edit } from 'lucide-react'

import { useTags } from '@/components/hooks/useTags'
import type { Tag } from '@/lib/types'

import TagItem from '@/components/parts/Tags/TagItem'
import ActionBtn from '@/components/ui/ActionBtn'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface PinnedTagsProps {
  selectedTags: string[]
  onTagClick: (tagId: string) => void
  onManageTags: () => void
}

export default function PinnedTags({
  selectedTags,
  onTagClick,
  onManageTags
}: PinnedTagsProps) {
  const { tags, pinnedTags, showHiddenTags } = useTags()

  // Filter out hidden tags when showHiddenTags is false
  const visiblePinnedTags = showHiddenTags
    ? pinnedTags
    : pinnedTags.filter((tag: Tag) => !tag.hidden)

  return (
    <div className={styles.component}>
      <div className={styles.header}>
        <Text as='span' size='2' color='light'>
          Pinned Tags
        </Text>
        <ActionBtn
          icon={Edit}
          size='sm'
          onClick={onManageTags}
          title='Manage tags'
        />
      </div>
      {visiblePinnedTags.length > 0 && (
        <div className={styles.tagsList}>
          {visiblePinnedTags.map((tag: Tag) => {
            const isSelected = selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                type='button'
                className={`${styles.tagButton} ${isSelected ? styles.selected : ''}`}
                onClick={() => onTagClick(tag.id)}
              >
                <TagItem tagId={tag.id} tagName={tag.name} tags={tags} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
