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
  return [...collections].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER
    return orderA !== orderB ? orderA - orderB : a.name.localeCompare(b.name)
  })
}

/**
 * Build parent-child relationships for collections
 */
function buildHierarchy(collections: Collection[]) {
  const childrenMap = new Map<string, Collection[]>()
  const roots: Collection[] = []

  for (const c of collections) {
    if (!c.parentId) {
      roots.push(c)
    } else {
      const children = childrenMap.get(c.parentId) || []
      children.push(c)
      childrenMap.set(c.parentId, children)
    }
  }

  return { childrenMap, roots }
}

/**
 * Filter bookmarks that match a collection's tag filter
 */
export function getBookmarksForCollection(
  collection: Collection,
  bookmarks: Bookmark[],
  sortMode: 'updated_at' | 'title' = 'updated_at'
): Bookmark[] {
  if (collection.tagFilter.tagIds.length === 0) return []

  const { mode, tagIds } = collection.tagFilter
  const matching = bookmarks.filter((b) =>
    mode === 'any'
      ? tagIds.some((id) => b.tags.includes(id))
      : tagIds.every((id) => b.tags.includes(id))
  )

  return matching.sort((a, b) =>
    sortMode === 'title'
      ? a.title.localeCompare(b.title)
      : b.updated_at - a.updated_at
  )
}

/**
 * Count bookmarks per collection
 */
export function countBookmarksPerCollection(
  collections: Collection[],
  bookmarks: Bookmark[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of collections) {
    counts.set(c.id, getBookmarksForCollection(c, bookmarks).length)
  }
  return counts
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
 * Flatten collections with their bookmarks for bookmark list view
 */
export function flattenCollectionsWithBookmarks(
  collections: Collection[],
  bookmarks: Bookmark[],
  sortMode: 'updated_at' | 'title' = 'updated_at'
): CollectionWithBookmarks[] {
  const { childrenMap, roots } = buildHierarchy(collections)

  const bookmarksByCollection = new Map(
    collections.map((c) => [
      c.id,
      getBookmarksForCollection(c, bookmarks, sortMode)
    ])
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
 * Check if setting a parent would create a circular reference
 */
export function wouldCreateCircularReference(
  collections: Collection[],
  collectionId: string | null,
  parentId: string | undefined
): boolean {
  if (!parentId) return false

  let currentId: string | undefined = parentId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId) || currentId === collectionId) return true
    visited.add(currentId)
    currentId = collections.find((c) => c.id === currentId)?.parentId
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
