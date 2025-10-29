/**
 * Bookmarks list component
 */
import { filterBookmarks } from '../../lib/bookmarkUtils';
import type { Bookmark, Tag } from '../../lib/types';
import { BookmarkCard } from '../BookmarkCard';
import styles from './styles.module.css';

type Props = {
    bookmarks: Bookmark[];
    tags: Tag[];
    searchQuery: string;
    onEdit: (bookmark: Bookmark) => void;
    onDelete: (id: string) => void;
};

export function BookmarkList({ bookmarks, tags, searchQuery, onEdit, onDelete }: Props) {
    const filteredBookmarks = filterBookmarks(bookmarks, tags, searchQuery);

    return (
        <div className={styles.list}>
            <h3 className={styles.title}>
                Bookmarks ({filteredBookmarks.length}{filteredBookmarks.length !== bookmarks.length ? ` of ${bookmarks.length}` : ''})
            </h3>
            {filteredBookmarks.length === 0 ? (
                <p className={styles.emptyState}>
                    {bookmarks.length === 0
                        ? 'No bookmarks yet. Click "Add Bookmark" to get started.'
                        : 'No bookmarks match your search.'}
                </p>
            ) : (
                <div className={styles.grid}>
                    {filteredBookmarks.map((bookmark: Bookmark) => (
                        <BookmarkCard
                            key={bookmark.id}
                            bookmark={bookmark}
                            tags={tags}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
