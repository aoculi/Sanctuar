import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'

import { useSettings } from '@/components/hooks/providers/useSettingsProvider'

import styles from './styles.module.css'

export default function ThemeToggle() {
  const { settings, updateSettings } = useSettings()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const handleToggle = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    updateSettings({ theme: newTheme })
  }

  return (
    <button
      type='button'
      className={styles.toggle}
      onClick={handleToggle}
      title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {settings.theme === 'dark' ? (
        <>
          <Moon size={16} strokeWidth={1.5} />
          <span>Dark</span>
        </>
      ) : (
        <>
          <Sun size={16} strokeWidth={1.5} />
          <span>Light</span>
        </>
      )}
    </button>
  )
}
