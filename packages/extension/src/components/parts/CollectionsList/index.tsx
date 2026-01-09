import { Folder, Inbox } from 'lucide-react'
import { useMemo } from 'react'

import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { getIconByName } from '@/components/ui/IconPicker'
import { flattenCollectionsWithBookmarks } from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'

import BookmarkRow from '@/components/parts/BookmarkRow'
import Collapsible from '@/components/parts/Collapsible'

import styles from './styles.module.css'

export default function CollectionsList() {
  const { bookmarks } = useBookmarks()
  const { collections } = useCollections()
  const { tags } = useTags()

  // Get non-pinned bookmarks
  const nonPinnedBookmarks = useMemo(() => {
    return bookmarks.filter((b: Bookmark) => !b.pinned)
  }, [bookmarks])

  // Get collections with their bookmarks
  const collectionsWithBookmarks = useMemo(
    () =>
      flattenCollectionsWithBookmarks(
        collections,
        nonPinnedBookmarks,
        'updated_at'
      ),
    [collections, nonPinnedBookmarks]
  )

  // Get uncategorized bookmarks (not pinned, not in any collection)
  const uncategorizedBookmarks = useMemo(
    () => nonPinnedBookmarks.filter((b: Bookmark) => !b.collectionId),
    [nonPinnedBookmarks]
  )

  if (
    collectionsWithBookmarks.length === 0 &&
    uncategorizedBookmarks.length === 0
  ) {
    return null
  }

  return (
    <div className={styles.component}>
      {collectionsWithBookmarks.map(
        ({ collection, bookmarks: collectionBookmarks, depth }) => {
          const Icon = collection.icon ? getIconByName(collection.icon) : Folder

          return (
            <Collapsible
              key={collection.id}
              icon={Icon}
              label={collection.name}
              count={collectionBookmarks.length}
              depth={depth}
              defaultOpen={false}
            >
              {collectionBookmarks.length > 0 && (
                <div className={styles.bookmarksList}>
                  {collectionBookmarks.map((bookmark: Bookmark) => (
                    <BookmarkRow
                      key={bookmark.id}
                      bookmark={bookmark}
                      tags={tags}
                    />
                  ))}
                </div>
              )}
            </Collapsible>
          )
        }
      )}

      {uncategorizedBookmarks.length > 0 && (
        <Collapsible
          icon={Inbox}
          label='Uncategorized'
          count={uncategorizedBookmarks.length}
          defaultOpen={false}
        >
          <div className={styles.bookmarksList}>
            {uncategorizedBookmarks.map((bookmark: Bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} tags={tags} />
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
