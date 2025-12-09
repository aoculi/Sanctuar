import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import Button from '@/entrypoints/components/ui/Button'
import { Drawer } from '@/entrypoints/components/ui/Drawer'
import Input from '@/entrypoints/components/ui/Input'
import { TagSelectorField } from '@/entrypoints/components/ui/TagSelectorField'
import type { Bookmark, Tag } from '@/entrypoints/lib/types'
import { MAX_TAGS_PER_ITEM } from '@/entrypoints/lib/validation'
import { settingsStore } from '@/entrypoints/store/settings'

import styles from './styles.module.css'

export const BookmarkModal = ({
  isOpen,
  bookmark,
  onClose,
  onSave,
  tags,
  tmp
}: {
  isOpen: boolean
  bookmark: Bookmark | null
  onClose: () => void
  onSave: (data: {
    url: string
    title: string
    picture: string
    tags: string[]
  }) => void
  tags: Tag[]
  tmp: Bookmark | null
}) => {
  const [url, setUrl] = useState(bookmark?.url || '')
  const [title, setTitle] = useState(bookmark?.title || '')
  const [picture, setPicture] = useState(bookmark?.picture || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(
    bookmark?.tags || []
  )

  const urlField = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showHiddenTags, setShowHiddenTags] = useState(false)

  // Subscribe to settings to respect hidden tag visibility
  useEffect(() => {
    const loadSettings = async () => {
      const currentState = await settingsStore.getState()
      setShowHiddenTags(currentState.showHiddenTags)
    }

    loadSettings()

    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState()
      setShowHiddenTags(state.showHiddenTags)
    })

    return unsubscribe
  }, [])

  // Update form fields when bookmark prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (tmp) {
        setUrl(tmp.url)
        setTitle(tmp.title)
        setPicture(tmp.picture)
        setSelectedTags([])
      } else {
        setUrl(bookmark?.url || '')
        setTitle(bookmark?.title || '')
        setPicture(bookmark?.picture || '')
        setSelectedTags(bookmark?.tags || [])
      }
      setErrors({})
      setIsLoading(false)
      setTimeout(() => {
        urlField?.current?.focus()
      }, 0)
    }
  }, [isOpen, bookmark])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // URL validation
    if (!url.trim()) {
      newErrors.url = 'URL is required'
    } else {
      try {
        const parsed = new URL(url.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors.url = 'URL must start with http:// or https://'
        }
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    // Title validation
    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }

    // Tags validation
    if (selectedTags.length > MAX_TAGS_PER_ITEM) {
      newErrors.tags = `Maximum ${MAX_TAGS_PER_ITEM} tags per bookmark`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isLoading) {
      return
    }

    setIsLoading(true)
    try {
      // Call onSave - wrap in Promise.resolve to handle both sync and async cases
      await Promise.resolve(
        onSave({
          url: url.trim(),
          title: title.trim(),
          picture: picture.trim(),
          tags: selectedTags
        })
      )

      onClose()
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsLoading(false)
    }
  }

  // Check if there are changes and URL is set
  const hasChanges = useMemo(() => {
    if (!url.trim()) {
      return false
    }

    if (!bookmark) {
      // For new bookmarks, there's a change if URL is set
      return true
    }

    // For existing bookmarks, check if any field changed
    const urlChanged = url.trim() !== bookmark.url
    const titleChanged = title.trim() !== bookmark.title
    const pictureChanged = picture.trim() !== bookmark.picture

    // Check if tags changed (compare arrays)
    const tagsChanged =
      selectedTags.length !== bookmark.tags.length ||
      selectedTags.some((tag) => !bookmark.tags.includes(tag)) ||
      bookmark.tags.some((tag) => !selectedTags.includes(tag))

    return urlChanged || titleChanged || pictureChanged || tagsChanged
  }, [url, title, picture, selectedTags, bookmark])

  const selectableTags = useMemo(() => {
    if (showHiddenTags) {
      return tags
    }

    // Keep already-selected hidden tags visible while hiding them from suggestions
    const selectedHiddenTags = tags.filter(
      (tag) => tag.hidden && selectedTags.includes(tag.id)
    )
    const visibleTags = tags.filter((tag) => !tag.hidden)

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, showHiddenTags, selectedTags])

  if (!isOpen) return null

  return (
    <Drawer
      title={bookmark ? 'Edit Bookmark' : 'Add Bookmark'}
      description='Make changes to your bookmark'
      open={isOpen}
      onClose={onClose}
    >
      <div className={styles.content}>
        <Input type='hidden' value={picture} />
        <Input
          error={errors.url}
          ref={urlField}
          size='lg'
          type='url'
          placeholder='https://example.com'
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (errors.url) setErrors({ ...errors, url: '' })
          }}
        />

        <Input
          error={errors.title}
          size='lg'
          type='text'
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (errors.title) setErrors({ ...errors, title: '' })
          }}
          placeholder='Bookmark title'
        />

        <TagSelectorField
          tags={selectableTags}
          selectedTags={selectedTags}
          onChange={setSelectedTags}
        />

        {errors.tags && (
          <span className={styles.fieldError}>{errors.tags}</span>
        )}
      </div>

      <div className={styles.actions}>
        <Button onClick={handleSubmit} disabled={!hasChanges || isLoading}>
          {isLoading && <Loader2 className={styles.spinner} />}
          {bookmark ? 'Save' : 'Create'}
        </Button>
      </div>
    </Drawer>
  )
}
