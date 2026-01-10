import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useTags } from '@/components/hooks/useTags'
import type { Tag } from '@/lib/types'
import { validateTagName } from '@/lib/validation'

import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import ColorPicker from '@/components/ui/ColorPicker'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface TagEditFormProps {
  tag: Tag
  onClose: () => void
}

interface TagForm {
  name: string
  color?: string
  hidden: boolean
}

export default function TagEditForm({ tag, onClose }: TagEditFormProps) {
  const { updateTag } = useTags()
  const { setFlash } = useNavigation()

  const [form, setForm] = useState<TagForm>({
    name: tag.name,
    color: tag.color,
    hidden: tag.hidden ?? false
  })
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = useMemo(
    () =>
      form.name.trim() !== tag.name ||
      form.color !== tag.color ||
      form.hidden !== (tag.hidden ?? false),
    [form, tag]
  )

  const handleSave = async () => {
    const error = validateTagName(form.name)
    if (error) {
      setFlash(error)
      return
    }

    setIsSaving(true)
    try {
      await updateTag(tag.id, {
        name: form.name.trim(),
        color: form.color,
        hidden: form.hidden
      })
      onClose()
    } catch (error) {
      setFlash(`Failed to update tag: ${(error as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.editForm}>
      <button
        className={styles.backButton}
        onClick={onClose}
        type='button'
      >
        <ArrowLeft size={16} />
        <Text size='2'>Back to list</Text>
      </button>

      <Input
        size='md'
        type='text'
        placeholder='Tag name'
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />

      <div className={styles.colorSection}>
        <Text as='label' size='2' color='light'>
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

      <div className={styles.editActions}>
        <Button onClick={onClose} color='black' size='sm'>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || !form.name.trim() || isSaving}
          size='sm'
        >
          {isSaving && <Loader2 className={styles.spinner} size={14} />}
          Save
        </Button>
      </div>
    </div>
  )
}
