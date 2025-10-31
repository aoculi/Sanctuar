import { Button, TextField } from "@radix-ui/themes";
import { Plus, Search } from "lucide-react";

import { useLogout } from "@/entrypoints/hooks/auth";

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
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      // Error handling done via logoutMutation.error in UI
    }
  };

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

      <Button onClick={onAddBookmark} className={styles.addBookmarkButton}>
        <Plus strokeWidth={1} />
      </Button>
      {/* <Button onClick={handleLogout} disabled={logoutMutation.isPending}>
        {logoutMutation.isPending ? "Logging out..." : "Logout"}
      </Button> */}
    </div>
  );
}
