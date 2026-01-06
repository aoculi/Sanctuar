import { useCallback } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import type { Bookmark, Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateTagName } from '@/lib/validation'

export function useTags() {
  const { manifest, save, isSaving } = useManifest()
  const { settings } = useSettings()

  const createTag = useCallback(
    async (tag: Omit<Tag, 'id'>) => {
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
        hidden: tag.hidden ?? false
      }

      await save({
        ...manifest,
        tags: [...(manifest.tags || []), newTag]
      })
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

      // Validate input if URL or title is being updated
      const existingTag = manifest.tags?.find((item: Tag) => item.id === id)
      if (existingTag) {
        const validationData = {
          name: updates.name ?? existingTag.name,
          hidden: updates.hidden ?? existingTag.hidden,
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

  return {
    tags: manifest?.tags || [],
    showHiddenTags: settings.showHiddenTags,
    createTag,
    updateTag,
    deleteTag,
    getTag,
    isSaving
  }
}
