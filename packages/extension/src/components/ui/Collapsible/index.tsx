import { ChevronRight, LucideIcon } from 'lucide-react'
import { useState } from 'react'

import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface CollapsibleProps {
  icon: LucideIcon
  label: string | React.ReactNode
  count: number
  defaultOpen?: boolean
  depth?: number
  children: React.ReactNode
  editable?: boolean
  onIconClick?: (e: React.MouseEvent) => void
}

export default function Collapsible({
  icon: Icon,
  label,
  count,
  defaultOpen = true,
  depth = 0,
  children,
  editable = false,
  onIconClick
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleHeaderClick = () => {
    if (!editable) {
      setIsOpen(!isOpen)
    }
  }

  const HeaderElement = editable ? 'div' : 'button'
  const headerProps = editable
    ? {}
    : {
        type: 'button' as const,
        onClick: handleHeaderClick,
        'aria-expanded': isOpen
      }

  return (
    <div className={styles.component}>
      <HeaderElement
        className={`${styles.header} ${!editable ? styles.headerClickable : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        {...headerProps}
      >
        <div className={styles.left}>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          />
          {onIconClick ? (
            <button
              type='button'
              className={styles.iconButton}
              onClick={onIconClick}
              title='Change icon'
            >
              <Icon size={16} strokeWidth={2} className={styles.icon} />
            </button>
          ) : (
            <Icon size={16} strokeWidth={2} className={styles.icon} />
          )}
          {typeof label === 'string' ? (
            <Text as='span' size='2' weight='medium'>
              {label}
            </Text>
          ) : (
            label
          )}
        </div>
        <div className={styles.right}>
          <div className={styles.badge}>
            <Text as='span' size='2' weight='medium'>
              {count}
            </Text>
          </div>
        </div>
      </HeaderElement>

      <div
        className={`${styles.content} ${isOpen ? styles.contentOpen : ''}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  )
}
