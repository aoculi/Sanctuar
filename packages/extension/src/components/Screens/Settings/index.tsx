import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarkExport } from '@/components/hooks/useBookmarkExport'
import { useBookmarkImport } from '@/components/hooks/useBookmarkImport'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { PinSetupModal } from '@/components/parts/PinSetupModal'
import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Drawer } from '@/components/ui/Drawer'
import FileInput from '@/components/ui/FileInput'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import Text from '@/components/ui/Text'
import { KeyRound } from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/constants'
import { setupPin, verifyPin } from '@/lib/pin'
import type { KeystoreData } from '@/lib/unlock'
import {
  getStorageItem,
  setStorageItem,
  type PinStoreData
} from '@/lib/storage'

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
  unlockMethod: 'password' | 'pin'
  pinEnabled: boolean
}

const DEFAULT_FIELDS: SettingsFields = {
  showHiddenTags: false,
  apiUrl: '',
  autoLockTimeout: '20min',
  unlockMethod: 'password',
  pinEnabled: false
}

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings()
  const { flash, setFlash } = useNavigation()
  const { isAuthenticated, session } = useAuthSession()

  const [fields, setFields] = useState<SettingsFields>(DEFAULT_FIELDS)
  const [originalFields, setOriginalFields] =
    useState<SettingsFields>(DEFAULT_FIELDS)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('api')

  const [preserveFolderStructure, setPreserveFolderStructure] = useState(true)
  const [importDuplicates, setImportDuplicates] = useState(false)

  const [showPinSetupModal, setShowPinSetupModal] = useState(false)
  const [showPinVerifyModal, setShowPinVerifyModal] = useState(false)
  const [verifyPin_pin, setVerifyPin_pin] = useState('')
  const [verifyPin_error, setVerifyPin_error] = useState<string | null>(null)
  const [verifyPin_isVerifying, setVerifyPin_isVerifying] = useState(false)
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
    if (!isLoading) {
      const loadedFields: SettingsFields = {
        showHiddenTags: settings.showHiddenTags,
        apiUrl: settings.apiUrl,
        autoLockTimeout:
          (settings.autoLockTimeout as AutoLockTimeout) || '20min',
        unlockMethod: settings.unlockMethod || 'password',
        pinEnabled: settings.pinEnabled || false
      }
      setFields(loadedFields)
      setOriginalFields(loadedFields)
    }
  }, [isLoading, settings])

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
      await updateSettings({
        showHiddenTags: fields.showHiddenTags,
        apiUrl: fields.apiUrl,
        autoLockTimeout: fields.autoLockTimeout,
        unlockMethod: fields.unlockMethod,
        pinEnabled: fields.pinEnabled
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
      const keystoreData =
        await getStorageItem<KeystoreData>(STORAGE_KEYS.KEYSTORE)
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

      // Update fields
      updateField('unlockMethod', 'pin')
      updateField('pinEnabled', true)

      // Adjust auto-lock timeout if needed
      const newTimeout = fields.autoLockTimeout === 'never' ? '20min' : fields.autoLockTimeout
      if (fields.autoLockTimeout === 'never') {
        updateField('autoLockTimeout', newTimeout)
      }

      // Auto-save settings
      await updateSettings({
        ...fields,
        unlockMethod: 'pin',
        pinEnabled: true,
        autoLockTimeout: newTimeout
      })

      setShowPinSetupModal(false)
    } catch (error) {
      console.error('PIN setup error:', error)
      throw error instanceof Error
        ? error
        : new Error('Failed to setup PIN')
    }
  }

  const handlePinVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyPin_pin.length !== 6) return

    setVerifyPin_isVerifying(true)
    setVerifyPin_error(null)

    try {
      // Get PIN store
      const pinStore = await getStorageItem<PinStoreData>(STORAGE_KEYS.PIN_STORE)
      if (!pinStore) {
        throw new Error('No PIN configured')
      }

      // Verify PIN
      const isValid = await verifyPin(verifyPin_pin, pinStore)
      if (!isValid) {
        setVerifyPin_error('Invalid PIN')
        setVerifyPin_isVerifying(false)
        return
      }

      // PIN is valid, disable PIN mode
      const newFields = {
        ...fields,
        unlockMethod: 'password' as const,
        autoLockTimeout: 'never' as AutoLockTimeout
      }
      await updateSettings(newFields)
      setFields(newFields)
      setOriginalFields(newFields)

      // Close modal and reset
      setShowPinVerifyModal(false)
      setVerifyPin_pin('')
      setVerifyPin_error(null)
    } catch (error) {
      console.error('PIN verification error:', error)
      setVerifyPin_error(
        error instanceof Error ? error.message : 'Verification failed'
      )
    } finally {
      setVerifyPin_isVerifying(false)
    }
  }

  const handlePinVerifyClose = () => {
    setShowPinVerifyModal(false)
    setVerifyPin_pin('')
    setVerifyPin_error(null)
  }

  const handleUnlockMethodChange = (method: 'password' | 'pin') => {
    if (method === 'password' && fields.unlockMethod === 'pin' && fields.pinEnabled) {
      // Require PIN verification to disable PIN mode
      setShowPinVerifyModal(true)
    } else if (method === 'pin') {
      // Always show PIN setup modal when selecting PIN mode
      setShowPinSetupModal(true)
    }
  }

  const saveSecuritySettings = async (unlockMethod?: string, autoLockTimeout?: string) => {
    setIsSavingSecurity(true)
    try {
      await updateSettings({
        showHiddenTags: fields.showHiddenTags,
        apiUrl: fields.apiUrl,
        autoLockTimeout: autoLockTimeout || fields.autoLockTimeout,
        unlockMethod: (unlockMethod as 'password' | 'pin') || fields.unlockMethod,
        pinEnabled: fields.pinEnabled
      })
      setOriginalFields({ ...fields })
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSavingSecurity(false)
    }
  }

  const handleAutoLockTimeoutChange = async (timeout: AutoLockTimeout) => {
    updateField('autoLockTimeout', timeout)
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
                  <Text as='label' size='3' weight='medium'>
                    Unlock Method
                  </Text>

                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type='radio'
                        name='unlockMethod'
                        value='password'
                        checked={fields.unlockMethod === 'password'}
                        onChange={() => handleUnlockMethodChange('password')}
                        disabled={isSavingSecurity}
                      />
                      <Text size='2'>Always unlock</Text>
                    </label>

                    <label className={styles.radioLabel}>
                      <input
                        type='radio'
                        name='unlockMethod'
                        value='pin'
                        checked={fields.unlockMethod === 'pin'}
                        onChange={() => handleUnlockMethodChange('pin')}
                        disabled={isSavingSecurity}
                      />
                      <Text size='2'>PIN code (6 digits)</Text>
                    </label>
                  </div>

                  <Text size='2' color='light'>
                    {fields.unlockMethod === 'password'
                      ? 'Vault will never auto-lock. Close and reopen without re-entering password.'
                      : 'Use a 6-digit PIN to quickly unlock after auto-lock timeout.'}
                  </Text>
                </div>

                {fields.unlockMethod === 'pin' && (
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
        onClose={() => setShowPinSetupModal(false)}
        onSuccess={handlePinSetup}
      />

      <Drawer
        open={showPinVerifyModal}
        title='Verify PIN'
        description='Enter your PIN to disable PIN unlock'
        width={400}
        onClose={handlePinVerifyClose}
      >
        <div style={{ padding: '20px' }}>
          <form
            onSubmit={handlePinVerifySubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <Input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='000000'
              value={verifyPin_pin}
              onChange={(e) => {
                setVerifyPin_pin(e.target.value.replace(/\D/g, '').slice(0, 6))
                if (verifyPin_error) setVerifyPin_error(null)
              }}
              disabled={verifyPin_isVerifying}
              autoFocus
              style={{
                textAlign: 'center',
                fontSize: '24px',
                letterSpacing: '8px',
                fontFamily: 'monospace'
              }}
            >
              <KeyRound size={16} />
            </Input>

            {verifyPin_error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 59, 48, 0.1)',
                  border: '1px solid rgba(255, 59, 48, 0.3)',
                  borderRadius: '6px',
                  color: '#ff3b30'
                }}
              >
                <Text size='2'>{verifyPin_error}</Text>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant='ghost'
                onClick={handlePinVerifyClose}
                disabled={verifyPin_isVerifying}
                type='button'
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={verifyPin_pin.length !== 6 || verifyPin_isVerifying}
              >
                {verifyPin_isVerifying && <Loader2 style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />}
                {verifyPin_isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </form>
        </div>
      </Drawer>
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
