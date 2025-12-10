import { Loader2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { useResetOnOpen } from '@/entrypoints/components/hooks/useResetOnOpen'
import Button from '@/entrypoints/components/ui/Button'
import { Checkbox } from '@/entrypoints/components/ui/Checkbox'
import { Drawer } from '@/entrypoints/components/ui/Drawer'
import Input from '@/entrypoints/components/ui/Input'
import Text from '@/entrypoints/components/ui/Text'
import type { Tag } from '@/entrypoints/lib/types'
import { validateTagName } from '@/entrypoints/lib/validation'

import styles from './styles.module.css'

export const TagModal = ({
  isOpen,
  tag,
  onClose,
  onSave
}: {
  isOpen: boolean
  tag: Tag | null
  onClose: () => void
  onSave: (data: { name: string; hidden: boolean }) => void
}) => {
  const [form, setForm] = useState({
    name: tag?.name || '',
    hidden: tag?.hidden ?? false
  })
  const nameField = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Update form fields when tag prop changes or modal opens
  useResetOnOpen({
    isOpen,
    reset: () => {
      setForm({
        name: tag?.name || '',
        hidden: tag?.hidden ?? false
      })
      setErrors({})
      setIsLoading(false)
    },
    deps: [tag],
    focusRef: nameField as React.RefObject<{ focus: () => void }>
  })

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
      // Call onSave - wrap in Promise.resolve to handle both sync and async cases
      await Promise.resolve(
        onSave({
          name: form.name.trim(),
          hidden: form.hidden
        })
      )

      onClose()
    } catch (error) {
      // Error handling is done in parent component
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

  if (!isOpen) return null

  return (
    <Drawer
      title={tag ? 'Edit Tag' : 'Add Tag'}
      description={tag ? 'Manage tag details' : 'Create a new tag'}
      open={isOpen}
      onClose={onClose}
    >
      <div className={styles.content}>
        <Input
          ref={nameField}
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
        <Button onClick={handleSubmit} disabled={!hasChanges || isLoading}>
          {isLoading && <Loader2 className={styles.spinner} />}
          {tag ? 'Save' : 'Create'}
        </Button>
      </div>
    </Drawer>
  )
}
