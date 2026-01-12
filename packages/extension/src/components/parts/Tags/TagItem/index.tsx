import { X } from 'lucide-react'

import { getTagColor } from '@/lib/bookmarkUtils'
import type { Tag } from '@/lib/types'

import styles from './styles.module.css'

interface TagItemProps {
  tagId: string
  tagName: string
  tags: Tag[]
  onRemove?: () => void
  size?: 'small' | 'default'
}

export default function TagItem({
  tagId,
  tagName,
  tags,
  onRemove,
  size = 'default'
}: TagItemProps) {
  const colorInfo = getTagColor(tagId, tags)

  return (
    <span
      className={`${styles.tag} ${size === 'small' ? styles.tagSmall : ''}`}
      style={{
        backgroundColor: colorInfo?.tagColor ?? 'var(--primary)',
        color: colorInfo?.textColor ?? 'white'
      }}
    >
      <span className={styles.tagName}>{tagName}</span>
      {onRemove && (
        <button
          type='button'
          className={styles.tagRemove}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{ color: colorInfo?.textColor ?? 'white' }}
          aria-label={`Remove ${tagName} tag`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
