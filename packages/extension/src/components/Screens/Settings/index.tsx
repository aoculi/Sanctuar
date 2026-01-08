import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarkExport } from '@/components/hooks/useBookmarkExport'
import { useBookmarkImport } from '@/components/hooks/useBookmarkImport'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { STORAGE_KEYS } from '@/lib/constants'
import { setupPin, verifyPin } from '@/lib/pin'
import {
  clearStorageItem,
  getApiUrl,
  getStorageItem,
  setApiUrl,
  setStorageItem,
  type PinStoreData
} from '@/lib/storage'
import type { KeystoreData } from '@/lib/unlock'

import Header from '@/components/parts/Header'
import { PinSetupModal } from '@/components/parts/pin/PinSetupModal'
import { PinVerifyModal } from '@/components/parts/pin/PinVerifyModal'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import FileInput from '@/components/ui/FileInput'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type AutoLockTimeout =
  | '1min'
  | '2min'
  | '5min'
  | '10min'
  | '20min'
  | '30min'
  | '1h'
  | 'never'

interface SettingsFields {
  showHiddenTags: boolean
  apiUrl: string
  autoLockTimeout: AutoLockTimeout
  useCodePin: boolean
}

const DEFAULT_FIELDS: SettingsFields = {
  showHiddenTags: false,
  apiUrl: '',
  autoLockTimeout: '20min',
  useCodePin: false
}

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings()
  const { flash } = useNavigation()
  const { isAuthenticated, session } = useAuthSession()

  const [fields, setFields] = useState<SettingsFields>(DEFAULT_FIELDS)
  const [originalFields, setOriginalFields] =
    useState<SettingsFields>(DEFAULT_FIELDS)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('api')
  const isSavingRef = useRef(false)

  const [preserveFolderStructure, setPreserveFolderStructure] = useState(true)
  const [importDuplicates, setImportDuplicates] = useState(false)

  const [showPinSetupModal, setShowPinSetupModal] = useState(false)
  const [showPinVerifyModal, setShowPinVerifyModal] = useState(false)
  const [isSavingSecurity, setIsSavingSecurity] = useState(false)

  const { importFile, setImportFile, isImporting, handleImport } =
    useBookmarkImport({
      preserveFolderStructure,
      importDuplicates
    })

  const {
    isExporting,
    exportWithCollections,
    setExportWithCollections,
    hasCollections,
    handleExport
  } = useBookmarkExport()

  const { bookmarks } = useBookmarks()

  useEffect(() => {
    const loadSettings = async () => {
      // Don't reload if we're currently saving (to prevent overwriting user changes)
      if (isSavingRef.current) {
        return
      }

      if (!isLoading) {
        // Load API URL separately (global setting - always available)
        const apiUrl = await getApiUrl()

        if (isAuthenticated) {
          // Load user-specific settings when authenticated
          const loadedFields: SettingsFields = {
            showHiddenTags: settings.showHiddenTags,
            apiUrl: apiUrl,
            autoLockTimeout:
              (settings.autoLockTimeout as AutoLockTimeout) || '20min',
            useCodePin: settings.useCodePin || false
          }
          setFields(loadedFields)
          setOriginalFields(loadedFields)
        } else {
          // When not authenticated, only load API URL with defaults for other fields
          const loadedFields: SettingsFields = {
            showHiddenTags: false,
            apiUrl: apiUrl,
            autoLockTimeout: '20min',
            useCodePin: false
          }
          setFields(loadedFields)
          setOriginalFields(loadedFields)
        }
      }
    }
    loadSettings()
  }, [isLoading, settings, isAuthenticated])

  useEffect(() => {
    if (
      !isAuthenticated &&
      (activeTab === 'security' ||
        activeTab === 'import' ||
        activeTab === 'export')
    ) {
      setActiveTab('api')
    }
  }, [isAuthenticated, activeTab])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // Save API URL separately (global setting)
      await setApiUrl(fields.apiUrl)

      // Save user-specific settings (without apiUrl)
      await updateSettings({
        showHiddenTags: fields.showHiddenTags,
        autoLockTimeout: fields.autoLockTimeout,
        useCodePin: fields.useCodePin
      })
      setOriginalFields({ ...fields })
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePinSetup = async (pin: string) => {
    try {
      // Verify user is unlocked
      const keystoreData = await getStorageItem<KeystoreData>(
        STORAGE_KEYS.KEYSTORE
      )
      if (!keystoreData) {
        throw new Error('Vault not unlocked. Please ensure you are logged in.')
      }

      if (!session.userId) {
        throw new Error('No user session found')
      }

      // Get vaultId from keystore AAD context
      const vaultId = keystoreData.aadContext.vaultId

      // Create PIN store
      const pinStore = await setupPin(
        pin,
        keystoreData,
        session.userId,
        vaultId
      )
      await setStorageItem(STORAGE_KEYS.PIN_STORE, pinStore)

      // Adjust auto-lock timeout if needed
      const newTimeout =
        fields.autoLockTimeout === 'never' ? '20min' : fields.autoLockTimeout

      // Update fields state
      const updatedFields = {
        ...fields,
        useCodePin: true,
        autoLockTimeout: newTimeout
      }
      setFields(updatedFields)

      // Save settings using current settings from context, not fields state
      const settingsToSave = {
        showHiddenTags: settings.showHiddenTags,
        autoLockTimeout: newTimeout,
        useCodePin: true
      }

      await updateSettings(settingsToSave)

      setShowPinSetupModal(false)
    } catch (error) {
      console.error('[Settings] PIN setup error:', error)
      throw error instanceof Error ? error : new Error('Failed to setup PIN')
    }
  }

  const handlePinVerifySuccess = async (pin: string) => {
    // Get PIN store
    const pinStore = await getStorageItem<PinStoreData>(STORAGE_KEYS.PIN_STORE)
    if (!pinStore) {
      throw new Error('No PIN configured')
    }

    // Verify PIN
    const isValid = await verifyPin(pin, pinStore)
    if (!isValid) {
      throw new Error('Invalid PIN')
    }

    // PIN is valid, disable PIN mode
    const newFields = {
      ...fields,
      useCodePin: false,
      autoLockTimeout: 'never' as AutoLockTimeout
    }
    setFields(newFields)

    // Remove PIN store from storage
    await clearStorageItem(STORAGE_KEYS.PIN_STORE)

    // Save settings - only pass Settings properties, not fields (which includes apiUrl)
    await updateSettings({
      showHiddenTags: settings.showHiddenTags,
      autoLockTimeout: 'never',
      useCodePin: false
    })

    setOriginalFields(newFields)

    // Close modal
    setShowPinVerifyModal(false)
  }

  const handlePinVerifyClose = () => {
    setShowPinVerifyModal(false)
    // Checkbox should remain checked if verification was cancelled
  }

  const handlePinSetupClose = () => {
    setShowPinSetupModal(false)
    // If setup was cancelled, ensure checkbox remains unchecked
    if (!fields.useCodePin) {
      setFields((prev) => ({ ...prev, useCodePin: false }))
    }
  }

  const handleUseCodePinChange = (checked: boolean) => {
    if (!checked && fields.useCodePin) {
      // Require PIN verification to disable PIN mode
      // Don't update checkbox state yet - wait for verification
      setShowPinVerifyModal(true)
    } else if (checked) {
      // Always show PIN setup modal when enabling PIN mode
      // Don't update checkbox state yet - wait for setup to complete
      setShowPinSetupModal(true)
    }
  }

  const saveSecuritySettings = async (
    useCodePin?: boolean,
    autoLockTimeout?: string
  ) => {
    setIsSavingSecurity(true)
    isSavingRef.current = true
    try {
      // Use current settings from context for all values to ensure consistency
      const settingsToSave = {
        showHiddenTags: settings.showHiddenTags,
        autoLockTimeout: autoLockTimeout || settings.autoLockTimeout || '20min',
        useCodePin:
          useCodePin !== undefined ? useCodePin : settings.useCodePin || false
      }

      await updateSettings(settingsToSave)

      // Update local fields to match what was saved
      setFields((prev) => ({
        ...prev,
        autoLockTimeout: settingsToSave.autoLockTimeout as AutoLockTimeout,
        useCodePin: settingsToSave.useCodePin
      }))

      // Update originalFields after successful save
      setOriginalFields((prev) => ({
        ...prev,
        autoLockTimeout: settingsToSave.autoLockTimeout as AutoLockTimeout,
        useCodePin: settingsToSave.useCodePin
      }))
    } catch (error) {
      console.error('[Settings] Error saving settings:', error)
    } finally {
      setIsSavingSecurity(false)
      // Allow useEffect to run again after a short delay
      setTimeout(() => {
        isSavingRef.current = false
      }, 100)
    }
  }

  const handleAutoLockTimeoutChange = async (timeout: AutoLockTimeout) => {
    // Update local state first
    updateField('autoLockTimeout', timeout)
    // Save to storage using the new timeout value
    await saveSecuritySettings(undefined, timeout)
  }

  const handleShowHiddenTagsChange = async (checked: boolean) => {
    updateField('showHiddenTags', checked)
    await saveSecuritySettings()
  }

  const handleCancel = () => {
    window.close()
  }

  const updateField = <K extends keyof SettingsFields>(
    key: K,
    value: SettingsFields[K]
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const hasChanged = JSON.stringify(fields) !== JSON.stringify(originalFields)
  const version = chrome.runtime.getManifest().version

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Header title='Settings' canShowMenu={false} />
        <div className={styles.content}>
          <Text>Loading settings...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {flash && (
        <div className={styles.flash}>
          <TriangleAlert size={16} color='white' />
          <Text size='2' weight='regular' color='white'>
            {flash}
          </Text>
        </div>
      )}
      <div className={styles.container}>
        <Header title='Settings' canShowMenu={false} />
        <div className={styles.version}>
          Version: {import.meta.env.WXT_VERSION} : {version}
        </div>
        <div className={styles.content}>
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value='api'>API</Tabs.Trigger>
              <Tabs.Trigger value='security' disabled={!isAuthenticated}>
                Security
              </Tabs.Trigger>
              <Tabs.Trigger value='import' disabled={!isAuthenticated}>
                Import
              </Tabs.Trigger>
              <Tabs.Trigger value='export' disabled={!isAuthenticated}>
                Export
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value='api'>
              <form onSubmit={handleSaveSettings} className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    API Base URL
                  </Text>
                  <Input
                    type='url'
                    placeholder='http://127.0.0.1:3500'
                    value={fields.apiUrl}
                    onChange={(e) => updateField('apiUrl', e.target.value)}
                  />
                  <Text size='2' color='light'>
                    The URL where your LockMark API server is running. Default
                    is http://127.0.0.1:3500 for local-first usage.
                  </Text>
                </div>

                <SettingsActions
                  hasChanged={hasChanged}
                  isSaving={isSaving}
                  onCancel={handleCancel}
                />
              </form>
            </Tabs.Content>

            <Tabs.Content value='security'>
              <div className={styles.form}>
                {isSavingSecurity && (
                  <div className={styles.savingIndicator}>
                    <Loader2 className={styles.spinner} />
                    <Text size='2' color='light'>
                      Saving...
                    </Text>
                  </div>
                )}

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={fields.useCodePin}
                      onChange={(e) => handleUseCodePinChange(e.target.checked)}
                      disabled={isSavingSecurity}
                      label='Use PIN code (6 digits)'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    {fields.useCodePin
                      ? 'Use a 6-digit PIN to quickly unlock after auto-lock timeout.'
                      : 'Vault will never auto-lock. Close and reopen without re-entering password.'}
                  </Text>
                </div>

                {fields.useCodePin && (
                  <div className={styles.field}>
                    <Text as='label' size='3' weight='medium'>
                      Auto-lock Timeout
                    </Text>
                    <Select
                      value={fields.autoLockTimeout}
                      onChange={(e) =>
                        handleAutoLockTimeoutChange(
                          e.target.value as AutoLockTimeout
                        )
                      }
                      disabled={isSavingSecurity}
                    >
                      <option value='1min'>1 minute</option>
                      <option value='2min'>2 minutes</option>
                      <option value='5min'>5 minutes</option>
                      <option value='10min'>10 minutes</option>
                      <option value='20min'>20 minutes</option>
                      <option value='30min'>30 minutes</option>
                      <option value='1h'>1 hour</option>
                    </Select>
                    <Text size='2' color='light'>
                      Automatically lock the vault after inactivity
                    </Text>
                  </div>
                )}

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={fields.showHiddenTags}
                      onChange={(e) =>
                        handleShowHiddenTagsChange(e.target.checked)
                      }
                      disabled={isSavingSecurity}
                      label='Display hidden tags'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Show tags marked as hidden in tag lists and include
                    bookmarks with hidden tags in results
                  </Text>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value='import'>
              <div className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    Import Bookmarks
                  </Text>
                  <Text size='2' color='light'>
                    Import bookmarks from Chrome or Firefox export files
                  </Text>
                </div>

                <div className={styles.field}>
                  <FileInput
                    label='Bookmark File'
                    accept='.html,.json,text/html,application/json'
                    value={importFile}
                    onChange={setImportFile}
                    disabled={isImporting}
                    description='Select a bookmark export file (.html or .json) from Chrome or Firefox'
                  />
                </div>

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={preserveFolderStructure}
                      onChange={(e) =>
                        setPreserveFolderStructure(e.target.checked)
                      }
                      label='Preserve folder structure as Collections'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Each folder will be created as a tag and a Collection with
                    the same name, preserving the original hierarchy
                  </Text>
                </div>

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={importDuplicates}
                      onChange={(e) => setImportDuplicates(e.target.checked)}
                      label='Import duplicate bookmarks'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    When enabled, bookmarks with URLs that already exist will be
                    imported. When disabled, duplicates will be skipped.
                  </Text>
                </div>

                <div className={styles.actionsContainer}>
                  <div className={styles.actions}>
                    <Button
                      onClick={handleCancel}
                      color='black'
                      disabled={isImporting}
                    >
                      Cancel
                    </Button>

                    <Button
                      onClick={handleImport}
                      disabled={!importFile || isImporting}
                    >
                      {isImporting && <Loader2 className={styles.spinner} />}
                      {isImporting ? 'Importing...' : 'Import Bookmarks'}
                    </Button>
                  </div>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value='export'>
              <div className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    Export Bookmarks
                  </Text>
                  <Text size='2' color='light'>
                    Export your bookmarks to an HTML file compatible with Chrome
                    and Firefox
                  </Text>
                </div>

                <div className={styles.field}>
                  <Text size='2' color='light'>
                    {bookmarks.length === 0
                      ? 'No bookmarks to export'
                      : `Ready to export ${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}`}
                  </Text>
                </div>

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={exportWithCollections}
                      onChange={(e) =>
                        setExportWithCollections(e.target.checked)
                      }
                      disabled={!hasCollections}
                      label='Export with Collections as folders'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    {hasCollections
                      ? 'Organize bookmarks into folders based on your Collections hierarchy'
                      : 'No Collections available. Create Collections to enable folder export.'}
                  </Text>
                </div>

                <div className={styles.actionsContainer}>
                  <div className={styles.actions}>
                    <Button
                      onClick={handleCancel}
                      color='black'
                      disabled={isExporting}
                    >
                      Cancel
                    </Button>

                    <Button
                      onClick={handleExport}
                      disabled={bookmarks.length === 0 || isExporting}
                    >
                      {isExporting && <Loader2 className={styles.spinner} />}
                      {isExporting ? 'Exporting...' : 'Export Bookmarks'}
                    </Button>
                  </div>
                </div>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>

      <PinSetupModal
        open={showPinSetupModal}
        onClose={handlePinSetupClose}
        onSuccess={handlePinSetup}
      />

      <PinVerifyModal
        open={showPinVerifyModal}
        onClose={handlePinVerifyClose}
        onSuccess={handlePinVerifySuccess}
      />
    </div>
  )
}

interface SettingsActionsProps {
  hasChanged: boolean
  isSaving: boolean
  onCancel: () => void
}

function SettingsActions({
  hasChanged,
  isSaving,
  onCancel
}: SettingsActionsProps) {
  return (
    <div className={styles.actionsContainer}>
      <div className={styles.actions}>
        <Button onClick={onCancel} color='black'>
          Cancel
        </Button>

        <Button type='submit' disabled={!hasChanged || isSaving}>
          {isSaving && <Loader2 className={styles.spinner} />}
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
