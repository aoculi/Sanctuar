import { Plus, Search } from "lucide-react";

import Button from "@/entrypoints/components/ui/Button";

import styles from "./styles.module.css";

export default function BookmarkHeader({
  searchQuery,
  onSearchChange,
  onQuickAdd,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickAdd: () => void;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.searchBarContainer}>
        <Search strokeWidth={1} size={16} />
        <input
          type="text"
          placeholder="Search bookmarks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <Button
        onClick={onQuickAdd}
        color="light"
        variant="solid"
        size="sm"
        asIcon={true}
        style={{ position: "absolute", right: "12px", zIndex: 3 }}
      >
        <Plus strokeWidth={1} size={18} />
      </Button>
    </div>
  );
}
