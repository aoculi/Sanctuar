import { useBookmarks } from "@/entrypoints/hooks/useBookmarks";
import type { Bookmark, Tag } from "../../lib/types";
import BookmarkHeader from "./BookmarkHeader";
import { BookmarkList } from "./BookmarkList";
import { MessageBanner } from "./MessageBanner";

import styles from "./styles.module.css";

export default function Bookmarks({
  message,
  setMessage,
  onRetry,
  tags,
}: {
  message: string | null;
  setMessage: (message: string | null) => void;
  onRetry: () => void;
  tags: Tag[];
}) {
  const { bookmarks, addBookmark, updateBookmark, deleteBookmark } =
    useBookmarks();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);

  const handleEditBookmark = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setIsAddingBookmark(false);
  };

  const handleAddBookmark = () => {
    setIsAddingBookmark(true);
    setEditingBookmark(null);
  };

  const handleDeleteBookmark = (id: string) => {
    if (confirm("Are you sure you want to delete this bookmark?")) {
      try {
        deleteBookmark(id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete bookmark";
        setMessage(errorMessage);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  return (
    <div className={styles.container}>
      <BookmarkHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddBookmark={handleAddBookmark}
      />

      <MessageBanner message={message} onRetry={onRetry} />

      <BookmarkList
        bookmarks={bookmarks}
        tags={tags}
        searchQuery={searchQuery}
        onEdit={handleEditBookmark}
        onDelete={handleDeleteBookmark}
      />
    </div>
  );
}
