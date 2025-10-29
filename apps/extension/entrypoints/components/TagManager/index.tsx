/**
 * Tag manager component
 */
import type { Tag } from '../../lib/types';
import styles from './styles.module.css';

type Props = {
    tags: Tag[];
    onCreate: () => void;
    onRename: (tag: Tag) => void;
    onDelete: (id: string) => void;
};

export function TagManager({ tags, onCreate, onRename, onDelete }: Props) {
    return (
        <div className={styles.manager}>
            <h3 className={styles.title}>Tags</h3>
            <div className={styles.tagList}>
                {tags.length === 0 ? (
                    <p className={styles.emptyState}>No tags yet</p>
                ) : (
                    tags.map(tag => (
                        <div key={tag.id} className={styles.tagItem}>
                            <span className={styles.tagName}>{tag.name}</span>
                            <button
                                onClick={() => onRename(tag)}
                                className={styles.button}
                            >
                                Rename
                            </button>
                            <button
                                onClick={() => onDelete(tag.id)}
                                className={styles.button}
                            >
                                Delete
                            </button>
                        </div>
                    ))
                )}
                <button
                    onClick={onCreate}
                    className={styles.addButton}
                >
                    + Add Tag
                </button>
            </div>
        </div>
    );
}
