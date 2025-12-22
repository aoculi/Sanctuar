import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSelection } from '@/components/hooks/providers/useSelectionProvider'
import usePopupSize from '@/components/hooks/usePopupSize'
import { useTags } from '@/components/hooks/useTags'
import type { Tag as tagType } from '@/lib/types'
import { validateTagName } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

const defaultTag = {
  name: '',
  hidden: false
}
export default function Tag() {
  usePopupSize('compact')
  const { tags, createTag, updateTag } = useTags()
  const { navigate } = useNavigation()
  const { selectedTag, setSelectedTag } = useSelection()

  const tag = tags.find((tag: tagType) => tag.id === selectedTag) || null

  useEffect(() => {
    if (tag) {
      setForm({
        name: tag.name,
        hidden: tag?.hidden ?? false
      })
    }
  }, [tag])

  const [form, setForm] = useState(defaultTag)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Name validation
    const validationError = validateTagName(form.name)
    if (validationError) {
      newErrors.name = validationError
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
      if (tag) {
        await updateTag(tag.id, {
          name: form.name.trim(),
          hidden: form.hidden
        })
      } else {
        await createTag({
          name: form.name.trim(),
          hidden: form.hidden
        })
      }

      setSelectedTag(null)
      navigate('/vault')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save tag'
      setSaveError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if there are changes and name is set
  const hasChanges = useMemo(() => {
    if (!form.name.trim()) {
      return false
    }

    if (!tag) {
      // For new tags, there's a change if name is set
      return true
    }

    // For existing tags, check if name or hidden changed
    return (
      form.name.trim() !== tag.name || form.hidden !== (tag.hidden ?? false)
    )
  }, [form, tag])

  return (
    <div className={styles.component}>
      <Header title={tag ? 'Edit tag' : 'New tag'} canSwitchToVault={true} />

      <div className={styles.page}>
        {saveError && <ErrorCallout>{saveError}</ErrorCallout>}

        <div className={styles.content}>
          <Input
            error={errors.name}
            size='lg'
            type='text'
            placeholder='Tag name'
            value={form.name}
            onChange={(e) => {
              const nextName = e.target.value
              setForm((prev) => ({ ...prev, name: nextName }))
              if (errors.name) setErrors({ ...errors, name: '' })
            }}
          />

          <Text as='label' size='2'>
            <Checkbox
              checked={form.hidden}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, hidden: e.target.checked }))
              }
            />
            Hide tag from list
          </Text>
        </div>

        <div className={styles.actions}>
          <Button
            onClick={() => {
              setSelectedTag(null)
              navigate('/vault')
            }}
            color='black'
          >
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={!hasChanges || isLoading}>
            {isLoading && <Loader2 className={styles.spinner} />}
            {tag ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}
