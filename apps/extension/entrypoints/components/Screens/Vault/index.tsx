import { Text } from "@radix-ui/themes";

import { keystoreManager } from "@/entrypoints/store/keystore";
import { manifestStore } from "@/entrypoints/store/manifest";
import { useEffect, useState } from "react";
import { useBookmarks, useTags } from "../../../hooks/bookmarks";
import { useManifest } from "../../../hooks/vault";
import type { Bookmark as BookMarkEntity } from "../../../lib/types";
import Bookmarks from "../../Bookmarks";
import Tags from "../../Tags";

import styles from "./styles.module.css";

export default function Vault() {
  const { mutation, store } = useManifest();
  const { bookmarks, addBookmark, updateBookmark, deleteBookmark } =
    useBookmarks();
  const { tags, createTag, renameTag, deleteTag } = useTags();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBookmark, setEditingBookmark] = useState<BookMarkEntity | null>(
    null
  );
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [currentTagId, setCurrentTagId] = useState<string | null>("all");

  // Check keystore status on mount
  useEffect(() => {
    const checkKeystoreStatus = async () => {
      try {
        const unlocked = await keystoreManager.isUnlocked();
        setIsUnlocked(unlocked);
      } catch (error) {
        setIsUnlocked(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkKeystoreStatus();
  }, []);

  // Show messages for manifest operations
  useEffect(() => {
    if (mutation.isSuccess) {
      setMessage("Changes saved successfully");
      setTimeout(() => setMessage(null), 3000);
    } else if (mutation.isError) {
      const error = mutation.error as any;
      if (error?.details?.offline) {
        setMessage("Working offline—will retry");
      } else {
        setMessage("Failed to save changes");
        setTimeout(() => setMessage(null), 3000);
      }
    }
  }, [mutation.isSuccess, mutation.isError]);

  const onSelectTag = (id: string) => {
    setCurrentTagId(id);
  };

  const handleSave = async () => {
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

  const handleRetry = () => {
    handleSave();
  };

  const handleAddBookmark = () => {
    setIsAddingBookmark(true);
    setEditingBookmark(null);
  };

  const handleSaveBookmark = (data: {
    url: string;
    title: string;
    tags: string[];
  }) => {
    try {
      if (editingBookmark) {
        updateBookmark(editingBookmark.id, data);
      } else {
        addBookmark(data);
      }
      setEditingBookmark(null);
      setIsAddingBookmark(false);
    } catch (error) {
      // Show validation error
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save bookmark";
      setMessage(errorMessage);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleCancelEdit = () => {
    setEditingBookmark(null);
    setIsAddingBookmark(false);
  };

  if (isChecking) {
    return (
      <div className={styles.container}>
        <Text>Checking vault status...</Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isUnlocked && store.manifest ? (
        <>
          {/* MODAL: Edit tags */}
          {/* MODAL: Add bookmark */}
          {/* MODAL: Edit bookmark */}

          <Tags
            bookmarks={bookmarks}
            currentTagId={currentTagId}
            onSelectTag={onSelectTag}
          />

          <Bookmarks
            tags={tags}
            message={message}
            setMessage={setMessage}
            onRetry={handleRetry}
          />

          {/* <VaultHeader onSave={handleSave} />

          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddBookmark={handleAddBookmark}
            isManagingTags={isManagingTags}
            onToggleTagManager={() => setIsManagingTags(!isManagingTags)}
          />

          {(isAddingBookmark || editingBookmark) && (
            <BookmarkEditModal
              bookmark={editingBookmark}
              tags={tags}
              onSave={handleSaveBookmark}
              onCancel={handleCancelEdit}
            />
          )} */}
        </>
      ) : (
        <>
          <p className={styles.errorMessage}>🔒 Vault Locked</p>
          <p>Your vault is locked. Please login again to unlock it.</p>
          <p>
            This may happen if the extension was restarted or keys were cleared.
          </p>
        </>
      )}
    </div>
  );
}
