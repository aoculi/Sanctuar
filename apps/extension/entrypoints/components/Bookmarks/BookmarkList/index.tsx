/**
 * Bookmarks list component
 */
import { Text } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";

import { filterBookmarks } from "../../../lib/bookmarkUtils";
import type { Bookmark, Tag } from "../../../lib/types";
import { settingsStore } from "../../../store/settings";
import { BookmarkCard } from "../BookmarkCard";

import styles from "./styles.module.css";

type Props = {
  bookmarks: Bookmark[];
  tags: Tag[];
  searchQuery: string;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
};

export function BookmarkList({
  bookmarks,
  tags,
  searchQuery,
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

  // Filter bookmarks based on search and hidden tags
  const filteredBookmarks = useMemo(() => {
    let filtered = filterBookmarks(bookmarks, tags, searchQuery);

    // Filter out bookmarks with hidden tags when showHiddenTags is false
    if (!showHiddenTags) {
      filtered = filtered.filter((bookmark) => {
        // Check if bookmark has any hidden tag
        return !bookmark.tags.some((tagId) => hiddenTagIds.has(tagId));
      });
    }

    return filtered;
  }, [bookmarks, tags, searchQuery, showHiddenTags, hiddenTagIds]);

  return (
    <div className={styles.container}>
      <Text size="2" color="gray" style={{ padding: "20px 20px 0" }}>
        Bookmarks ({filteredBookmarks.length}
        {filteredBookmarks.length !== bookmarks.length
          ? ` of ${bookmarks.length}`
          : ""}
        )
      </Text>

      {filteredBookmarks.length === 0 ? (
        <Text size="1" color="gray" style={{ padding: "20px 20px 0" }}>
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
