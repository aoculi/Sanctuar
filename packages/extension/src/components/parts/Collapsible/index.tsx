import { ChevronRight, LucideIcon } from 'lucide-react'
import { useState } from 'react'

import Text from '@/components/ui/Text'

import styles from './styles.module.css'

interface CollapsibleProps {
  icon: LucideIcon
  label: string
  count: number
  defaultOpen?: boolean
  depth?: number
  children: React.ReactNode
}

export default function Collapsible({
  icon: Icon,
  label,
  count,
  defaultOpen = true,
  depth = 0,
  children
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={styles.component}>
      <button
        type='button'
        className={styles.header}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.left}>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          />
          <Icon size={16} strokeWidth={2} className={styles.icon} />
          <Text as='span' size='2' weight='medium'>
            {label}
          </Text>
        </div>
        <div className={styles.badge}>
          <Text as='span' size='2' weight='medium'>
            {count}
          </Text>
        </div>
      </button>

      <div
        className={`${styles.content} ${isOpen ? styles.contentOpen : ''}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  )
}
