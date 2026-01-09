import type { Bookmark, Collection } from '@/lib/types'

export type CollectionWithDepth = {
  collection: Collection
  depth: number
}

export type CollectionWithBookmarks = {
  collection: Collection
  bookmarks: Bookmark[]
  depth: number
}

/**
 * Sort collections by manual order, falling back to alphabetical
 */
function sortByOrder(collections: Collection[]): Collection[] {
  if (!collections || collections.length === 0) return []
  return [...collections].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER
    return orderA !== orderB ? orderA - orderB : a.name.localeCompare(b.name)
  })
}

export interface HierarchyResult {
  childrenMap: Map<string | undefined, Collection[]>
  roots: Collection[]
  parentMap: Map<string, string | undefined>
}

/**
 * Build parent-child relationships for collections
 * Returns childrenMap for traversing down the tree, roots for top-level collections,
 * and parentMap for O(1) parent lookups when traversing up
 */
function buildHierarchy(collections: Collection[]): HierarchyResult {
  const childrenMap = new Map<string | undefined, Collection[]>()
  const parentMap = new Map<string, string | undefined>()
  const roots: Collection[] = []

  if (!collections || collections.length === 0) {
    return { childrenMap, roots, parentMap }
  }

  for (const c of collections) {
    // Store parent relationship for O(1) lookup
    parentMap.set(c.id, c.parentId)

    if (!c.parentId) {
      roots.push(c)
    } else {
      const children = childrenMap.get(c.parentId) || []
      children.push(c)
      childrenMap.set(c.parentId, children)
    }
  }

  return { childrenMap, roots, parentMap }
}

/**
 * Get bookmarks that belong to a collection (by direct association)
 */
export function getBookmarksForCollection(
  collection: Collection,
  bookmarks: Bookmark[],
  sortMode: 'updated_at' | 'title' = 'updated_at'
): Bookmark[] {
  const matching = bookmarks.filter((b) => b.collectionId === collection.id)

  return matching.sort((a, b) =>
    sortMode === 'title'
      ? a.title.localeCompare(b.title)
      : b.updated_at - a.updated_at
  )
}

/**
 * Count bookmarks per collection (including all subcollections recursively)
 * Optimized: O(n + m) instead of O(n*m) by using single-pass counting
 */
export function countBookmarksPerCollection(
  collections: Collection[],
  bookmarks: Bookmark[]
): Map<string, number> {
  if (!collections || collections.length === 0) {
    return new Map()
  }

  // Phase 1: Initialize direct counts to 0 for all collections - O(n)
  const directCounts = new Map<string, number>()
  for (const c of collections) {
    directCounts.set(c.id, 0)
  }

  // Phase 2: Single pass over bookmarks to count direct associations - O(m)
  for (const bookmark of bookmarks) {
    if (bookmark.collectionId) {
      const current = directCounts.get(bookmark.collectionId) || 0
      directCounts.set(bookmark.collectionId, current + 1)
    }
  }

  // Phase 3: Build hierarchy once - O(n)
  const { childrenMap } = buildHierarchy(collections)

  // Phase 4: Post-order traversal to sum counts with memoization - O(n)
  const totalCounts = new Map<string, number>()

  const sumCounts = (collectionId: string): number => {
    // Check cache first
    if (totalCounts.has(collectionId)) {
      return totalCounts.get(collectionId)!
    }

    const directCount = directCounts.get(collectionId) || 0
    const children = childrenMap.get(collectionId) || []
    const childrenTotal = children.reduce(
      (sum, child) => sum + sumCounts(child.id),
      0
    )
    const total = directCount + childrenTotal
    totalCounts.set(collectionId, total)
    return total
  }

  // Trigger computation for all collections
  for (const collection of collections) {
    if (!totalCounts.has(collection.id)) {
      sumCounts(collection.id)
    }
  }

  return totalCounts
}

/**
 * Flatten collection tree with depth information
 */
export function flattenCollectionsWithDepth(
  collections: Collection[]
): CollectionWithDepth[] {
  const { childrenMap, roots } = buildHierarchy(collections)

  const flatten = (items: Collection[], depth: number): CollectionWithDepth[] =>
    sortByOrder(items).flatMap((collection) => [
      { collection, depth },
      ...flatten(childrenMap.get(collection.id) || [], depth + 1)
    ])

  return flatten(roots, 0)
}

