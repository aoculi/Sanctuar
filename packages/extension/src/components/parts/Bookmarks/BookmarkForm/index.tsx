import { Check, Globe, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useCollections } from '@/components/hooks/useCollections'
import { useTags } from '@/components/hooks/useTags'
import type { Bookmark } from '@/lib/types'
import { getFaviconUrl } from '@/lib/utils'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import LoadingScreen from '@/components/ui/LoadingScreen'
import CollectionSelect from '@/components/ui/CollectionSelect'
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
  hidden: boolean
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
  /** 'popup' pins the actions to the bottom and scrolls the fields */
  layout?: 'default' | 'popup'
  /** Focus the note field on mount (quick capture) */
  autoFocusNote?: boolean
  /** When provided, shows a button to re-fetch title and favicon */
  onRefreshMetadata?: () => void
  isRefreshing?: boolean
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const emptyFormData: BookmarkFormData = {
  url: '',
  title: '',
  note: '',
  picture: '',
  tags: [],
  collectionId: undefined,
  hidden: false
}

export default function BookmarkForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
  isSuccess = false,
  successMessage = 'Saved!',
  layout = 'default',
  autoFocusNote = false,
  onRefreshMetadata,
  isRefreshing = false
}: BookmarkFormProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const { collections } = useCollections()
  const { tags, createTag } = useTags()

  const [form, setForm] = useState<BookmarkFormData>(() => ({
    ...emptyFormData,
    ...initialData
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [faviconError, setFaviconError] = useState(false)

  // Apply only the fields of initialData that actually changed. Parents often
  // pass a fresh object on every render (e.g. after creating a tag saves the
  // manifest), and blindly merging it would wipe what the user has typed.
  const prevInitialRef = useRef<Partial<BookmarkFormData> | undefined>(
    initialData
  )
  useEffect(() => {
    if (!initialData) return
    const prev = prevInitialRef.current
    prevInitialRef.current = initialData
    const changed: Partial<BookmarkFormData> = {}
    for (const key of Object.keys(initialData) as (keyof BookmarkFormData)[]) {
      if (
        !prev ||
        !(key in prev) ||
        JSON.stringify(prev[key]) !== JSON.stringify(initialData[key])
      ) {
        ;(changed as Record<string, unknown>)[key] = initialData[key]
      }
    }
    if (Object.keys(changed).length === 0) return
    setForm((current) => ({ ...current, ...changed }))
    if ('url' in changed || 'picture' in changed) setFaviconError(false)
  }, [initialData])

  // Get favicon URL from the bookmark URL
  const faviconUrl = useMemo(
    () => getFaviconUrl(form.url?.trim() ?? '', form.picture),
    [form.url, form.picture]
  )

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!validateForm() || isSubmitting) {
      return
    }

    onSubmit({
      url: form.url?.trim(),
      title: form.title?.trim(),
      note: form.note?.trim(),
      picture: form.picture?.trim(),
      tags: form.tags,
      collectionId: form.collectionId,
      hidden: form.hidden
    })
  }

  // Check if form has valid data for submission
  const canSubmit = useMemo(() => {
    return form.url?.trim() && form.title?.trim()
  }, [form.url, form.title])

  const isReady = !!initialData && 'url' in initialData

  useEffect(() => {
    if (autoFocusNote && isReady) {
      noteRef.current?.focus()
    }
  }, [autoFocusNote, isReady])

  // Ctrl/Cmd + Enter saves from any field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Show loading while initial data hasn't been provided yet.
  // Once the parent has finished capturing the page (even if url is empty),
  // the 'url' key will be present and we render the form.
  if (!isReady) {
    return <LoadingScreen />
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
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className={`${styles.form} ${layout === 'popup' ? styles.popup : ''}`}
    >
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
              aria-label='Title'
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
              aria-label='URL'
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
          {onRefreshMetadata && (
            <button
              type='button'
              className={styles.refreshButton}
              onClick={onRefreshMetadata}
              disabled={isRefreshing}
              title='Re-fetch title and icon from the page'
              aria-label='Re-fetch title and icon from the page'
            >
              {isRefreshing ? (
                <Loader2 size={14} className={styles.spinner} />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
          )}
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor='bookmark-note'>
            Note
          </label>
          <Textarea
            id='bookmark-note'
            ref={noteRef}
            size='md'
            value={form.note}
            onChange={(e) => {
              const next = e.target.value
              setForm((prev) => ({ ...prev, note: next }))
            }}
            placeholder='Why are you saving this?'
            rows={2}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Collection</span>
          <CollectionSelect
            collections={collections}
            value={form.collectionId}
            onChange={(collectionId) =>
              setForm((prev) => ({ ...prev, collectionId }))
            }
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Tags</span>
          <TagSelectorField
            tags={tags}
            selectedTags={form.tags}
            onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
            onCreateTag={(name) => createTag({ name })}
          />
          {errors.tags && (
            <span className={styles.fieldError}>{errors.tags}</span>
          )}
        </div>

        <div className={styles.hiddenField}>
          <Checkbox
            checked={form.hidden}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hidden: e.target.checked }))
            }
            label={
              <Text as='span' size='2'>
                Hide from list
              </Text>
            }
          />
          <span className={styles.hint}>
            Only shown when you reveal hidden items in your bookmarks.
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <span className={styles.shortcutHint}>
          {isMac ? '⌘' : 'Ctrl'} + Enter
        </span>
        <Button type='submit' disabled={!canSubmit || isSubmitting}>
          {isSubmitting && <Loader2 size={14} className={styles.spinner} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export type { Bookmark }
