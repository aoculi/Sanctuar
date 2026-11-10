import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import type { Bookmark } from '@/lib/types'

import BookmarkForm, {
  type BookmarkFormData
} from '@/components/parts/Bookmarks/BookmarkForm'
import { Dialog } from '@/components/ui/Dialog'

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

  const handleSubmit = async (data: BookmarkFormData) => {
    if (!bookmark) return

    try {
      await updateBookmark(bookmark.id, {
        url: data.url,
        title: data.title,
        note: data.note,
        description: data.description || undefined,
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

  return (
    <Dialog
      title='Edit Bookmark'
      open={bookmark !== null}
      onClose={onClose}
      width={420}
      showCloseButton={false}
    >
      {bookmark && (
        <div className={styles.content}>
          <BookmarkForm
            initialData={{
              url: bookmark.url,
              title: bookmark.title,
              note: bookmark.note,
              description: bookmark.description ?? '',
              picture: bookmark.picture,
              tags: bookmark.tags,
              collectionId: bookmark.collectionId
            }}
            onSubmit={handleSubmit}
            submitLabel='Save'
          />
        </div>
      )}
    </Dialog>
  )
}