/**
 * Get all descendant collection IDs for a given collection (recursive)
 */
export function getDescendantCollectionIds(
  collectionId: string,
  childrenMap: Map<string | undefined, Collection[]>
): Set<string> {
  const descendants = new Set<string>()
  const children = childrenMap.get(collectionId) || []

  for (const child of children) {
    descendants.add(child.id)
    // Recursively get descendants of this child
    const childDescendants = getDescendantCollectionIds(child.id, childrenMap)
    childDescendants.forEach((id) => descendants.add(id))
  }

  return descendants
}

/**
 * Convenience function to get all descendant IDs from a collections array
 */
export function getAllDescendantIds(
  collectionId: string,
  collections: Collection[]
): Set<string> {
  const { childrenMap } = buildHierarchy(collections)
  return getDescendantCollectionIds(collectionId, childrenMap)
}

/**
 * Build a map of bookmarks grouped by collection ID
 */
function buildBookmarksByCollectionMap(
  collections: Collection[],
  bookmarks: Bookmark[],
  sortMode: 'updated_at' | 'title' = 'updated_at'
): Map<string, Bookmark[]> {
  return new Map(
    collections.map((c) => [
      c.id,
      getBookmarksForCollection(c, bookmarks, sortMode)
    ])
  )
}

/**
 * Flatten collections with their bookmarks for bookmark list view
 * Bookmarks are directly associated with collections via collectionId
 * Shows all collections, including empty ones (collections without bookmarks)
 */
export function flattenCollectionsWithBookmarks(
  collections: Collection[],
  bookmarks: Bookmark[],
  sortMode: 'updated_at' | 'title' = 'updated_at'
): CollectionWithBookmarks[] {
  const { childrenMap, roots } = buildHierarchy(collections)
  const bookmarksByCollection = buildBookmarksByCollectionMap(
    collections,
    bookmarks,
    sortMode
  )

  const flatten = (
    items: Collection[],
    depth: number
  ): CollectionWithBookmarks[] =>
    sortByOrder(items).flatMap((collection) => [
      {
        collection,
        bookmarks: bookmarksByCollection.get(collection.id) || [],
        depth
      },
      ...flatten(childrenMap.get(collection.id) || [], depth + 1)
    ])

  return flatten(roots, 0)
}

/**
 * Get all bookmark IDs that belong to any collection
 */
export function getBookmarkIdsInCollections(
  collectionsWithBookmarks: CollectionWithBookmarks[]
): Set<string> {
  const ids = new Set<string>()
  for (const { bookmarks } of collectionsWithBookmarks) {
    for (const b of bookmarks) ids.add(b.id)
  }
  return ids
}

/**
 * Filter out empty collections from the flattened list
 * Keeps collections that have bookmarks OR have descendants with bookmarks
 */
export function filterEmptyCollections(
  collectionsWithBookmarks: CollectionWithBookmarks[]
): CollectionWithBookmarks[] {
  // Build a map of collection id -> bookmarks count (including descendants)
  const hasBookmarksMap = new Map<string, boolean>()

  // Build parent-child relationships from the flattened list
  const childrenMap = new Map<string, string[]>()
  const collectionMap = new Map<string, CollectionWithBookmarks>()

  for (const item of collectionsWithBookmarks) {
    collectionMap.set(item.collection.id, item)
    const parentId = item.collection.parentId
    if (parentId) {
      const children = childrenMap.get(parentId) || []
      children.push(item.collection.id)
      childrenMap.set(parentId, children)
    }
  }

  // Check if a collection or any descendant has bookmarks (with memoization)
  const checkHasBookmarks = (collectionId: string): boolean => {
    if (hasBookmarksMap.has(collectionId)) {
      return hasBookmarksMap.get(collectionId)!
    }

    const item = collectionMap.get(collectionId)
    if (!item) {
      hasBookmarksMap.set(collectionId, false)
      return false
    }

    // Check direct bookmarks
    if (item.bookmarks.length > 0) {
      hasBookmarksMap.set(collectionId, true)
      return true
    }

    // Check descendants
    const children = childrenMap.get(collectionId) || []
    for (const childId of children) {
      if (checkHasBookmarks(childId)) {
        hasBookmarksMap.set(collectionId, true)
        return true
      }
    }

    hasBookmarksMap.set(collectionId, false)
    return false
  }

  // Filter collections
  return collectionsWithBookmarks.filter((item) =>
    checkHasBookmarks(item.collection.id)
  )
}

