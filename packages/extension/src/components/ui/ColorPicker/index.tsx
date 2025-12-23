import { Palette, X } from 'lucide-react'
import React, { useRef } from 'react'

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
  const colorInputRef = useRef<HTMLInputElement>(null)

  const handlePredefinedColorClick = (color: string) => {
    onChange(color)
  }

  const handleCustomColorClick = () => {
    // Trigger the native color picker
    setTimeout(() => {
      colorInputRef.current?.click()
    }, 0)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleNoColorClick = () => {
    onChange(undefined)
  }

  const isPredefinedColor = value && PREDEFINED_COLORS.includes(value)
  const hasNoColor = !value || value === null || value === undefined

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
      <input
        ref={colorInputRef}
        type='color'
        value={value || '#000000'}
        onChange={handleCustomColorChange}
        className={styles.hiddenInput}
        aria-label='Custom color picker'
      />
    </div>
  )
}
