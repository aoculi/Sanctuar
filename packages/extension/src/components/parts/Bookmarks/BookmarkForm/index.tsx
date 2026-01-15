import { Check, Globe, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { flattenCollectionsWithDepth } from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'
import { getHostname } from '@/lib/utils'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { TagSelectorField } from '@/components/ui/TagSelectorField'
import Textarea from '@/components/ui/Textarea'

import styles from './styles.module.css'

export type BookmarkFormData = {
  url: string
  title: string
  note: string
  picture: string
  tags: string[]
  collectionId: string | undefined
}

interface BookmarkFormProps {
  /** Initial data for editing, or partial data for new bookmarks */
  initialData?: Partial<BookmarkFormData>
  /** Called when form is submitted with validated data */
  onSubmit: (data: BookmarkFormData) => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Label for the submit button (default: "Save") */
  submitLabel?: string
  /** Whether the form submission was successful */
  isSuccess?: boolean
  /** Message to show on success (default: "Saved!") */
  successMessage?: string
}

const emptyFormData: BookmarkFormData = {
  url: '',
  title: '',
  note: '',
  picture: '',
  tags: [],
  collectionId: undefined
}

export default function BookmarkForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
  isSuccess = false,
  successMessage = 'Saved!'
}: BookmarkFormProps) {
  const { collections } = useCollections()
  const { tags } = useTags()
  const { settings } = useSettings()

  const [form, setForm] = useState<BookmarkFormData>(() => ({
    ...emptyFormData,
    ...initialData
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [faviconError, setFaviconError] = useState(false)

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        ...initialData
      }))
      setFaviconError(false)
    }
  }, [initialData])

  // Get favicon URL from the bookmark URL
  const faviconUrl = useMemo(() => {
    if (form.picture) return form.picture
    if (!form.url?.trim()) return null
    const hostname = getHostname(form.url)
    if (!hostname) return null
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  }, [form.url, form.picture])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // URL validation
    if (!form.url?.trim()) {
      newErrors.url = 'URL is required'
    } else {
      try {
        const parsed = new URL(form.url?.trim())
        const allowedProtocols = [
          'http:',
          'https:',
          'javascript:',
          'file:',
          'data:',
          'about:'
        ]
        if (!allowedProtocols.includes(parsed.protocol)) {
          newErrors.url =
            'URL must use a valid protocol (http://, https://, javascript:, etc.)'
        }
      } catch {
        newErrors.url = 'Please enter a valid URL'
      }
    }

    // Title validation
    if (!form.title?.trim()) {
      newErrors.title = 'Title is required'
    }

    // Tags validation
    if (form.tags.length > MAX_TAGS_PER_ITEM) {
      newErrors.tags = `Maximum ${MAX_TAGS_PER_ITEM} tags per bookmark`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || isSubmitting) {
      return
    }

    onSubmit({
      url: form.url?.trim(),
      title: form.title?.trim(),
      note: form.note?.trim(),
      picture: form.picture?.trim(),
      tags: form.tags,
      collectionId: form.collectionId
    })
  }

  // Check if form has valid data for submission
  const canSubmit = useMemo(() => {
    return form.url?.trim() && form.title?.trim()
  }, [form.url, form.title])

  const selectableTags = useMemo(() => {
    if (settings.showHiddenTags) {
      return tags
    }

    const selectedTagIds = new Set(form.tags)
    const selectedHiddenTags: typeof tags = []
    const visibleTags: typeof tags = []

    for (const tag of tags) {
      if (tag.hidden) {
        if (selectedTagIds.has(tag.id)) {
          selectedHiddenTags.push(tag)
        }
      } else {
        visibleTags.push(tag)
      }
    }

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, settings.showHiddenTags, form.tags])

  const collectionsWithDepth = useMemo(
    () => flattenCollectionsWithDepth(collections),
    [collections]
  )

  // Show loading until we have the initial data
  if (!initialData?.url) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 size={32} className={styles.loadingSpinner} />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successIcon}>
          <Check size={32} />
        </div>
        <span className={styles.successMessage}>{successMessage}</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.content}>
        {/* Header section: favicon + title/url */}
        <div className={styles.header}>
          <div className={styles.favicon}>
            {faviconUrl && !faviconError ? (
              <img
                src={faviconUrl}
                alt=''
                width={20}
                height={20}
                onError={() => setFaviconError(true)}
              />
            ) : (
              <Globe size={20} className={styles.faviconPlaceholder} />
            )}
          </div>
          <div className={styles.headerInfo}>
            <input
              type='text'
              className={`${styles.titleInput} ${errors.title ? styles.inputError : ''}`}
              value={form.title}
              onChange={(e) => {
                const next = e.target.value
                setForm((prev) => ({ ...prev, title: next }))
                if (errors.title) setErrors({ ...errors, title: '' })
              }}
              placeholder='Bookmark title'
            />
            <input
              type='url'
              className={`${styles.urlInput} ${errors.url ? styles.inputError : ''}`}
              value={form.url}
              onChange={(e) => {
                const next = e.target.value
                setForm((prev) => ({ ...prev, url: next }))
                setFaviconError(false)
                if (errors.url) setErrors({ ...errors, url: '' })
              }}
              placeholder='https://example.com'
            />
          </div>
        </div>

        {(errors.title || errors.url) && (
          <div className={styles.headerErrors}>
            {errors.title && (
              <span className={styles.fieldError}>{errors.title}</span>
            )}
            {errors.url && (
              <span className={styles.fieldError}>{errors.url}</span>
            )}
          </div>
        )}

        <Textarea
          size='lg'
          value={form.note}
          onChange={(e) => {
            const next = e.target.value
            setForm((prev) => ({ ...prev, note: next }))
          }}
          placeholder='Add a note...'
          rows={3}
        />

        <Select
          size='lg'
          value={form.collectionId || ''}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              collectionId: e.target.value || undefined
            }))
          }
        >
          <option value=''>No collection</option>
          {collectionsWithDepth.map(({ collection, depth }) => (
            <option key={collection.id} value={collection.id}>
              {'  '.repeat(depth)}
              {collection.name}
            </option>
          ))}
        </Select>

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
        <Button type='submit' disabled={!canSubmit || isSubmitting}>
          {isSubmitting && <Loader2 className={styles.spinner} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export type { Bookmark }
