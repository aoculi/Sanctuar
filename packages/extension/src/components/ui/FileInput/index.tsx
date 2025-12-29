import React, { useRef } from 'react'

import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface FileInputProps {
  accept?: string
  onChange: (file: File | null) => void
  value?: File | null
  error?: string
  disabled?: boolean
  label?: string
  description?: string
}

export default function FileInput({
  accept,
  onChange,
  value,
  error,
  disabled = false,
  label,
  description
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleButtonClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    onChange(file)
  }

  return (
    <div className={styles.component}>
      {label && (
        <Text as='label' size='3' weight='medium'>
          {label}
        </Text>
      )}
      <div className={styles.inputContainer}>
        <input
          ref={inputRef}
          type='file'
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled}
          className={styles.hiddenInput}
        />
        <div className={styles.fileDisplay}>
          {value ? (
            <div className={styles.fileInfo}>
              <Text size='2'>{value.name}</Text>
              <Text size='1' color='light'>
                {(value.size / 1024).toFixed(2)} KB
              </Text>
            </div>
          ) : (
            <Text size='2' color='light'>
              No file selected
            </Text>
          )}
          <Button
            onClick={handleButtonClick}
            disabled={disabled}
            size='sm'
            variant='ghost'
            color='primary'
          >
            {value ? 'Change' : 'Choose File'}
          </Button>
        </div>
      </div>
      {description && (
        <Text size='2' color='light'>
          {description}
        </Text>
      )}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  )
}
