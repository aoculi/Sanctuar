import { useCallback } from 'react'

import type { Bookmark } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateBookmarkInput } from '@/lib/validation'
import { useManifest } from './useManifest'

export function useBookmarks() {
  const { manifest, save, isSaving } = useManifest()

  const validateBookmark = useCallback(
    (data: { url: string; title: string; picture: string; tags: string[] }) => {
      return validateBookmarkInput(data)
    },
    []
  )

  const addBookmark = useCallback(
    async (bookmark: Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>) => {
      if (!manifest) return

      // Validate input
      const validationError = validateBookmark({
        url: bookmark.url,
        title: bookmark.title,
        picture: bookmark.picture,
        tags: bookmark.tags
      })
      if (validationError) {
        throw new Error(validationError)
      }

      const now = Date.now()
      const newBookmark: Bookmark = {
        ...bookmark,
        id: generateId(),
        created_at: now,
        updated_at: now
      }

      await save({
        ...manifest,
        items: [...(manifest.items || []), newBookmark]
      })
    },
    [manifest, validateBookmark, save]
  )

  const updateBookmark = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Bookmark, 'id' | 'created_at'>>
    ) => {
      if (!manifest) return

      // Validate input if URL or title is being updated
      if (updates.url !== undefined || updates.title !== undefined) {
        const existingBookmark = manifest.items?.find(
          (item: Bookmark) => item.id === id
        )
        if (existingBookmark) {
          const validationData = {
            url: updates.url ?? existingBookmark.url,
            title: updates.title ?? existingBookmark.title,
            picture: updates.picture ?? existingBookmark.picture,
            tags: updates.tags ?? existingBookmark.tags
          }
          const validationError = validateBookmark(validationData)
          if (validationError) {
            throw new Error(validationError)
          }
        }
      }

      await save({
        ...manifest,
        items: (manifest.items || []).map((item: Bookmark) =>
          item.id === id
            ? { ...item, ...updates, updated_at: Date.now() }
            : item
        )
      })
    },
    [manifest, validateBookmark, save]
  )

  const deleteBookmark = useCallback(
    async (id: string) => {
      if (!manifest) return

      await save({
        ...manifest,
        items: (manifest.items || []).filter((item: Bookmark) => item.id !== id)
      })
    },
    [manifest, save]
  )

  const getBookmark = useCallback(
    (id: string): Bookmark | undefined => {
      return manifest?.items?.find((item: Bookmark) => item.id === id)
    },
    [manifest]
  )

  return {
    bookmarks: manifest?.items || [],
    addBookmark,
    updateBookmark,
    deleteBookmark,
    getBookmark
  }
}
