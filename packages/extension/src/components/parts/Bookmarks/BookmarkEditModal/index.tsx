import { X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

import BookmarkForm, {
  type BookmarkFormData
} from '@/components/parts/Bookmarks/BookmarkForm'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface BookmarkEditModalProps {
  bookmark: Bookmark | null
  onClose: () => void
}

export default function BookmarkEditModal({
  bookmark,
  onClose
}: BookmarkEditModalProps) {
  const { updateBookmark } = useBookmarks()
  const { setFlash } = useNavigation()
  const modalRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (bookmark) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [bookmark, handleKeyDown, handleClickOutside])

  const handleSubmit = async (data: BookmarkFormData) => {
    if (!bookmark) return

    try {
      await updateBookmark(bookmark.id, {
        url: data.url,
        title: data.title,
        note: data.note,
        picture: data.picture,
        tags: data.tags,
        collectionId: data.collectionId
      })
      onClose()
    } catch (error) {
      setFlash(
        'Failed to update bookmark: ' +
          ((error as Error).message ?? 'Unknown error')
      )
    }
  }

  if (!bookmark) return null

  return (
    <div className={styles.overlay}>
      <div ref={modalRef} className={styles.modal}>
        <div className={styles.header}>
          <Text size='3' weight='medium'>
            Edit Bookmark
          </Text>
          <button
            type='button'
            className={styles.closeButton}
            onClick={onClose}
            aria-label='Close'
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.content}>
          <BookmarkForm
            initialData={{
              url: bookmark.url,
              title: bookmark.title,
              note: bookmark.note,
              picture: bookmark.picture,
              tags: bookmark.tags,
              collectionId: bookmark.collectionId
            }}
            onSubmit={handleSubmit}
            submitLabel='Save'
          />
        </div>
      </div>
    </div>
  )
}
