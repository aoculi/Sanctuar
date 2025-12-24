import { Palette, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChromePicker } from 'react-color'

import styles from './styles.module.css'

interface ColorPickerProps {
  value?: string
  onChange: (color: string | undefined) => void
}

// 14 predefined pastel colors
const PREDEFINED_COLORS = [
  '#ffadad', // pastel red
  '#ffd6a5', // pastel orange
  '#fdffb6', // pastel yellow
  '#caffbf', // pastel green
  '#9bf6ff', // pastel blue
  '#bdb2ff', // pastel indigo
  '#ffc6ff', // pastel pink
  '#ffcad4', // light rose
  '#ffe5d9', // peach
  '#e2f0cb', // light lime
  '#d0f4de', // mint
  '#a0c4ff', // sky
  '#cde7ff', // pale sky
  '#e5e5f7' // soft lavender
]

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handlePredefinedColorClick = (color: string) => {
    onChange(color)
  }

  const handleCustomColorClick = () => {
    setIsPopoverOpen(true)
  }

  const handleColorChange = (color: { hex: string }) => {
    onChange(color.hex)
  }

  const handleNoColorClick = () => {
    onChange(undefined)
  }

  const isPredefinedColor = value && PREDEFINED_COLORS.includes(value)
  const hasNoColor = !value || value === null || value === undefined

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isPopoverOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false)
      }
    }

    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPopoverOpen])

  return (
    <div className={styles.component}>
      <div className={styles.grid}>
        {PREDEFINED_COLORS.map((color) => (
          <button
            key={color}
            type='button'
            className={`${styles.colorButton} ${
              value === color ? styles.selected : ''
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handlePredefinedColorClick(color)}
            aria-label={`Select color ${color}`}
          />
        ))}
        <button
          type='button'
          className={`${styles.colorButton} ${styles.noColorButton} ${
            hasNoColor ? styles.selected : ''
          } ${hasNoColor ? styles.noColorSelected : ''}`}
          onClick={handleNoColorClick}
          aria-label='No color'
        >
          <X size={14} />
        </button>
        <button
          ref={triggerRef}
          type='button'
          className={`${styles.colorButton} ${styles.customColorButton} ${
            !isPredefinedColor && value ? styles.selected : ''
          }`}
          onClick={handleCustomColorClick}
          aria-label='Select custom color'
        >
          <Palette size={14} />
          {!isPredefinedColor && value && (
            <div
              className={styles.customColorPreview}
              style={{ backgroundColor: value }}
            />
          )}
        </button>
      </div>
      {isPopoverOpen && (
        <div ref={popoverRef} className={styles.popover}>
          <ChromePicker
            color={value || '#000000'}
            onChange={handleColorChange}
            disableAlpha={false}
          />
        </div>
      )}
    </div>
  )
}
