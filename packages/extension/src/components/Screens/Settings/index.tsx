import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarkExport } from '@/components/hooks/useBookmarkExport'
import { useBookmarkImport } from '@/components/hooks/useBookmarkImport'
import { useBookmarks } from '@/components/hooks/useBookmarks'

import Header from '@/components/parts/Header'
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
}

const DEFAULT_FIELDS: SettingsFields = {
  showHiddenTags: false,
  apiUrl: '',
  autoLockTimeout: '20min'
}

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings()
  const { flash, setFlash } = useNavigation()
  const { isAuthenticated } = useAuthSession()

  const [fields, setFields] = useState<SettingsFields>(DEFAULT_FIELDS)
  const [originalFields, setOriginalFields] =
    useState<SettingsFields>(DEFAULT_FIELDS)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('api')

  const [createFolderTags, setCreateFolderTags] = useState(true)
  const [importDuplicates, setImportDuplicates] = useState(false)

  const { importFile, setImportFile, isImporting, handleImport } =
    useBookmarkImport({
      createFolderTags,
      importDuplicates
    })

  const {
    isExporting,
    exportWithTags,
    setExportWithTags,
    duplicateToAllTags,
    setDuplicateToAllTags,
    handleExport
  } = useBookmarkExport()

  const { bookmarks } = useBookmarks()

  useEffect(() => {
    if (!isLoading) {
      const loadedFields: SettingsFields = {
        showHiddenTags: settings.showHiddenTags,
        apiUrl: settings.apiUrl,
        autoLockTimeout:
          (settings.autoLockTimeout as AutoLockTimeout) || '20min'
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
        autoLockTimeout: fields.autoLockTimeout
      })
      setOriginalFields({ ...fields })
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSaving(false)
    }
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
              <form onSubmit={handleSaveSettings} className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    Auto-lock Timeout
                  </Text>
                  <Select
                    value={fields.autoLockTimeout}
                    onChange={(e) =>
                      updateField(
                        'autoLockTimeout',
                        e.target.value as AutoLockTimeout
                      )
                    }
                  >
                    <option value='1min'>1 minute</option>
                    <option value='2min'>2 minutes</option>
                    <option value='5min'>5 minutes</option>
                    <option value='10min'>10 minutes</option>
                    <option value='20min'>20 minutes</option>
                    <option value='30min'>30 minutes</option>
                    <option value='1h'>1 hour</option>
                    <option value='never'>Never</option>
                  </Select>
                  <Text size='2' color='light'>
                    Automatically lock the vault after inactivity
                  </Text>
                </div>

                <div className={styles.field}>
                  <Text as='label' size='2'>
                    <Checkbox
                      checked={fields.showHiddenTags}
                      onChange={(e) =>
                        updateField('showHiddenTags', e.target.checked)
                      }
                      label='Display hidden tags'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Show tags marked as hidden in tag lists and include
                    bookmarks with hidden tags in results
                  </Text>
                </div>

                <SettingsActions
                  hasChanged={hasChanged}
                  isSaving={isSaving}
                  onCancel={handleCancel}
                />
              </form>
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
                      checked={createFolderTags}
                      onChange={(e) => setCreateFolderTags(e.target.checked)}
                      label='Create tags from folder structure'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Each folder in the bookmark file will be created as a tag
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
                      checked={exportWithTags}
                      onChange={(e) => setExportWithTags(e.target.checked)}
                      label='Include tags as folders'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Organize bookmarks into folders based on their tags
                  </Text>
                </div>

                {exportWithTags && (
                  <div className={styles.field}>
                    <Text as='label' size='2'>
                      <Checkbox
                        checked={duplicateToAllTags}
                        onChange={(e) =>
                          setDuplicateToAllTags(e.target.checked)
                        }
                        label='Duplicate bookmarks to all tag folders'
                      />
                    </Text>
                    <Text size='2' color='light'>
                      When enabled, bookmarks with multiple tags will appear in
                      each tag's folder. When disabled, bookmarks will only
                      appear in their first tag's folder.
                    </Text>
                  </div>
                )}

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
