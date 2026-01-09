import { Edit, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { createTagMap, getTagNameFromMap } from '@/lib/bookmarkUtils'
import type { Bookmark, Tag } from '@/lib/types'
import { getHostname } from '@/lib/utils'

import TagItem from '@/components/parts/TagItem'
import ActionBtn from '@/components/ui/ActionBtn'

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
        return { id: tagId, name: tagName }
      })
      .slice(0, 3) // Limit displayed tags
  }, [bookmark.tags, tagMap])

  const remainingTags = bookmark.tags.length - 3

  return (
    <a
      href={bookmark.url}
      target='_blank'
      rel='noopener noreferrer'
      className={styles.component}
    >
      <div className={styles.favicon}>
        <img
          src={faviconUrl}
          alt=''
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
            <TagItem
              key={tag.id}
              tagId={tag.id}
              tagName={tag.name}
              tags={tags}
              size='small'
            />
          ))}
          {remainingTags > 0 && (
            <span className={styles.tagMore}>+{remainingTags}</span>
          )}
        </div>

        <div className={styles.actions}>
          <ActionBtn
            icon={Plus}
            label='Tags'
            size='sm'
            onClick={onAddTags}
            title='Add tags'
          />
          <ActionBtn
            icon={bookmark.pinned ? PinOff : Pin}
            active={bookmark.pinned}
            size='sm'
            onClick={onTogglePin}
            title={bookmark.pinned ? 'Unpin' : 'Pin'}
          />
          <ActionBtn icon={Edit} size='sm' onClick={onEdit} title='Edit' />
          <ActionBtn
            icon={Trash2}
            danger
            size='sm'
            onClick={onDelete}
            title='Delete'
          />
        </div>
      </div>
    </a>
  )
}
