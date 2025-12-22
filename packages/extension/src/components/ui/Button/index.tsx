import React from 'react'

import styles from './styles.module.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'light' | 'dark' | 'black'
  children: React.ReactNode
  disabled?: boolean
  asIcon?: boolean
  style?: React.CSSProperties
}

export default function Button({
  variant = 'solid',
  size = 'md',
  color = 'primary',
  children,
  disabled = false,
  asIcon = false,
  style,
  className,
  ...props
}: ButtonProps) {
  const classNames = `${styles.button} ${styles[variant]} ${styles[size]} ${
    styles[color]
  } ${asIcon ? styles.icon : ''} ${className || ''}`
  return (
    <button disabled={disabled} className={classNames} style={style} {...props}>
      {children}
    </button>
  )
}
