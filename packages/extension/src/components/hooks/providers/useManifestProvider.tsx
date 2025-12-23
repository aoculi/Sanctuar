import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useQueryVault } from '@/components/hooks/queries/useQueryVault'
import { STORAGE_KEYS } from '@/lib/constants'
import { getStorageItem, setStorageItem } from '@/lib/storage'
import type { ManifestV1 } from '@/lib/types'

/**
 * Manifest data stored in chrome.storage.local
 */
export type StoredManifestData = {
  manifest: ManifestV1
  etag: string | null
  serverVersion: number
}

/**
 * Load manifest data from storage
 */
export async function loadManifestData(): Promise<StoredManifestData | null> {
  const stored = await getStorageItem<StoredManifestData>(STORAGE_KEYS.MANIFEST)
  if (stored?.manifest) {
    return stored
  }

  // Backwards compatibility: check for old separate storage format
  const oldManifest = await getStorageItem<ManifestV1>(STORAGE_KEYS.MANIFEST)
  if (oldManifest && 'items' in oldManifest) {
    const oldMeta = await getStorageItem<{ etag: string; version: number }>(
      'manifest_meta'
    ).catch(() => null)
    return {
      manifest: oldManifest,
      etag: oldMeta?.etag ?? null,
      serverVersion: oldMeta?.version ?? oldManifest.version ?? 0
    }
  }

  return null
}

/**
 * Save manifest data to storage
 */
export async function saveManifestData(
  data: StoredManifestData
): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MANIFEST, data)
}

type ManifestContextType = {
  manifest: ManifestV1 | null
  isLoading: boolean
  isSaving: boolean
  save: (updatedManifest: ManifestV1) => Promise<{
    manifest: ManifestV1
    etag: string
    version: number
  }>
  reload: () => Promise<void>
  setManifestFromLogin: (data: StoredManifestData) => void
}

const ManifestContext = createContext<ManifestContextType | null>(null)

/**
 * Hook to use the manifest context
 * Must be used within a ManifestProvider
 */
export function useManifest() {
  const context = useContext(ManifestContext)
  if (!context) {
    throw new Error('useManifest must be used within a ManifestProvider')
  }
  return context
}

type ManifestProviderProps = {
  children: ReactNode
}

/**
 * Manifest Provider Component
 * Shares manifest state across all components
 */
export function ManifestProvider({ children }: ManifestProviderProps) {
  const { saveManifest: saveManifestMutation } = useQueryVault()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthSession()

  const [manifest, setManifest] = useState<ManifestV1 | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [serverVersion, setServerVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Load manifest function
  const loadManifest = useCallback(async () => {
    try {
      const data = await loadManifestData()
      if (data) {
        setManifest(data.manifest)
        setEtag(data.etag)
        setServerVersion(data.serverVersion)
      } else {
        // Clear state if no manifest found
        setManifest(null)
        setEtag(null)
        setServerVersion(0)
      }
    } catch (error) {
      console.error('Failed to load manifest from storage:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load manifest on mount
  useEffect(() => {
    loadManifest()
  }, [loadManifest])

  // Clear manifest when user logs out
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setManifest(null)
      setEtag(null)
      setServerVersion(0)
    }
  }, [isAuthenticated, isAuthLoading])

  /**
   * Save an updated manifest to server and storage
   */
  const save = useCallback(
    async (updatedManifest: ManifestV1) => {
      if (!manifest) {
        throw new Error('Cannot save: manifest not loaded')
      }

      const result = await saveManifestMutation.mutateAsync({
        manifest: updatedManifest,
        etag,
        serverVersion,
        baseSnapshot: manifest
      })

      // Update storage
      try {
        await saveManifestData({
          manifest: result.manifest,
          etag: result.etag,
          serverVersion: result.version
        })
      } catch (error) {
        console.error('Failed to save manifest to local storage:', error)
      }

      // Update shared state - all consumers will re-render
      setManifest({ ...result.manifest })
      setEtag(result.etag)
      setServerVersion(result.version)

      return result
    },
    [manifest, etag, serverVersion, saveManifestMutation]
  )

  /**
   * Reload manifest from storage
   */
  const reload = useCallback(async () => {
    await loadManifest()
  }, [loadManifest])

  /**
   * Set manifest directly from login flow
   * This avoids race conditions with storage polling
   */
  const setManifestFromLogin = useCallback((data: StoredManifestData) => {
    setManifest(data.manifest)
    setEtag(data.etag)
    setServerVersion(data.serverVersion)
    setIsLoading(false)
  }, [])

  const contextValue: ManifestContextType = {
    manifest,
    isLoading,
    isSaving: saveManifestMutation.isPending,
    save,
    reload,
    setManifestFromLogin
  }

  return (
    <ManifestContext.Provider value={contextValue}>
      {children}
    </ManifestContext.Provider>
  )
}