/**
 * Check if setting a parent would create a circular reference
 * Uses parentMap for O(1) parent lookups instead of O(n) linear search
 */
export function wouldCreateCircularReference(
  collections: Collection[],
  collectionId: string | null,
  parentId: string | undefined
): boolean {
  if (!parentId || !collectionId) return false
  if (parentId === collectionId) return true // Direct self-reference

  // Build parent map once for O(1) lookups
  const { parentMap } = buildHierarchy(collections)

  let currentId: string | undefined = parentId
  const visited = new Set<string>([collectionId]) // Pre-populate with the collection we're moving

  while (currentId) {
    if (visited.has(currentId)) return true // Found a cycle
    visited.add(currentId)
    currentId = parentMap.get(currentId) // O(1) lookup instead of O(n)
  }

  return false
}

/**
 * Get the next order number for a new collection
 */
export function getNextCollectionOrder(
  collections: Collection[],
  parentId?: string
): number {
  const siblings = collections.filter((c) => c.parentId === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((c) => c.order ?? 0)) + 1
}

/**
 * Move a collection to a new parent
 */
export function moveCollectionToParent(
  collections: Collection[],
  collectionId: string,
  newParentId: string | undefined
): Collection[] {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection || collection.parentId === newParentId) return collections

  if (wouldCreateCircularReference(collections, collectionId, newParentId)) {
    throw new Error('Cannot move collection into its own descendant')
  }

  const newOrder = getNextCollectionOrder(collections, newParentId)

  return collections.map((c) =>
    c.id === collectionId
      ? { ...c, parentId: newParentId, order: newOrder, updated_at: Date.now() }
      : c
  )
}

/**
 * Reorder a collection within its sibling group
 */
export function reorderCollection(
  collections: Collection[],
  collectionId: string,
  newIndex: number
): Collection[] {
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return collections

  const parentId = collection.parentId
  const siblings = sortByOrder(
    collections.filter((c) => c.parentId === parentId)
  )

  const currentIndex = siblings.findIndex((c) => c.id === collectionId)
  if (currentIndex === -1) return collections

  // Move within siblings array
  const [moved] = siblings.splice(currentIndex, 1)
  siblings.splice(Math.max(0, Math.min(newIndex, siblings.length)), 0, moved)

  // Build new order map
  const newOrders = new Map(siblings.map((s, i) => [s.id, i]))

  return collections.map((c) =>
    newOrders.has(c.id) ? { ...c, order: newOrders.get(c.id)! } : c
  )
}

/**
 * Handle collection drop - moves or reorders based on drop zone
 */
export function handleCollectionDrop(
  collections: Collection[],
  draggedId: string,
  targetId: string,
  zone: 'above' | 'center' | 'below'
): Collection[] | { error: string } {
  const dragged = collections.find((c) => c.id === draggedId)
  const target = collections.find((c) => c.id === targetId)

  if (!dragged || !target) return collections

  if (zone === 'center') {
    // Move into target as child
    if (wouldCreateCircularReference(collections, draggedId, targetId)) {
      return { error: 'Cannot move a collection into its own descendant' }
    }
    return moveCollectionToParent(collections, draggedId, targetId)
  }

  // Move above/below target (same parent level as target)
  const targetParentId = target.parentId

  // Check circular reference for target's parent
  if (
    targetParentId &&
    wouldCreateCircularReference(collections, draggedId, targetParentId)
  ) {
    return { error: 'Cannot move a collection into its own descendant' }
  }

  // First move to same parent if needed
  let updated =
    dragged.parentId !== targetParentId
      ? moveCollectionToParent(collections, draggedId, targetParentId)
      : collections

  // Calculate target index
  const siblings = sortByOrder(
    updated.filter((c) => c.parentId === targetParentId)
  )
  const targetIndex = siblings.findIndex((c) => c.id === targetId)
  const insertIndex = zone === 'below' ? targetIndex + 1 : targetIndex

  return reorderCollection(updated, draggedId, insertIndex)
}
