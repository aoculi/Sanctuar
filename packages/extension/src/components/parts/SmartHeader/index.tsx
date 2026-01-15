import {
  Bookmark,
  ChevronDown,
  HelpCircle,
  LogOut,
  Settings,
  Tag
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'

import Logo from '@/components/ui/Logo'

import styles from './styles.module.css'

export default function SmartHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { logout } = useQueryAuth()
  const { navigate } = useNavigation()

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node) &&
      triggerRef.current &&
      !triggerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false)
    }
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    },
    [isOpen]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClickOutside])

  const handleMenuItemClick = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <div className={styles.component}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup='menu'
      >
        <Logo />
        <ChevronDown
          strokeWidth={2}
          size={16}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      <div
        ref={menuRef}
        className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}
        role='menu'
      >
        <div className={styles.shortcutHint}>
          <span>Open with</span>
          <kbd className={styles.shortcutKey}>Ctrl</kbd>
          <span>+</span>
          <kbd className={styles.shortcutKey}>Space</kbd>
        </div>
        <div className={styles.version}>
          <span>Version {chrome.runtime.getManifest().version}</span>
        </div>
        <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => navigate('/app'))}
        >
          <Bookmark strokeWidth={1.5} size={18} />
          <span>Bookmarks</span>
        </button>
        <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => navigate('/tags'))}
        >
          <Tag strokeWidth={1.5} size={18} />
          <span>Tags</span>
        </button>
        <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => navigate('/settings'))}
        >
          <Settings strokeWidth={1.5} size={18} />
          <span>Settings</span>
        </button>
        <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => navigate('/help'))}
        >
          <HelpCircle strokeWidth={1.5} size={18} />
          <span>Help</span>
        </button>
        <div className={styles.separator} />
        <button
          className={`${styles.menuItem} `}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => logout.mutate())}
        >
          <LogOut strokeWidth={1.5} size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}
