import * as Popover from '@radix-ui/react-popover'
import { Tag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getTagColor } from '@/lib/bookmarkUtils'
import type { Tag as EntityTag } from '@/lib/types'

import styles from './styles.module.css'

export const TagSelectorField = ({
  tags,
  selectedTags,
  onChange,
  isDropdownOpen
}: {
  tags: EntityTag[]
  selectedTags: string[]
  onChange: (selectedTags: string[]) => void
  isDropdownOpen?: boolean
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter tags based on search query and exclude already selected tags
  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return tags.filter(
      (tag) =>
        !selectedTags.includes(tag.id) &&
        (query === '' || tag.name.toLowerCase().includes(query))
    )
  }, [tags, selectedTags, searchQuery])

  // Get selected tag objects for display
  const selectedTagObjects = useMemo(() => {
    return tags.filter((tag) => selectedTags.includes(tag.id))
  }, [tags, selectedTags])

  const showSuggestions = (isDropdownOpen ?? isOpen) && filteredTags.length > 0

  // Handle tag selection
  const handleSelectTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onChange([...selectedTags, tagId])
      setSearchQuery('')
      setHighlightedIndex(0)
      inputRef.current?.focus()
    }
  }

  // Handle tag removal
  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedTags.filter((id) => id !== tagId))
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      // Never submit the surrounding form from the tag input;
      // Ctrl/Cmd + Enter bubbles up so the form can save.
      e.preventDefault()
      if (showSuggestions && filteredTags[highlightedIndex]) {
        handleSelectTag(filteredTags[highlightedIndex].id)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    } else if (
      e.key === 'Backspace' &&
      searchQuery === '' &&
      selectedTags.length > 0
    ) {
      // Remove last tag when backspace is pressed on empty input
      onChange(selectedTags.slice(0, -1))
    }
  }

  // Auto-focus input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen === true) {
      // Small delay to ensure the dropdown is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isDropdownOpen])

  // Reset highlighted index when filtered tags change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredTags.length])

  return (
    <div ref={containerRef} className={styles.container}>
      <Popover.Root
        open={showSuggestions}
        onOpenChange={(open) => {
          if (!open) setIsOpen(false)
        }}
      >
        <Popover.Anchor asChild>
          <div>
            <Input
              ref={inputRef}
              size='md'
              className={styles.input}
              placeholder='Add tags...'
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              role='combobox'
              aria-expanded={showSuggestions}
              aria-autocomplete='list'
            >
              <Tag size={14} />
            </Input>
          </div>
        </Popover.Anchor>

        {/* Suggestions render in a portal so the popup's fixed size never
            clips them; Radix flips them above the input when needed. */}
        <Popover.Portal>
          <Popover.Content
            className={styles.suggestions}
            side='bottom'
            align='start'
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              // Clicking the input itself should not close the list
              if (containerRef.current?.contains(e.target as Node)) {
                e.preventDefault()
              }
            }}
          >
            <div className={styles.suggestionsList} role='listbox'>
              {filteredTags.map((tag, index) => (
                <Button
                  key={tag.id}
                  type='button'
                  variant='ghost'
                  color='dark'
                  role='option'
                  aria-selected={index === highlightedIndex}
                  tabIndex={-1}
                  className={`${styles.suggestionItem} ${
                    index === highlightedIndex
                      ? styles.suggestionItemHighlighted
                      : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectTag(tag.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {tag.name}
                </Button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Selected tags displayed below the input */}
      {selectedTagObjects.length > 0 && (
        <div className={styles.selectedTags}>
          {selectedTagObjects.map((tag) => {
            const colorInfo = getTagColor(tag.id, tags)
            return (
              <Button
                key={tag.id}
                type='button'
                color='light'
                size='sm'
                title={`Remove ${tag.name}`}
                onClick={(e) => handleRemoveTag(tag.id, e)}
                className={colorInfo ? styles.coloredTag : ''}
                style={{
                  backgroundColor: colorInfo?.tagColor ?? undefined,
                  color: colorInfo?.textColor ?? undefined
                }}
              >
                <span className={styles.tagName}>{tag.name}</span>
                <X className={styles.removeIcon} height='12' width='12' />
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
