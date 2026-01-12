import { useCallback } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import type { Bookmark } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateBookmarkInput } from '@/lib/validation'

export function useBookmarks() {
  const { manifest, save } = useManifest()

  const validateBookmark = useCallback(
    (data: {
      url: string
      title: string
      note: string
      picture: string
      tags: string[]
    }) => {
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
        note: bookmark.note,
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

  /**
   * Batch add multiple bookmarks in a single save operation to avoid version conflicts
   */
  const addBookmarks = useCallback(
    async (
      bookmarks: Array<Omit<Bookmark, 'id' | 'created_at' | 'updated_at'>>
    ) => {
      if (!manifest) {
        throw new Error('Cannot add bookmarks: manifest not loaded')
      }

      const now = Date.now()
      const newBookmarks: Bookmark[] = []

      // Validate all bookmarks first
      for (const bookmark of bookmarks) {
        const validationError = validateBookmark({
          url: bookmark.url,
          title: bookmark.title,
          note: bookmark.note,
          picture: bookmark.picture,
          tags: bookmark.tags
        })
        if (validationError) {
          throw new Error(
            `Validation error for "${bookmark.title}": ${validationError}`
          )
        }

        newBookmarks.push({
          ...bookmark,
          id: generateId(),
          created_at: now,
          updated_at: now
        })
      }

      // Add all bookmarks in a single save operation
      await save({
        ...manifest,
        items: [...(manifest.items || []), ...newBookmarks]
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
            note: updates.note ?? existingBookmark.note,
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

  const deleteBookmarks = useCallback(
    async (ids: string[]) => {
      if (!manifest) return

      const idSet = new Set(ids)
      await save({
        ...manifest,
        items: (manifest.items || []).filter((item: Bookmark) => !idSet.has(item.id))
      })
    },
    [manifest, save]
  )

  const updateBookmarks = useCallback(
    async (
      ids: string[],
      updates: Partial<Omit<Bookmark, 'id' | 'created_at'>>
    ) => {
      if (!manifest) return

      await save({
        ...manifest,
        items: (manifest.items || []).map((item: Bookmark) =>
          ids.includes(item.id)
            ? { ...item, ...updates, updated_at: Date.now() }
            : item
        )
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
    bookmarks: [...(manifest?.items || [])],
    addBookmark,
    addBookmarks,
    updateBookmark,
    updateBookmarks,
    deleteBookmark,
    deleteBookmarks,
    getBookmark
  }
}
