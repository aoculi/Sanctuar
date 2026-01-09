import { Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import { COLLECTION_ICONS } from '@/components/ui/IconPicker'
import Input from '@/components/ui/Input'

import styles from './styles.module.css'

interface IconPickerModalProps {
  open: boolean
  onClose: () => void
  value?: string
  onChange: (icon: string | undefined) => void
}

export default function IconPickerModal({
  open,
  onClose,
  value,
  onChange
}: IconPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (query === '') return COLLECTION_ICONS
    return COLLECTION_ICONS.filter((icon) =>
      icon.name.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Handle icon selection
  const handleSelectIcon = (iconName: string) => {
    onChange(iconName)
    setSearchQuery('')
    onClose()
  }

  // Handle clear icon
  const handleClearIcon = () => {
    onChange(undefined)
    setSearchQuery('')
    onClose()
  }

  // Reset search when modal closes
  const handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title='Select Icon'
      description='Choose an icon for this collection'
      width={400}
    >
      <div className={styles.content}>
        <div className={styles.searchContainer}>
          <Input
            placeholder='Search icons...'
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchQuery(e.target.value)
            }}
            autoFocus
          >
            <Sparkles size={14} />
          </Input>
        </div>

        {filteredIcons.length === 0 ? (
          <div className={styles.noResults}>No icons found</div>
        ) : (
          <div className={styles.iconGrid}>
            {filteredIcons.map(({ name, Icon }) => (
              <button
                key={name}
                type='button'
                className={`${styles.iconButton} ${
                  value === name ? styles.selected : ''
                }`}
                onClick={() => handleSelectIcon(name)}
                title={name}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        )}

        {value && (
          <div className={styles.actions}>
            <button
              type='button'
              className={styles.clearButton}
              onClick={handleClearIcon}
            >
              Remove icon
            </button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
