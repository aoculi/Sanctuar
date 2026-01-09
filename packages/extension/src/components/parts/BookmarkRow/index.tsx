import { Edit, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { createTagMap, getTagColor, getTagNameFromMap } from '@/lib/bookmarkUtils'
import type { Bookmark, Tag } from '@/lib/types'
import { getHostname } from '@/lib/utils'

import styles from './styles.module.css'

interface BookmarkRowProps {
  bookmark: Bookmark
  tags: Tag[]
  onAddTags?: () => void
  onTogglePin?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function BookmarkRow({
  bookmark,
  tags,
  onAddTags,
  onTogglePin,
  onEdit,
  onDelete
}: BookmarkRowProps) {
  const tagMap = useMemo(() => createTagMap(tags), [tags])
  const hostname = getHostname(bookmark.url)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

  const bookmarkTags = useMemo(() => {
    return bookmark.tags
      .map((tagId) => {
        const tagName = getTagNameFromMap(tagId, tagMap)
        const colorInfo = getTagColor(tagId, tags)
        return { id: tagId, name: tagName, colorInfo }
      })
      .slice(0, 3) // Limit displayed tags
  }, [bookmark.tags, tagMap, tags])

  const remainingTags = bookmark.tags.length - 3

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.component}
    >
      <div className={styles.favicon}>
        <img
          src={faviconUrl}
          alt=""
          width={16}
          height={16}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <div className={styles.info}>
        <span className={styles.title}>{bookmark.title || '(Untitled)'}</span>
        <span className={styles.domain}>{hostname}</span>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.tags}>
          {bookmarkTags.map((tag) => (
            <span
              key={tag.id}
              className={styles.tag}
              style={{
                backgroundColor: tag.colorInfo?.tagColor ?? 'var(--primary)',
                color: tag.colorInfo?.textColor ?? 'white'
              }}
            >
              {tag.name}
            </span>
          ))}
          {remainingTags > 0 && (
            <span className={styles.tagMore}>+{remainingTags}</span>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAddTags?.()
            }}
            title="Add tags"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Tags</span>
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionIcon} ${bookmark.pinned ? styles.actionActive : ''}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onTogglePin?.()
            }}
            title={bookmark.pinned ? 'Unpin' : 'Pin'}
          >
            {bookmark.pinned ? <PinOff size={14} strokeWidth={2} /> : <Pin size={14} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionIcon}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit?.()
            }}
            title="Edit"
          >
            <Edit size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionIcon} ${styles.actionDanger}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete?.()
            }}
            title="Delete"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </a>
  )
}
