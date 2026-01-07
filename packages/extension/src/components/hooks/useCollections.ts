import { useCallback } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import {
  getNextCollectionOrder,
  wouldCreateCircularReference
} from '@/lib/collectionUtils'
import type { Collection } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateCollectionName } from '@/lib/validation'

export function useCollections() {
  const { manifest, save } = useManifest()

  const validateCollection = useCallback(
    (data: {
      name: string
      parentId?: string
      collectionId?: string | null
    }) => {
      const nameError = validateCollectionName(data.name)
      if (nameError) {
        return nameError
      }

      const collections = manifest?.collections || []
      if (
        wouldCreateCircularReference(
          collections,
          data.collectionId || null,
          data.parentId
        )
      ) {
        return 'Would create a circular reference'
      }

      return null
    },
    [manifest]
  )

  const createCollection = useCallback(
    async (
      collection: Omit<Collection, 'id' | 'created_at' | 'updated_at' | 'order'>
    ) => {
      if (!manifest) {
        throw new Error('Cannot create collection: manifest not loaded')
      }

      // Validate input
      const validationError = validateCollection({
        name: collection.name,
        parentId: collection.parentId
      })
      if (validationError) {
        throw new Error(validationError)
      }

      const now = Date.now()
      const trimmedName = collection.name.trim()

      // Check for duplicate collection names at the same level
      const collections = manifest.collections || []
      const siblings = collections.filter(
        (c) => c.parentId === collection.parentId
      )
      const duplicate = siblings.find(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
      )
      if (duplicate) {
        throw new Error(
          'A collection with this name already exists at this level'
        )
      }

      const newCollection: Collection = {
        ...collection,
        id: generateId(),
        name: trimmedName,
        order: getNextCollectionOrder(collections, collection.parentId),
        created_at: now,
        updated_at: now
      }

      await save({
        ...manifest,
        collections: [...collections, newCollection]
      })
    },
    [manifest, validateCollection, save]
  )

  const updateCollection = useCallback(
    async (
      id: string,
      updates: Partial<
        Omit<Collection, 'id' | 'created_at' | 'updated_at' | 'order'>
      >
    ) => {
      if (!manifest) return

      const collections = manifest.collections || []
      const existingCollection = collections.find((c) => c.id === id)
      if (!existingCollection) {
        throw new Error('Collection not found')
      }

      // Validate input if name or parentId is being updated
      if (updates.name !== undefined || updates.parentId !== undefined) {
        const validationError = validateCollection({
          name: updates.name ?? existingCollection.name,
          parentId: updates.parentId ?? existingCollection.parentId,
          collectionId: id
        })
        if (validationError) {
          throw new Error(validationError)
        }

        // Check for duplicate names if name is being updated
        if (updates.name !== undefined) {
          const trimmedName = updates.name.trim()
          const parentId = updates.parentId ?? existingCollection.parentId
          const siblings = collections.filter(
            (c) => c.parentId === parentId && c.id !== id
          )
          const duplicate = siblings.find(
            (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
          )
          if (duplicate) {
            throw new Error(
              'A collection with this name already exists at this level'
            )
          }
        }
      }

      const now = Date.now()
      await save({
        ...manifest,
        collections: collections.map((c) =>
          c.id === id
            ? {
                ...c,
                ...updates,
                name: updates.name ? updates.name.trim() : c.name,
                updated_at: now
              }
            : c
        )
      })
    },
    [manifest, validateCollection, save]
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      if (!manifest) return

      const collections = manifest.collections || []

      // Check if collection has children
      const hasChildren = collections.some((c) => c.parentId === id)
      if (hasChildren) {
        throw new Error(
          'Cannot delete collection with child collections. Please move or delete child collections first.'
        )
      }

      // Remove collection from collections array
      const updatedCollections = collections.filter(
        (collection) => collection.id !== id
      )

      // Remove collectionId from all bookmarks that reference this collection
      const updatedItems = (manifest.items || []).map((item) => {
        if (item.collectionId === id) {
          // Remove collectionId property by creating a new object without it
          const { collectionId, ...rest } = item
          return { ...rest, updated_at: Date.now() }
        }
        return item
      })

      await save({
        ...manifest,
        collections: updatedCollections,
        items: updatedItems
      })
    },
    [manifest, save]
  )

  const getCollection = useCallback(
    (id: string): Collection | undefined => {
      return manifest?.collections?.find((collection) => collection.id === id)
    },
    [manifest]
  )

  const reorderCollections = useCallback(
    async (updatedCollections: Collection[]) => {
      if (!manifest) return

      // Validate that all collection IDs are present and no duplicates
      const originalIds = new Set(
        (manifest.collections || []).map((c) => c.id)
      )
      const updatedIds = new Set(updatedCollections.map((c) => c.id))

      if (originalIds.size !== updatedIds.size) {
        throw new Error('Collection count mismatch during reorder')
      }

      for (const id of originalIds) {
        if (!updatedIds.has(id)) {
          throw new Error(`Collection ${id} missing after reorder`)
        }
      }

      await save({
        ...manifest,
        collections: updatedCollections
      })
    },
    [manifest, save]
  )

  return {
    collections: manifest?.collections || [],
    createCollection,
    updateCollection,
    deleteCollection,
    getCollection,
    reorderCollections
  }
}
