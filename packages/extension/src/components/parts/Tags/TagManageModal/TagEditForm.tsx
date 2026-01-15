import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useTags } from '@/components/hooks/useTags'
import type { Tag } from '@/lib/types'
import { validateTagName } from '@/lib/validation'

import Button from '@/components/ui/Button'
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
}

export default function TagEditForm({ tag, onClose }: TagEditFormProps) {
  const { updateTag } = useTags()
  const { setFlash } = useNavigation()

  const [form, setForm] = useState<TagForm>({
    name: tag.name,
    color: tag.color
  })
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = useMemo(
    () => form.name.trim() !== tag.name || form.color !== tag.color,
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
        color: form.color
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
