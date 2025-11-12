import { useCallback } from "react";

import { generateId } from "@/entrypoints/lib/id";
import type { Bookmark } from "@/entrypoints/lib/types";
import { manifestStore } from "@/entrypoints/store/manifest";
import { useManifestOperations } from "./useManifestOperations";
import { useBookmarkValidation } from "./validation";

export function useBookmarks() {
  const { store } = useManifestOperations();
  const { validateBookmark } = useBookmarkValidation();

  const addBookmark = useCallback(
    (bookmark: Omit<Bookmark, "id" | "created_at" | "updated_at">) => {
      if (!store.manifest) return;

      // Validate input
      const validationError = validateBookmark({
        url: bookmark.url,
        title: bookmark.title,
        picture: bookmark.picture,
        tags: bookmark.tags,
      });
      if (validationError) {
        throw new Error(validationError);
      }

      const now = Date.now();
      const newBookmark: Bookmark = {
        ...bookmark,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };

      // Apply to manifestStore - this will markDirty() automatically
      manifestStore.apply((manifest) => ({
        ...manifest,
        items: [...(manifest.items || []), newBookmark],
      }));
    },
    [store.manifest, validateBookmark],
  );

  const updateBookmark = useCallback(
    (id: string, updates: Partial<Omit<Bookmark, "id" | "created_at">>) => {
      if (!store.manifest) return;

      // Validate input if URL or title is being updated
      if (updates.url !== undefined || updates.title !== undefined) {
        const existingBookmark = store.manifest.items?.find(
          (item: Bookmark) => item.id === id,
        );
        if (existingBookmark) {
          const validationData = {
            url: updates.url ?? existingBookmark.url,
            title: updates.title ?? existingBookmark.title,
            picture: updates.picture ?? existingBookmark.picture,
            tags: updates.tags ?? existingBookmark.tags,
          };
          const validationError = validateBookmark(validationData);
          if (validationError) {
            throw new Error(validationError);
          }
        }
      }

      // Apply update with updated_at timestamp
      manifestStore.apply((manifest) => ({
        ...manifest,
        items: (manifest.items || []).map((item: Bookmark) =>
          item.id === id
            ? { ...item, ...updates, updated_at: Date.now() }
            : item,
        ),
      }));
    },
    [store.manifest, validateBookmark],
  );

  const deleteBookmark = useCallback(
    (id: string) => {
      if (!store.manifest) return;

      manifestStore.apply((manifest) => ({
        ...manifest,
        items: (manifest.items || []).filter(
          (item: Bookmark) => item.id !== id,
        ),
      }));
    },
    [store.manifest],
  );

  const getBookmark = useCallback(
    (id: string): Bookmark | undefined => {
      return store.manifest?.items?.find((item: Bookmark) => item.id === id);
    },
    [store.manifest],
  );

  return {
    bookmarks: store.manifest?.items || [],
    addBookmark,
    updateBookmark,
    deleteBookmark,
    getBookmark,
  };
}
