import {
  Settings,
  getDefaultSettings,
  getSettings,
  setSettings as saveSettings
} from '@/lib/storage'
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { useAuthSession } from './useAuthSessionProvider'

type SettingsContextType = {
  settings: Settings
  isLoading: boolean
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>
}

const defaultSettings = getDefaultSettings()

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  isLoading: true,
  updateSettings: async () => {}
})

/**
 * Hook to use the settings context
 * Must be used within a SettingsProvider
 */
export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

type SettingsProviderProps = {
  children: ReactNode
}

/**
 * Settings Provider Component
 * Initializes settings from chrome.storage and provides context to children
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { session, isAuthenticated, isLoading: authLoading } = useAuthSession()
  const [settings, setSettingsState] = useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from storage when userId changes
  useEffect(() => {
    const loadSettings = async () => {
      // Wait for auth to finish loading before trying to load settings
      if (authLoading) {
        // Keep isLoading true - will run again when authLoading becomes false
        // The effect will re-run when authLoading changes to false
        return
      }

      // Auth is done loading, now we can load settings
      setIsLoading(true)

      if (!isAuthenticated || !session.userId) {
        // No user logged in, use defaults
        setSettingsState(defaultSettings)
        setIsLoading(false)
        return
      }

      try {
        const userId = session.userId
        const storedSettings = await getSettings(userId)

        if (storedSettings) {
          // User has existing settings, use them (new fields get defaults)
          setSettingsState({ ...defaultSettings, ...storedSettings })
        } else {
          // First time for this user, save defaults
          await saveSettings(defaultSettings, userId)
          setSettingsState(defaultSettings)
        }
      } catch (error) {
        console.error('[SettingsProvider] Failed to load settings:', error)
        setSettingsState(defaultSettings)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [isAuthenticated, session.userId, authLoading]) // Reload when userId changes or auth loading state changes

  // Update multiple settings at once
  const updateSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      if (!session.userId) {
        console.warn(
          '[SettingsProvider] Cannot save settings: no user logged in'
        )
        return
      }

      const updated = { ...settings, ...newSettings }
      setSettingsState(updated)
      await saveSettings(updated, session.userId)
    },
    [settings, session]
  )

  const contextValue: SettingsContextType = {
    settings,
    isLoading,
    updateSettings
  }

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  )
}
