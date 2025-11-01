import { Button, TextField } from "@radix-ui/themes";
import { Plus, Search, Zap } from "lucide-react"; // Add Zap icon

import styles from "./styles.module.css";

export default function BookmarkHeader({
  searchQuery,
  onSearchChange,
  onAddBookmark,
  onQuickAdd, // Add this new prop
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddBookmark: () => void;
  onQuickAdd: () => void; // Add this
}) {
  return (
    <div className={styles.container}>
      <TextField.Root
        className={styles.searchBar}
        placeholder="Search bookmarks..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      >
        <TextField.Slot>
          <Search height="16" width="16" />
        </TextField.Slot>
      </TextField.Root>

      <Button onClick={onQuickAdd} className={styles.quickAddButton}>
        <Zap strokeWidth={1} />
      </Button>

      <Button onClick={onAddBookmark} className={styles.addBookmarkButton}>
        <Plus strokeWidth={1} />
      </Button>
    </div>
  );
}
