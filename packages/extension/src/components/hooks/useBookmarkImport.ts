import { useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'

import {
  generateCollectionsFromTree,
  prepareBookmarksForImport,
  processBookmarkImport
} from '@/lib/bookmarkImport'
import type { Bookmark, Collection, Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateBookmarkInput } from '@/lib/validation'

export interface UseBookmarkImportOptions {
  preserveFolderStructure: boolean
  importDuplicates: boolean
}

export interface UseBookmarkImportReturn {
  importFile: File | null
  setImportFile: (file: File | null) => void
  isImporting: boolean
  handleImport: () => Promise<void>
}

export function useBookmarkImport(
  options: UseBookmarkImportOptions
): UseBookmarkImportReturn {
  const { preserveFolderStructure, importDuplicates } = options

  const { setFlash } = useNavigation()
  const { addBookmarks } = useBookmarks()
  const { tags, createTag } = useTags()
  const { manifest, reload: reloadManifest, save } = useManifest()

  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = async () => {
    if (!importFile) {
      setFlash('Please select a bookmark file')
      return
    }

    // Check if manifest is loaded before proceeding
    if (!manifest) {
      setFlash('Cannot import: manifest not loaded. Please try again.')
      return
    }

    setIsImporting(true)
    setFlash(null)

    try {
      // Step 1: Process the bookmark file
      const processResult = await processBookmarkImport({
        file: importFile,
        preserveFolderStructure,
        existingTags: tags
      })

      if (processResult.errors.length > 0) {
        console.warn('Import warnings:', processResult.errors)
      }

      if (processResult.bookmarksWithPaths.length === 0) {
        setFlash('No valid bookmarks found in the file')
        setIsImporting(false)
        return
      }

      // Step 2: Prepare everything in memory, then save once

      // 2a: Create new tags with IDs
      const existingTagNames = new Map<string, string>()
      ;(manifest.tags || []).forEach((tag) => {
        existingTagNames.set(tag.name.toLowerCase(), tag.id)
      })

      const newTags: Tag[] = []
      for (const tagToCreate of processResult.tagsToCreate) {
        const trimmedName = tagToCreate.name.trim()
        const lowerName = trimmedName.toLowerCase()

        // Skip if tag already exists
        if (existingTagNames.has(lowerName)) {
          continue
        }

        const tagId = generateId()
        newTags.push({
          ...tagToCreate,
          id: tagId,
          name: trimmedName,
          hidden: tagToCreate.hidden ?? false
        })
        existingTagNames.set(lowerName, tagId)
      }

      // 2b: Build complete tag list (existing + new) with IDs
      const allTags = [...(manifest.tags || []), ...newTags]
      const tagNameToId = new Map<string, string>()
      allTags.forEach((tag) => {
        tagNameToId.set(tag.name.toLowerCase(), tag.id)
      })

      // 2c: Prepare bookmarks with tag references
      const prepareResult = prepareBookmarksForImport({
        bookmarksWithPaths: processResult.bookmarksWithPaths,
        preserveFolderStructure,
        importDuplicates,
        tags: allTags,
        existingBookmarks: manifest.items || []
      })

      if (prepareResult.bookmarksToImport.length === 0) {
        const message =
          prepareResult.duplicatesCount > 0
            ? `All ${prepareResult.totalBookmarks} bookmark${prepareResult.totalBookmarks !== 1 ? 's' : ''} are duplicates and were skipped`
            : 'No bookmarks to import'
        setFlash(message)
        setImportFile(null)
        setIsImporting(false)
        return
      }

      // 2d: Create bookmarks with IDs and timestamps
      const now = Date.now()
      const newBookmarks: Bookmark[] = []
      for (const bookmark of prepareResult.bookmarksToImport) {
        // Validate bookmark
        const validationError = validateBookmarkInput({
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

      // 2e: Create collections from folder structure if enabled
      let newCollections: Collection[] = []
      if (preserveFolderStructure) {
        const existingCollections = manifest.collections || []
        const existingCollectionNames = new Set(
          existingCollections.map((c) => c.name.toLowerCase())
        )

        // Generate collections using the tag IDs we just created
        const generatedCollections = generateCollectionsFromTree(
          processResult.folderTree,
          tagNameToId,
          undefined,
          existingCollections.length
        )

        // Filter out collections that already exist (by name)
        newCollections = generatedCollections.filter(
          (c) => !existingCollectionNames.has(c.name.toLowerCase())
        )
      }

      // Step 3: Save everything in a single operation
      const updatedManifest = {
        ...manifest,
        tags: allTags,
        items: [...(manifest.items || []), ...newBookmarks],
        collections: [...(manifest.collections || []), ...newCollections]
      }

      await save(updatedManifest)
      await reloadManifest()

      // Step 4: Success message
      let successMessage = `Successfully imported ${newBookmarks.length} bookmark${newBookmarks.length !== 1 ? 's' : ''}`
      if (prepareResult.duplicatesCount > 0) {
        successMessage += ` (${prepareResult.duplicatesCount} duplicate${prepareResult.duplicatesCount !== 1 ? 's' : ''} skipped)`
      }
      if (newTags.length > 0) {
        successMessage += `, ${newTags.length} tag${newTags.length !== 1 ? 's' : ''}`
      }
      if (newCollections.length > 0) {
        successMessage += `, ${newCollections.length} collection${newCollections.length !== 1 ? 's' : ''}`
      }
      setFlash(successMessage)
      setImportFile(null)
    } catch (error) {
      const errorMessage = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      setFlash(errorMessage)
    } finally {
      setIsImporting(false)
    }
  }

  return {
    importFile,
    setImportFile,
    isImporting,
    handleImport
  }
}
