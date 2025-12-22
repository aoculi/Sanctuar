import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useManifest } from '@/components/hooks/useManifest'
import usePopupSize from '@/components/hooks/usePopupSize'
import { useTags } from '@/components/hooks/useTags'
import { captureCurrentPage } from '@/lib/pageCapture'
import { getDefaultSettings, Settings } from '@/lib/storage'
import { MAX_TAGS_PER_ITEM } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'
import { TagSelectorField } from '@/components/ui/TagSelectorField'

import styles from './styles.module.css'

const emptyBookmark = {
  url: '',
  title: '',
  picture: '',
  tags: [] as string[]
}

export default function Bookmark({ id }: { id: string | null }) {
  usePopupSize('compact')
  const { navigate } = useNavigation()
  const { isSaving } = useManifest()
  const { addBookmark, updateBookmark, bookmarks } = useBookmarks()
  const { tags } = useTags()
  const bookmark = bookmarks.find((item) => item.id === id) || null

  const [settings, setSettings] = useState<Settings>(getDefaultSettings())
  const [form, setForm] = useState(emptyBookmark)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Initialize form when editing an existing bookmark
  useEffect(() => {
    if (bookmark) {
      setForm({
        url: bookmark.url,
        title: bookmark.title,
        picture: bookmark.picture,
        tags: bookmark.tags
      })
    }
  }, [bookmark])

  // Capture current page when creating a new bookmark
  useEffect(() => {
    // if we update a page, do not capture it again
    if (bookmark) {
      return
    }

    const loadCurrentPage = async () => {
      setIsLoading(true)
      setCaptureError(null)

      const result = await captureCurrentPage()
      if (result.ok) {
        setForm({
          url: result.bookmark.url,
          title: result.bookmark.title,
          picture: result.bookmark.picture,
          tags: result.bookmark.tags
        })
      } else {
        setCaptureError(result.error)
      }

      setIsLoading(false)
    }

    loadCurrentPage()
  }, [bookmark])

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

    if (!validateForm() || isLoading || isSaving) {
      return
    }

    setIsLoading(true)
    setSaveError(null)

    try {
      if (bookmark) {
        await updateBookmark(bookmark.id, {
          url: form.url.trim(),
          title: form.title.trim(),
          picture: form.picture.trim(),
          tags: form.tags
        })
      } else {
        await addBookmark({
          url: form.url.trim(),
          title: form.title.trim(),
          picture: form.picture.trim(),
          tags: form.tags
        })
      }

      navigate('/vault')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save bookmark'
      setSaveError(errorMessage)
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
    if (settings.showHiddenTags) {
      return tags
    }

    // Keep already-selected hidden tags visible while hiding them from suggestions
    const selectedHiddenTags = tags.filter(
      (tag) => tag.hidden && form.tags.includes(tag.id)
    )
    const visibleTags = tags.filter((tag) => !tag.hidden)

    return [...visibleTags, ...selectedHiddenTags]
  }, [tags, settings.showHiddenTags, form.tags])

  const buttonLabel = bookmark ? 'Save' : 'Create'

  return (
    <div className={styles.component}>
      <Header title={bookmark ? 'Edit' : 'New'} canSwitchToVault={true} />

      <div className={styles.page}>
        {captureError && <ErrorCallout>{captureError}</ErrorCallout>}
        {saveError && <ErrorCallout>{saveError}</ErrorCallout>}

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
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isLoading || isSaving}
          >
            {(isLoading || isSaving) && <Loader2 className={styles.spinner} />}
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
