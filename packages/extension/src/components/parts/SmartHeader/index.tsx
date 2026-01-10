import { Bookmark, ChevronDown, Library, LogOut, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'

import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function SmartHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { logout } = useQueryAuth()

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

  const openPage = (page: 'settings' | 'bookmarks') => {
    let url: string = '/settings.html'
    if (page === 'bookmarks') {
      url = '/app.html'
    }

    const runtime =
      (typeof chrome !== 'undefined' && chrome.runtime) ||
      (typeof browser !== 'undefined' && browser.runtime)

    if (!runtime) {
      console.error('Browser runtime not available')
      return
    }

    const pageUrl = runtime.getURL(url as any)
    // Get current window to open tab in same window (important for incognito)
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
        const windowId = currentTabs?.[0]?.windowId
        chrome.tabs.create({ url: pageUrl, ...(windowId ? { windowId } : {}) })
      })
    } else if (typeof browser !== 'undefined' && browser.tabs?.create) {
      browser.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
        const windowId = currentTabs?.[0]?.windowId
        browser.tabs.create({ url: pageUrl, ...(windowId ? { windowId } : {}) })
      })
    } else {
      window.open(pageUrl, '_blank')
    }
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
        <div className={styles.logo}>
          <Library strokeWidth={2} size={24} />
        </div>
        <Text as='span' size='3' weight='medium'>
          LockMark
        </Text>
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
          onClick={() => handleMenuItemClick(() => openPage('bookmarks'))}
        >
          <Bookmark strokeWidth={1.5} size={18} />
          <span>Bookmarks</span>
        </button>
        {/* <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => {})}
        >
          <FolderOpen strokeWidth={1.5} size={18} />
          <span>Collections</span>
        </button> */}
        {/* <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => {})}
        >
          <Tags strokeWidth={1.5} size={18} />
          <span>Tags</span>
        </button> */}
        <button
          className={styles.menuItem}
          role='menuitem'
          onClick={() => handleMenuItemClick(() => openPage('settings'))}
        >
          <Settings strokeWidth={1.5} size={18} />
          <span>Settings</span>
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
