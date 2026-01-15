import { useCallback } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import type { Bookmark, Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateTagName } from '@/lib/validation'

export function useTags() {
  const { manifest, save, isSaving } = useManifest()

  const createTag = useCallback(
    async (tag: Omit<Tag, 'id'>): Promise<Tag> => {
      if (!manifest) {
        throw new Error('Cannot create tag: manifest not loaded')
      }

      // Validate tag name
      const validationError = validateTagName(tag.name)
      if (validationError) {
        throw new Error(validationError)
      }

      const trimmedName = tag.name.trim()

      // Check for duplicate tag names
      const existingTag = manifest.tags?.find(
        (t: Tag) => t.name.toLowerCase() === trimmedName.toLowerCase()
      )
      if (existingTag) {
        throw new Error('A tag with this name already exists')
      }

      const newTag: Tag = {
        ...tag,
        id: generateId(),
        name: trimmedName,
        pinned: tag.pinned ?? false
      }

      await save({
        ...manifest,
        tags: [...(manifest.tags || []), newTag]
      })

      return newTag
    },
    [manifest, save]
  )

  const updateTag = useCallback(
    async (id: string, updates: Partial<Omit<Tag, 'id' | 'created_at'>>) => {
      if (!manifest) return

      const validationError = validateTagName(updates.name ?? '')
      if (validationError) {
        throw new Error(validationError)
      }

      const existingTag = manifest.tags?.find((item: Tag) => item.id === id)
      if (existingTag) {
        const validationData = {
          name: updates.name ?? existingTag.name,
          pinned: 'pinned' in updates ? updates.pinned : existingTag.pinned,
          color: 'color' in updates ? updates.color : existingTag.color
        }

        await save({
          ...manifest,
          tags: (manifest.tags || []).map((item: Tag) =>
            item.id === id
              ? { ...item, ...validationData, updated_at: Date.now() }
              : item
          )
        })
      }
    },
    [manifest, save]
  )

  const deleteTag = useCallback(
    async (id: string) => {
      if (!manifest) return

      // Remove tag from manifest and from all bookmarks atomically
      await save({
        ...manifest,
        tags: (manifest.tags || []).filter((tag: Tag) => tag.id !== id),
        items: (manifest.items || []).map((bookmark: Bookmark) => ({
          ...bookmark,
          tags: bookmark.tags.filter((tagId: string) => tagId !== id)
        }))
      })
    },
    [manifest, save]
  )

  const getTag = useCallback(
    (id: string): Tag | undefined => {
      return manifest?.tags?.find((tag: Tag) => tag.id === id)
    },
    [manifest]
  )

  const togglePinTag = useCallback(
    async (id: string) => {
      if (!manifest) return

      const existingTag = manifest.tags?.find((tag: Tag) => tag.id === id)
      if (existingTag) {
        await save({
          ...manifest,
          tags: (manifest.tags || []).map((tag: Tag) =>
            tag.id === id ? { ...tag, pinned: !tag.pinned } : tag
          )
        })
      }
    },
    [manifest, save]
  )

  const pinnedTags = (manifest?.tags || []).filter((tag: Tag) => tag.pinned)

  return {
    tags: manifest?.tags || [],
    pinnedTags,
    createTag,
    updateTag,
    deleteTag,
    getTag,
    togglePinTag,
    isSaving
  }
}
