import { EllipsisVertical } from 'lucide-react'

import { getTagName } from '@/lib/bookmarkUtils'
import type { Bookmark, Tag } from '@/lib/types'
import { formatDate, getHostname } from '@/lib/utils'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type Props = {
  bookmark: Bookmark
  tags: Tag[]
  setSelectedBookmark: (id: string) => void
  onDelete: (id: string) => void
}

export function BookmarkCard({
  bookmark,
  tags,
  setSelectedBookmark,
  onDelete
}: Props) {
  return (
    <div className={styles.component}>
      <a
        className={styles.card}
        href={bookmark.url}
        target='_blank'
        rel='noopener noreferrer'
      >
        {bookmark.picture && (
          <div className={styles.picture}>
            <img src={bookmark.picture} alt={bookmark?.title} />
          </div>
        )}

        <div className={styles.content}>
          <Text size='2' weight='medium' color='white' className={styles.name}>
            {bookmark.title || '(Untitled)'}
          </Text>
          <Text size='2' color='light'>
            {getHostname(bookmark.url)}
          </Text>

          <div className={styles.tagsContainer}>
            <div className={styles.tags}>
              {bookmark.tags.length > 0 &&
                bookmark.tags.map((tagId: string) => (
                  <span key={tagId} className={styles.tag}>
                    {getTagName(tagId, tags)}
                  </span>
                ))}
            </div>

            <Text
              size='1'
              color='light'
              style={{
                textAlign: 'right'
              }}
            >
              Updated: {formatDate(bookmark.updated_at)}
            </Text>
          </div>
        </div>
      </a>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild className={styles.dropdownMenu}>
          <Button asIcon={true} color='dark'>
            <EllipsisVertical size={16} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={() => setSelectedBookmark(bookmark.id)}>
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={() => onDelete(bookmark.id)} color='red'>
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  )
}
