import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Folder, Inbox } from 'lucide-react'
import { useMemo } from 'react'

import { flattenCollectionsWithDepth } from '@/lib/collectionUtils'
import type { Collection } from '@/lib/types'

import styles from './styles.module.css'

interface CollectionSelectProps {
  collections: Collection[]
  value: string | undefined
  onChange: (collectionId: string | undefined) => void
}

const NONE = '__none__'

/**
 * Collection picker that shows nesting, stays inside the viewport
 * (Radix collision handling) and scrolls when the list is long.
 */
export default function CollectionSelect({
  collections,
  value,
  onChange
}: CollectionSelectProps) {
  const items = useMemo(
    () => flattenCollectionsWithDepth(collections),
    [collections]
  )
  const selected = collections.find((c) => c.id === value)

  return (
    <DropdownMenuPrimitive.Root>
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
          <DropdownMenuPrimitive.RadioGroup
            value={value ?? NONE}
            onValueChange={(next) =>
              onChange(next === NONE ? undefined : next)
            }
          >
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

            {items.length > 0 && (
              <DropdownMenuPrimitive.Separator className={styles.separator} />
            )}

            {items.map(({ collection, depth }) => (
              <DropdownMenuPrimitive.RadioItem
                key={collection.id}
                value={collection.id}
                className={styles.item}
                style={{ paddingLeft: 10 + depth * 16 }}
              >
                <Folder size={14} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{collection.name}</span>
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check size={14} />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
