import { Loader2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { useResetOnOpen } from '@/entrypoints/components/hooks/useResetOnOpen'
import { useTagVisibilityPreference } from '@/entrypoints/components/hooks/useTagVisibilityPreference'

import Button from '@/entrypoints/components/ui/Button'
import { Drawer } from '@/entrypoints/components/ui/Drawer'
import Input from '@/entrypoints/components/ui/Input'
import { TagSelectorField } from '@/entrypoints/components/ui/TagSelectorField'

import type { Bookmark, Tag } from '@/entrypoints/lib/types'
import { MAX_TAGS_PER_ITEM } from '@/entrypoints/lib/validation'

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
  const [form, setForm] = useState({
    url: bookmark?.url || '',
    title: bookmark?.title || '',
    picture: bookmark?.picture || '',
    tags: bookmark?.tags || []
  })

  const urlField = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const { showHiddenTags } = useTagVisibilityPreference()

  // Update form fields when bookmark prop changes or modal opens
  useResetOnOpen({
    isOpen,
    reset: () => {
      if (tmp) {
        setForm({
          url: tmp.url,
          title: tmp.title,
          picture: tmp.picture,
          tags: []
        })
      } else {
        setForm({
          url: bookmark?.url || '',
          title: bookmark?.title || '',
          picture: bookmark?.picture || '',
          tags: bookmark?.tags || []
        })
      }
      setErrors({})
      setIsLoading(false)
    },
    deps: [bookmark, tmp],
    focusRef: urlField as React.RefObject<{ focus: () => void }>
  })

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // URL validation
    if (!form.url.trim()) {
      newErrors.url = 'URL is required'
    } else {
      try {
        const parsed = new URL(form.url.trim())
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors.url = 'URL must start with http:// or https://'
        }
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    // Title validation
    if (!form.title.trim()) {
      newErrors.title = 'Title is required'
    }

    // Tags validation
    if (form.tags.length > MAX_TAGS_PER_ITEM) {
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
          url: form.url.trim(),
          title: form.title.trim(),
          picture: form.picture.trim(),
          tags: form.tags
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
    if (!form.url.trim()) {
      return false
    }

    if (!bookmark) {
      // For new bookmarks, there's a change if URL is set
      return true
    }

    // For existing bookmarks, check if any field changed
    const urlChanged = form.url.trim() !== bookmark.url
    const titleChanged = form.title.trim() !== bookmark.title
    const pictureChanged = form.picture.trim() !== bookmark.picture

    // Check if tags changed (compare arrays)
    const tagsChanged =
      form.tags.length !== bookmark.tags.length ||
      form.tags.some((tag) => !bookmark.tags.includes(tag)) ||
      bookmark.tags.some((tag) => !form.tags.includes(tag))

    return urlChanged || titleChanged || pictureChanged || tagsChanged
  }, [form, bookmark])

  const selectableTags = useMemo(() => {
    if (showHiddenTags) {
      return tags
    }

    // Keep already-selected hidden tags visible while hiding them from suggestions
    const selectedHiddenTags = tags.filter(
      (tag) => tag.hidden && form.tags.includes(tag.id)
    )
    const visibleTags = tags.filter((tag) => !tag.hidden)

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, showHiddenTags, form.tags])

  if (!isOpen) return null

  return (
    <Drawer
      title={bookmark ? 'Edit Bookmark' : 'Add Bookmark'}
      description='Make changes to your bookmark'
      open={isOpen}
      onClose={onClose}
    >
      <div className={styles.content}>
        <Input type='hidden' value={form.picture} />
        <Input
          error={errors.url}
          ref={urlField}
          size='lg'
          type='url'
          placeholder='https://example.com'
          value={form.url}
          onChange={(e) => {
            const next = e.target.value
            setForm((prev) => ({ ...prev, url: next }))
            if (errors.url) setErrors({ ...errors, url: '' })
          }}
        />

        <Input
          error={errors.title}
          size='lg'
          type='text'
          value={form.title}
          onChange={(e) => {
            const next = e.target.value
            setForm((prev) => ({ ...prev, title: next }))
            if (errors.title) setErrors({ ...errors, title: '' })
          }}
          placeholder='Bookmark title'
        />

        <TagSelectorField
          tags={selectableTags}
          selectedTags={form.tags}
          onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
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
