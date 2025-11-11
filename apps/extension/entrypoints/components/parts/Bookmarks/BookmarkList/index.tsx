import { useEffect, useMemo, useState } from "react";

import { BookmarkCard } from "@/entrypoints/components/parts/Bookmarks/BookmarkCard";
import Text from "@/entrypoints/components/ui/Text";
import { filterBookmarks } from "@/entrypoints/lib/bookmarkUtils";
import type { Bookmark, Tag } from "@/entrypoints/lib/types";
import { settingsStore } from "@/entrypoints/store/settings";

import styles from "./styles.module.css";

type Props = {
  bookmarks: Bookmark[];
  tags: Tag[];
  searchQuery: string;
  currentTagId: string | null;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
};

export function BookmarkList({
  bookmarks,
  tags,
  searchQuery,
  currentTagId,
  onEdit,
  onDelete,
}: Props) {
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  // Subscribe to settings changes
  useEffect(() => {
    const loadSettings = async () => {
      const currentState = await settingsStore.getState();
      setShowHiddenTags(currentState.showHiddenTags);
    };

    loadSettings();

    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState();
      setShowHiddenTags(state.showHiddenTags);
    });

    return unsubscribe;
  }, []);

  // Create a set of hidden tag IDs for efficient lookup
  const hiddenTagIds = useMemo(() => {
    return new Set(tags.filter((tag) => tag.hidden).map((tag) => tag.id));
  }, [tags]);

  // Filter bookmarks based on search, selected tag, and hidden tags
  const filteredBookmarks = useMemo(() => {
    let filtered = filterBookmarks(bookmarks, tags, searchQuery);

    // Filter by selected tag (if not "all" or null)
    if (currentTagId && currentTagId !== "all") {
      filtered = filtered.filter((bookmark) =>
        bookmark.tags.includes(currentTagId)
      );
    }

    // Filter out bookmarks with hidden tags when showHiddenTags is false
    if (!showHiddenTags) {
      filtered = filtered.filter((bookmark) => {
        // Check if bookmark has any hidden tag
        return !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId));
      });
    }

    return filtered;
  }, [
    bookmarks,
    tags,
    searchQuery,
    currentTagId,
    showHiddenTags,
    hiddenTagIds,
  ]);

  return (
    <div className={styles.container}>
      <Text size="2" color="light" style={{ padding: "20px 20px 0" }}>
        Bookmarks ({filteredBookmarks.length}
        {filteredBookmarks.length !== bookmarks.length
          ? ` of ${bookmarks.length}`
          : ""}
        )
      </Text>

      {filteredBookmarks.length === 0 ? (
        <Text size="2" color="light" style={{ padding: "20px 20px 0" }}>
          {bookmarks.length === 0
            ? 'No bookmarks yet. Click "Add Bookmark" to get started.'
            : "No bookmarks match your search."}
        </Text>
      ) : (
        <div className={styles.list}>
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
