import { useCallback, useEffect, useState } from 'react'

import { useManifest } from '@/components/hooks/useManifest'
import { useTagValidation } from '@/components/hooks/validation'
import { STORAGE_KEYS } from '@/lib/constants'
import { getStorageItem, Settings } from '@/lib/storage'
import type { Bookmark, Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'

export function useTags() {
  const { manifest, save, isSaving } = useManifest()
  const { validateTag } = useTagValidation()
  const [showHiddenTags, setShowHiddenTags] = useState(false)

  // Load showHiddenTags setting
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getStorageItem<Settings>(STORAGE_KEYS.SETTINGS)
      if (settings) {
        setShowHiddenTags(settings.showHiddenTags)
      }
    }
    loadSettings()
  }, [])

  const createTag = useCallback(
    async (tag: Omit<Tag, 'id'>) => {
      if (!manifest) return

      // Validate tag name
      const validationError = validateTag(tag.name)
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
    [manifest, validateTag, save]
  )

  const renameTag = useCallback(
    async (id: string, newName: string, hidden?: boolean) => {
      if (!manifest) return

      // Validate new name
      const validationError = validateTag(newName)
      if (validationError) {
        throw new Error(validationError)
      }

      const trimmedName = newName.trim()

      // Check for duplicate tag names (excluding current tag)
      const existingTag = manifest.tags?.find(
        (t: Tag) =>
          t.id !== id && t.name.toLowerCase() === trimmedName.toLowerCase()
      )
      if (existingTag) {
        throw new Error('A tag with this name already exists')
      }

      await save({
        ...manifest,
        tags: (manifest.tags || []).map((tag: Tag) =>
          tag.id === id
            ? {
                ...tag,
                name: trimmedName,
                hidden: hidden !== undefined ? hidden : (tag.hidden ?? false)
              }
            : tag
        )
      })
    },
    [manifest, validateTag, save]
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
    showHiddenTags,
    createTag,
    renameTag,
    deleteTag,
    getTag,
    isSaving
  }
}
