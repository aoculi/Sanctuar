import { useState } from "react";

import { useBookmarks } from "@/entrypoints/hooks/useBookmarks";
import { useManifest } from "@/entrypoints/hooks/vault";
import { manifestStore } from "@/entrypoints/store/manifest";
import type { Bookmark, Tag } from "../../lib/types";
import BookmarkHeader from "./BookmarkHeader";
import { BookmarkList } from "./BookmarkList";
import { BookmarkModal } from "./BookmarkModal";
import { MessageBanner } from "./MessageBanner";

import styles from "./styles.module.css";

export default function Bookmarks({
  message,
  setMessage,
  tags,
}: {
  message: string | null;
  setMessage: (message: string | null) => void;
  tags: Tag[];
}) {
  const { bookmarks, addBookmark, updateBookmark, deleteBookmark } =
    useBookmarks();
  const { mutation, store } = useManifest();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tmpBookmark, setTmpBookmark] = useState<Bookmark | null>(null);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null
  );

  const handleShowBookmarkModal = (bookmark: Bookmark) => {
    setIsModalOpen(true);
    setSelectedBookmark(bookmark);
  };

  const handleCloseBookmarkModal = () => {
    setIsModalOpen(false);
    setSelectedBookmark(null);
    setTmpBookmark(null);
  };

  const handleShowCreateBookmarkModal = () => {
    setIsModalOpen(true);
    setSelectedBookmark(null);
    setTmpBookmark(null);
  };

  const handleSaveBookmark = (data: {
    url: string;
    title: string;
    tags: string[];
  }) => {
    setTmpBookmark(null);
    try {
      if (selectedBookmark) {
        updateBookmark(selectedBookmark.id, data);
      } else {
        addBookmark(data);
      }
    } catch (error) {
      // Show validation error
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save bookmark";
      setMessage(errorMessage);
      // setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDeleteBookmark = (id: string) => {
    setTmpBookmark(null);
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

  const handleSaveManifest = async () => {
    setTmpBookmark(null);
    if (!(store.status === "dirty" || store.status === "offline")) return;
    if (mutation.isPending) return;
    try {
      const saveData = manifestStore.getSaveData();
      if (saveData) {
        // mark saving to prevent debounce-triggered autosave overlap
        manifestStore.setSaving();
        await mutation.mutateAsync(saveData);
      }
    } catch (error) {
      // handled in useEffect
    }
  };

  const handleQuickAdd = async () => {
    try {
      // Get current tab via background script (more reliable than direct API call)
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ type: "tabs:getCurrent" }, (response) => {
          resolve(response);
        });
      });

      if (!response?.ok || !response?.tab) {
        setMessage(response?.error || "Unable to get current page information");
        return;
      }

      const tab = response.tab;

      if (!tab?.url || !tab?.title) {
        setMessage("Unable to get current page information");
        return;
      }

      // Filter out chrome:// and other internal URLs if needed
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://")
      ) {
        setMessage("Cannot bookmark internal browser pages");
        return;
      }

      setSelectedBookmark(null);
      setIsModalOpen(true);

      setTmpBookmark({
        id: "", // empty id = new bookmark
        url: tab.url,
        title: tab.title,
        tags: [], // explicitly set to empty array
        created_at: 0,
        updated_at: 0,
      } as Bookmark);
    } catch (error) {
      console.log("error", error);

      const errorMessage =
        error instanceof Error ? error.message : "Failed to get current page";
      setMessage(errorMessage);
    }
  };

  return (
    <div className={styles.container}>
      <BookmarkModal
        isOpen={isModalOpen}
        bookmark={selectedBookmark}
        onClose={handleCloseBookmarkModal}
        onSave={handleSaveBookmark}
        tags={tags}
        tmp={tmpBookmark}
      />

      <BookmarkHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddBookmark={handleShowCreateBookmarkModal}
        onQuickAdd={handleQuickAdd}
      />

      {bookmarks.length === 0 ? (
        <MessageBanner
          message="No bookmarks found"
          onRetry={handleSaveManifest}
        />
      ) : (
        <>
          <MessageBanner message={message} onRetry={handleSaveManifest} />
          <BookmarkList
            bookmarks={bookmarks}
            tags={tags}
            searchQuery={searchQuery}
            onEdit={handleShowBookmarkModal}
            onDelete={handleDeleteBookmark}
          />
        </>
      )}
    </div>
  );
}
