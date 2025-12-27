import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import usePopupSize from '@/components/hooks/usePopupSize'
import { useTags } from '@/components/hooks/useTags'
import type { Tag as tagType } from '@/lib/types'
import { validateTagName } from '@/lib/validation'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import ColorPicker from '@/components/ui/ColorPicker'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

const defaultTag = {
  name: '',
  hidden: false,
  color: undefined as string | undefined
}
export default function Tag() {
  usePopupSize('compact')
  const { tags, createTag, updateTag } = useTags()
  const { navigate, selectedTag, setFlash } = useNavigation()

  const tag = tags.find((tag: tagType) => tag.id === selectedTag) || null

  useEffect(() => {
    if (tag) {
      setForm({
        name: tag.name,
        hidden: tag?.hidden ?? false,
        color: tag?.color
      })
    }
  }, [tag])

  const [form, setForm] = useState(defaultTag)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

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
          hidden: form.hidden,
          color: form.color
        })
      } else {
        await createTag({
          name: form.name.trim(),
          hidden: form.hidden,
          color: form.color
        })
      }

      navigate('/vault')
    } catch (error) {
      setFlash(
        'Failed to save tag: ' + ((error as Error).message ?? 'Unknown error')
      )
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

    // For existing tags, check if name, hidden, or color changed
    return (
      form.name.trim() !== tag.name ||
      form.hidden !== (tag.hidden ?? false) ||
      form.color !== tag.color
    )
  }, [form, tag])

  return (
    <div className={styles.component}>
      <Header title={tag ? 'Edit tag' : 'New tag'} canSwitchToVault={true} />

      <div className={styles.page}>
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

          <div className={styles.colorSection}>
            <Text as='label' size='2' className={styles.colorLabel}>
              Color
            </Text>
            <ColorPicker
              value={form.color}
              onChange={(color) => setForm((prev) => ({ ...prev, color }))}
            />
          </div>

          <Text as='label' size='2'>
            <Checkbox
              checked={form.hidden}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, hidden: e.target.checked }))
              }
              label='Hide tag from list'
            />
          </Text>
        </div>

        <div className={styles.actions}>
          <Button
            onClick={() => {
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
