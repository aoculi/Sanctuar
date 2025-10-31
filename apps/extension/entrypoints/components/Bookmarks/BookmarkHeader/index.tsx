import { Button, TextField } from "@radix-ui/themes";
import { Search } from "lucide-react";

import styles from "./styles.module.css";

export default function BookmarkHeader({
  searchQuery,
  onSearchChange,
  onAddBookmark,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddBookmark: () => void;
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

      <Button onClick={onAddBookmark}>Add Bookmark</Button>
    </div>
  );
}
