import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useTags } from '@/components/hooks/useTags'
import { getTagColor } from '@/lib/bookmarkUtils'
import type { Tag } from '@/lib/types'

import TagItem from '@/components/parts/Tags/TagItem'

import styles from './styles.module.css'

interface SmartSearchProps {
  searchQuery: string
  selectedTags: string[]
  onSearchChange: (query: string) => void
  onSelectedTagsChange: (tags: string[]) => void
}

export default function SmartSearch({
  searchQuery,
  selectedTags,
  onSearchChange,
  onSelectedTagsChange
}: SmartSearchProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { tags, showHiddenTags } = useTags()

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (query.length === 0) return []

    return tags.filter(
      (tag: Tag) =>
        !selectedTags.includes(tag.id) &&
        tag.name.toLowerCase().includes(query) &&
        (showHiddenTags || !tag.hidden)
    )
  }, [tags, selectedTags, searchQuery, showHiddenTags])

  // Get selected tag objects
  const selectedTagObjects = useMemo(() => {
    return tags.filter((tag: Tag) => selectedTags.includes(tag.id))
  }, [tags, selectedTags])

  const handleSelectTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onSelectedTagsChange([...selectedTags, tagId])
      onSearchChange('')
      setHighlightedIndex(0)
      inputRef.current?.focus()
    }
  }

  const handleRemoveTag = (tagId: string) => {
    onSelectedTagsChange(selectedTags.filter((id) => id !== tagId))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && filteredTags.length > 0) {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp' && filteredTags.length > 0) {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter' && filteredTags.length > 0) {
      e.preventDefault()
      handleSelectTag(filteredTags[highlightedIndex].id)
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    } else if (
      e.key === 'Backspace' &&
      searchQuery === '' &&
      selectedTags.length > 0
    ) {
      onSelectedTagsChange(selectedTags.slice(0, -1))
    }
  }

  // Reset highlighted index when filtered tags change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredTags.length])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const showSuggestions = isFocused && filteredTags.length > 0

  return (
    <div ref={containerRef} className={styles.component}>
      <div className={`${styles.searchBox} ${isFocused ? styles.focused : ''}`}>
        <Search className={styles.searchIcon} strokeWidth={1.5} size={18} />

        {selectedTagObjects.length > 0 && (
          <div className={styles.selectedTags}>
            {selectedTagObjects.map((tag: Tag) => (
              <TagItem
                key={tag.id}
                tagId={tag.id}
                tagName={tag.name}
                tags={tags}
                onRemove={() => handleRemoveTag(tag.id)}
              />
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type='text'
          className={styles.input}
          placeholder={
            selectedTags.length > 0
              ? 'Add more...'
              : 'Search bookmarks or tags...'
          }
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showSuggestions && (
        <div className={styles.suggestions}>
          <div className={styles.suggestionsHeader}>Tags</div>
          <div className={styles.suggestionsList}>
            {filteredTags.map((tag: Tag, index: number) => {
              const colorInfo = getTagColor(tag.id, tags)
              return (
                <button
                  key={tag.id}
                  type='button'
                  className={`${styles.suggestionItem} ${
                    index === highlightedIndex ? styles.highlighted : ''
                  }`}
                  onClick={() => handleSelectTag(tag.id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span
                    className={styles.suggestionDot}
                    style={{
                      backgroundColor: colorInfo?.tagColor ?? 'var(--primary)'
                    }}
                  />
                  <span>{tag.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
