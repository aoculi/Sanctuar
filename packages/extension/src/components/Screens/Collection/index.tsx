import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import usePopupSize from '@/components/hooks/usePopupSize'
import { useTags } from '@/components/hooks/useTags'
import {
  getNextCollectionOrder,
  wouldCreateCircularReference
} from '@/lib/collectionUtils'
import type { Collection as CollectionType } from '@/lib/types'
import { generateId } from '@/lib/utils'
import { validateCollectionName } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import IconPicker from '@/components/ui/IconPicker'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { TagSelectorField } from '@/components/ui/TagSelectorField'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type FormState = {
  name: string
  icon?: string
  parentId?: string
  tagFilter: { mode: 'any' | 'all'; tagIds: string[] }
}

const defaultForm: FormState = {
  name: '',
  icon: undefined,
  parentId: undefined,
  tagFilter: { mode: 'any', tagIds: [] }
}

export default function Collection() {
  usePopupSize('compact')
  const { tags } = useTags()
  const { manifest, save } = useManifest()
  const { navigate, selectedCollection, setFlash } = useNavigation()

  const collections = manifest?.collections || []

  const existingCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollection) || null,
    [collections, selectedCollection]
  )

  const [form, setForm] = useState<FormState>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (existingCollection) {
      setForm({
        name: existingCollection.name,
        icon: existingCollection.icon,
        parentId: existingCollection.parentId,
        tagFilter: { ...existingCollection.tagFilter }
      })
    }
  }, [existingCollection])

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    const nameError = validateCollectionName(form.name)
    if (nameError) newErrors.name = nameError

    if (form.tagFilter.tagIds.length === 0) {
      newErrors.tags = 'Select at least one tag'
    }

    if (
      wouldCreateCircularReference(
        collections,
        existingCollection?.id || null,
        form.parentId
      )
    ) {
      newErrors.parentId = 'Would create a circular reference'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || isLoading || !manifest) return

    setIsLoading(true)

    try {
      const now = Date.now()
      const trimmedName = form.name.trim()

      if (existingCollection) {
        // Update existing
        await save({
          ...manifest,
          collections: collections.map((c) =>
            c.id === existingCollection.id
              ? {
                  ...c,
                  name: trimmedName,
                  icon: form.icon,
                  parentId: form.parentId,
                  tagFilter: form.tagFilter,
                  updated_at: now
                }
              : c
          )
        })
      } else {
        // Create new
        const newCollection: CollectionType = {
          id: generateId(),
          name: trimmedName,
          icon: form.icon,
          parentId: form.parentId,
          order: getNextCollectionOrder(collections, form.parentId),
          tagFilter: form.tagFilter,
          created_at: now,
          updated_at: now
        }
        await save({
          ...manifest,
          collections: [...collections, newCollection]
        })
      }

      navigate('/collections')
    } catch (error) {
      setFlash(`Failed to save: ${(error as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = useMemo(() => {
    if (!form.name.trim() || form.tagFilter.tagIds.length === 0) return false
    if (!existingCollection) return true

    const tagIdsChanged =
      form.tagFilter.tagIds.length !==
        existingCollection.tagFilter.tagIds.length ||
      form.tagFilter.tagIds.some(
        (id) => !existingCollection.tagFilter.tagIds.includes(id)
      )

    return (
      form.name.trim() !== existingCollection.name ||
      form.icon !== existingCollection.icon ||
      form.parentId !== existingCollection.parentId ||
      form.tagFilter.mode !== existingCollection.tagFilter.mode ||
      tagIdsChanged
    )
  }, [form, existingCollection])

  return (
    <div className={styles.component}>
      <Header
        title={existingCollection ? 'Edit collection' : 'New collection'}
        canSwitchToVault
      />

      <div className={styles.page}>
        <div className={styles.content}>
          <Input
            error={errors.name}
            size='lg'
            type='text'
            placeholder='Collection name'
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
          />

          <div className={styles.section}>
            <Text as='label' size='2' className={styles.sectionLabel}>
              Icon
            </Text>
            <IconPicker
              value={form.icon}
              onChange={(icon) => updateForm('icon', icon)}
            />
          </div>

          <div className={styles.section}>
            <Text as='label' size='2' className={styles.sectionLabel}>
              Parent collection
            </Text>
            <Select
              size='lg'
              error={errors.parentId}
              value={form.parentId || ''}
              onChange={(e) =>
                updateForm('parentId', e.target.value || undefined)
              }
            >
              <option value=''>None (root level)</option>
              {collections
                .filter((c) => c.id !== existingCollection?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            {errors.parentId && (
              <Text size='1' className={styles.error}>
                {errors.parentId}
              </Text>
            )}
            <Text size='2' color='light' className={styles.hint}>
              Nest this collection inside another.
            </Text>
          </div>

          <div className={styles.section}>
            <Text as='label' size='2' className={styles.sectionLabel}>
              Tags
            </Text>
            <TagSelectorField
              tags={tags}
              selectedTags={form.tagFilter.tagIds}
              onChange={(tagIds) =>
                updateForm('tagFilter', { ...form.tagFilter, tagIds })
              }
            />
            {errors.tags && (
              <Text size='1' className={styles.error}>
                {errors.tags}
              </Text>
            )}
          </div>

          <div className={styles.section}>
            <Text as='label' size='2' className={styles.sectionLabel}>
              Filter mode
            </Text>
            <Select
              size='lg'
              value={form.tagFilter.mode}
              onChange={(e) =>
                updateForm('tagFilter', {
                  ...form.tagFilter,
                  mode: e.target.value as 'any' | 'all'
                })
              }
            >
              <option value='any'>Match ANY tag (OR)</option>
              <option value='all'>Match ALL tags (AND)</option>
            </Select>
            <Text size='2' color='light' className={styles.hint}>
              {form.tagFilter.mode === 'any'
                ? 'Bookmarks with at least one selected tag will appear.'
                : 'Only bookmarks with ALL selected tags will appear.'}
            </Text>
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => navigate('/collections')} color='black'>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isLoading}>
            {isLoading && <Loader2 className={styles.spinner} />}
            {existingCollection ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}
