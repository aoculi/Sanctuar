/**
 * Individual bookmark card component
 */
import { getTagName } from '../../lib/bookmarkUtils';
import { formatDate, getHostname } from '../../lib/formatUtils';
import type { Bookmark, Tag } from '../../lib/types';
import styles from './styles.module.css';

type Props = {
    bookmark: Bookmark;
    tags: Tag[];
    onEdit: (bookmark: Bookmark) => void;
    onDelete: (id: string) => void;
};

export function BookmarkCard({ bookmark, tags, onEdit, onDelete }: Props) {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <h4 className={styles.title}>
                    {bookmark.title || '(Untitled)'}
                </h4>
                <div className={styles.actions}>
                    <button
                        onClick={() => onEdit(bookmark)}
                        className={styles.iconButton}
                        title="Edit"
                    >
                        ✏️
                    </button>
                    <button
                        onClick={() => onDelete(bookmark.id)}
                        className={styles.iconButton}
                        title="Delete"
                    >
                        🗑️
                    </button>
                </div>
            </div>
            <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.url}
            >
                {getHostname(bookmark.url)}
            </a>
            {bookmark.notes && (
                <p className={styles.notes}>{bookmark.notes}</p>
            )}
            {bookmark.tags.length > 0 && (
                <div className={styles.tags}>
                    {bookmark.tags.map((tagId: string) => (
                        <span key={tagId} className={styles.tag}>
                            {getTagName(tagId, tags)}
                        </span>
                    ))}
                </div>
            )}
            <div className={styles.meta}>
                Updated: {formatDate(bookmark.updated_at)}
            </div>
        </div>
    );
}
