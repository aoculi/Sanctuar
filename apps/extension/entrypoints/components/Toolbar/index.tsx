/**
 * Toolbar component
 */
import { SearchBar } from "../Bookmarks/SearchBar";
import styles from "./styles.module.css";

type Props = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddBookmark: () => void;
  isManagingTags: boolean;
  onToggleTagManager: () => void;
};

export function Toolbar({
  searchQuery,
  onSearchChange,
  onAddBookmark,
  isManagingTags,
  onToggleTagManager,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <SearchBar value={searchQuery} onChange={onSearchChange} />
      <button onClick={onAddBookmark} className={styles.actionButton}>
        Add Bookmark
      </button>
      <button onClick={onToggleTagManager} className={styles.actionButton}>
        {isManagingTags ? "Hide Tags" : "Manage Tags"}
      </button>
    </div>
  );
}
