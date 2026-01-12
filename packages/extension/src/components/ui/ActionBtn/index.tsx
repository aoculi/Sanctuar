import { LucideIcon } from 'lucide-react'
import React from 'react'

import styles from './styles.module.css'

interface ActionBtnProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  icon: LucideIcon
  label?: string
  active?: boolean
  danger?: boolean
  variant?: 'default' | 'bordered'
  size?: 'sm' | 'md' | 'lg'
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export default function ActionBtn({
  icon: Icon,
  label,
  active = false,
  danger = false,
  variant = 'default',
  size = 'md',
  onClick,
  className,
  ...props
}: ActionBtnProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.(e)
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  }

  const classNames = [
    styles.action,
    styles[`action${size.charAt(0).toUpperCase() + size.slice(1)}`],
    !label && styles.actionIcon,
    active && styles.actionActive,
    danger && styles.actionDanger,
    variant === 'bordered' && styles.actionBordered,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type='button'
      className={classNames}
      onClick={handleClick}
      {...props}
    >
      <Icon size={iconSizes[size]} strokeWidth={2} />
      {label && <span>{label}</span>}
    </button>
  )
}
