import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import { flattenCollectionsWithDepth } from '@/lib/collectionUtils'
import type { Bookmark } from '@/lib/types'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { TagSelectorField } from '@/components/ui/TagSelectorField'
import Text from '@/components/ui/Text'
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
  submitLabel = 'Save'
}: BookmarkFormProps) {
  const { collections } = useCollections()
  const { tags } = useTags()
  const { settings } = useSettings()

  const [form, setForm] = useState<BookmarkFormData>(() => ({
    ...emptyFormData,
    ...initialData
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        ...initialData
      }))
    }
  }, [initialData])

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

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.content}>
        {form.picture && (
          <div className={styles.picture}>
            <img src={form.picture} alt={form.title} />
          </div>
        )}

        <Input
          type='hidden'
          value={form.picture}
          onChange={(e) => {
            const next = e.target.value
            setForm((prev) => ({ ...prev, picture: next }))
          }}
        />

        <Input
          error={errors.url}
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

        <Textarea
          size='lg'
          value={form.note}
          onChange={(e) => {
            const next = e.target.value
            setForm((prev) => ({ ...prev, note: next }))
          }}
          placeholder='Add a note...'
          rows={4}
        />

        <div className={styles.section}>
          <Text as='label' size='2' className={styles.sectionLabel}>
            Collection
          </Text>
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
            <option value=''>None</option>
            {collectionsWithDepth.map(({ collection, depth }) => (
              <option key={collection.id} value={collection.id}>
                {'  '.repeat(depth)}
                {collection.name}
              </option>
            ))}
          </Select>
        </div>

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
