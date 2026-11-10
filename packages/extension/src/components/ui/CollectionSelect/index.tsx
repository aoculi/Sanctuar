import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronDown,
  Folder,
  FolderPlus,
  Inbox,
  Loader2,
  Search
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { flattenCollectionsWithDepth } from '@/lib/collectionUtils'
import type { Collection } from '@/lib/types'

import styles from './styles.module.css'

interface CollectionSelectProps {
  collections: Collection[]
  value: string | undefined
  onChange: (collectionId: string | undefined) => void
  /** When provided, typing a name that doesn't exist offers to create it */
  onCreateCollection?: (name: string) => Promise<Collection>
}

const NONE = '__none__'

/**
 * Collection picker that shows nesting, stays inside the viewport
 * (Radix collision handling) and scrolls when the list is long.
 * A field at the top filters the list and can create a new collection.
 */
export default function CollectionSelect({
  collections,
  value,
  onChange,
  onCreateCollection
}: CollectionSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo(
    () => flattenCollectionsWithDepth(collections),
    [collections]
  )
  const selected = collections.find((c) => c.id === value)

  // "Parent / Child" labels so filtered results stay understandable
  const pathById = useMemo(() => {
    const byId = new Map(collections.map((c) => [c.id, c]))
    const paths = new Map<string, string>()
    for (const c of collections) {
      const names: string[] = []
      let current: Collection | undefined = c
      const seen = new Set<string>()
      while (current && !seen.has(current.id)) {
        seen.add(current.id)
        names.unshift(current.name)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
      paths.set(c.id, names.join(' / '))
    }
    return paths
  }, [collections])

  const trimmedQuery = query.trim()
  const lowerQuery = trimmedQuery.toLowerCase()
  const isFiltering = lowerQuery !== ''

  const visibleItems = useMemo(() => {
    if (!isFiltering) return items
    return items.filter(({ collection }) =>
      collection.name.toLowerCase().includes(lowerQuery)
    )
  }, [items, isFiltering, lowerQuery])

  // New collections are created at the top level, so only a top-level
  // name clash blocks creation (same rule as useCollections)
  const exactTopLevelMatch = collections.some(
    (c) => !c.parentId && c.name.toLowerCase() === lowerQuery
  )
  const canCreate = !!onCreateCollection && isFiltering && !exactTopLevelMatch

  // Focus the field when the menu opens; reset it when it closes
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
    setQuery('')
    setError(null)
  }, [open])

  const handleCreate = async () => {
    if (!onCreateCollection || !canCreate || isCreating) return
    setIsCreating(true)
    setError(null)
    try {
      const created = await onCreateCollection(trimmedQuery)
      onChange(created.id)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setIsCreating(false)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keep Radix's typeahead and item navigation away from the text field,
    // except the keys that should move into the list or close the menu.
    if (e.key === 'Escape') return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      const first = (e.currentTarget
        .closest('[role="menu"]')
        ?.querySelector('[role="menuitemradio"], [role="menuitem"]') ??
        null) as HTMLElement | null
      first?.focus()
      return
    }
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      if (visibleItems.length === 1 && isFiltering) {
        onChange(visibleItems[0].collection.id)
        setOpen(false)
      } else if (canCreate) {
        void handleCreate()
      }
    }
  }

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger className={styles.trigger}>
        {selected ? (
          <Folder size={14} className={styles.triggerIcon} />
        ) : (
          <Inbox size={14} className={styles.triggerIcon} />
        )}
        <span className={styles.triggerLabel}>
          {selected ? selected.name : 'No collection'}
        </span>
        <ChevronDown size={14} className={styles.chevron} />
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          className={styles.content}
          sideOffset={4}
          collisionPadding={8}
          align='start'
        >
          <div className={styles.searchRow}>
            <Search size={14} className={styles.itemIcon} />
            <input
              ref={inputRef}
              className={styles.searchInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError(null)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={
                onCreateCollection
                  ? 'Search or create a collection…'
                  : 'Search collections…'
              }
              aria-label='Search collections'
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.list}>
            <DropdownMenuPrimitive.RadioGroup
              value={value ?? NONE}
              onValueChange={(next) =>
                onChange(next === NONE ? undefined : next)
              }
            >
              {!isFiltering && (
                <DropdownMenuPrimitive.RadioItem
                  value={NONE}
                  className={styles.item}
                >
                  <Inbox size={14} className={styles.itemIcon} />
                  <span className={styles.itemLabel}>No collection</span>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <Check size={14} />
                  </DropdownMenuPrimitive.ItemIndicator>
                </DropdownMenuPrimitive.RadioItem>
              )}

              {!isFiltering && items.length > 0 && (
                <DropdownMenuPrimitive.Separator className={styles.separator} />
              )}

              {visibleItems.map(({ collection, depth }) => (
                <DropdownMenuPrimitive.RadioItem
                  key={collection.id}
                  value={collection.id}
                  className={styles.item}
                  style={{ paddingLeft: 10 + (isFiltering ? 0 : depth) * 16 }}
                  title={pathById.get(collection.id)}
                >
                  <Folder size={14} className={styles.itemIcon} />
                  <span className={styles.itemLabel}>
                    {isFiltering
                      ? pathById.get(collection.id) ?? collection.name
                      : collection.name}
                  </span>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <Check size={14} />
                  </DropdownMenuPrimitive.ItemIndicator>
                </DropdownMenuPrimitive.RadioItem>
              ))}
            </DropdownMenuPrimitive.RadioGroup>

            {isFiltering && visibleItems.length === 0 && !canCreate && (
              <div className={styles.empty}>No matching collection</div>
            )}

            {canCreate && (
              <>
                {visibleItems.length > 0 && (
                  <DropdownMenuPrimitive.Separator
                    className={styles.separator}
                  />
                )}
                <DropdownMenuPrimitive.Item
                  className={`${styles.item} ${styles.createItem}`}
                  disabled={isCreating}
                  onSelect={(e) => {
                    // Keep the menu open until the collection exists
                    e.preventDefault()
                    void handleCreate()
                  }}
                >
                  {isCreating ? (
                    <Loader2 size={14} className={`${styles.itemIcon} ${styles.spinner}`} />
                  ) : (
                    <FolderPlus size={14} className={styles.itemIcon} />
                  )}
                  <span className={styles.itemLabel}>
                    Create <strong>{trimmedQuery}</strong>
                  </span>
                </DropdownMenuPrimitive.Item>
              </>
            )}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
