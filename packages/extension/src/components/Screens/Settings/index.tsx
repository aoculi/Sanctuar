import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import {
  loadManifestData,
  useManifest
} from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import FileInput from '@/components/ui/FileInput'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import Text from '@/components/ui/Text'

import {
  mapFolderPathsToTagIds,
  processBookmarkFile
} from '@/lib/bookmarkImport'

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

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings()
  const { flash, setFlash } = useNavigation()
  const { addBookmarks } = useBookmarks()
  const { tags, createTag } = useTags()
  const { manifest, reload: reloadManifest } = useManifest()
  const { isAuthenticated } = useAuthSession()

  const [fields, setFields] = useState({
    showHiddenTags: false,
    apiUrl: '',
    autoLockTimeout: '20min' as AutoLockTimeout
  })
  const [originalFields, setOriginalFields] = useState({
    showHiddenTags: false,
    apiUrl: '',
    autoLockTimeout: '20min' as AutoLockTimeout
  })
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('api')

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [createFolderTags, setCreateFolderTags] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  // Sync fields when settings load
  useEffect(() => {
    if (!isLoading) {
      setFields({
        showHiddenTags: settings.showHiddenTags,
        apiUrl: settings.apiUrl,
        autoLockTimeout:
          (settings.autoLockTimeout as AutoLockTimeout) || '20min'
      })
      setOriginalFields({
        showHiddenTags: settings.showHiddenTags,
        apiUrl: settings.apiUrl,
        autoLockTimeout:
          (settings.autoLockTimeout as AutoLockTimeout) || '20min'
      })
    }
  }, [isLoading, settings])

  const handleApiSubmit = async (e: React.FormEvent) => {
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

  const handleSecuritySubmit = async (e: React.FormEvent) => {
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

  const hasChanged = JSON.stringify(fields) !== JSON.stringify(originalFields)
  const version = chrome.runtime.getManifest().version

  // Switch to API tab if user is on a locked tab and becomes unauthenticated
  useEffect(() => {
    if (
      !isAuthenticated &&
      (activeTab === 'security' || activeTab === 'import-export')
    ) {
      setActiveTab('api')
    }
  }, [isAuthenticated, activeTab])

  const handleImport = async () => {
    if (!importFile) {
      setFlash('Please select a bookmark file')
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportSuccess(null)
    setFlash(null)

    try {
      const result = await processBookmarkFile(
        importFile,
        createFolderTags,
        tags
      )

      if (result.errors.length > 0) {
        console.warn('Import warnings:', result.errors)
      }

      if (result.bookmarksWithPaths.length === 0) {
        setFlash('No valid bookmarks found in the file')
        setIsImporting(false)
        return
      }

      if (result.tagsToCreate.length > 0) {
        for (const tagToCreate of result.tagsToCreate) {
          try {
            await createTag(tagToCreate)
          } catch (error) {
            console.error(`Error creating tag "${tagToCreate.name}":`, error)
          }
        }
      }

      await reloadManifest()

      const latestManifestData = await loadManifestData()
      const updatedTags =
        latestManifestData?.manifest.tags || manifest?.tags || []

      let updatedBookmarks
      if (createFolderTags) {
        updatedBookmarks = mapFolderPathsToTagIds(
          result.bookmarksWithPaths,
          updatedTags
        )
      } else {
        updatedBookmarks = result.bookmarksWithPaths.map(
          ({ bookmark }) => bookmark
        )
      }

      // Add all bookmarks in a single batch operation to avoid version conflicts
      try {
        await addBookmarks(updatedBookmarks)
        const successMessage = `Successfully imported ${updatedBookmarks.length} bookmark${updatedBookmarks.length !== 1 ? 's' : ''}`
        setFlash(successMessage)
        setImportFile(null)
      } catch (error) {
        const errorMessage = `Failed to import bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`
        setFlash(errorMessage)
        throw error
      }
    } catch (error) {
      const errorMessage = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      setFlash(errorMessage)
    } finally {
      setIsImporting(false)
    }
  }

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

  const handleCancel = () => {
    window.close()
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
              <Tabs.Trigger value='import-export' disabled={!isAuthenticated}>
                Import/export
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value='api'>
              <form onSubmit={handleApiSubmit} className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    API Base URL
                  </Text>
                  <Input
                    type='url'
                    placeholder='http://127.0.0.1:3500'
                    value={fields.apiUrl}
                    onChange={(e) =>
                      setFields({ ...fields, apiUrl: e.target.value })
                    }
                  />
                  <Text size='2' color='light'>
                    The URL where your LockMark API server is running. Default
                    is http://127.0.0.1:3500 for local-first usage.
                  </Text>
                </div>

                <div className={styles.actionsContainer}>
                  <div className={styles.actions}>
                    <Button onClick={handleCancel} color='black'>
                      Cancel
                    </Button>

                    <Button type='submit' disabled={!hasChanged || isSaving}>
                      {isSaving && <Loader2 className={styles.spinner} />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </form>
            </Tabs.Content>

            <Tabs.Content value='security'>
              <form onSubmit={handleSecuritySubmit} className={styles.form}>
                <div className={styles.field}>
                  <Text as='label' size='3' weight='medium'>
                    Auto-lock Timeout
                  </Text>
                  <Select
                    value={fields.autoLockTimeout}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        autoLockTimeout: e.target.value as AutoLockTimeout
                      })
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
                        setFields({
                          ...fields,
                          showHiddenTags: e.target.checked
                        })
                      }
                      label='Display hidden tags'
                    />
                  </Text>
                  <Text size='2' color='light'>
                    Show tags marked as hidden in tag lists and include
                    bookmarks with hidden tags in results
                  </Text>
                </div>

                <div className={styles.actionsContainer}>
                  <div className={styles.actions}>
                    <Button onClick={handleCancel} color='black'>
                      Cancel
                    </Button>

                    <Button type='submit' disabled={!hasChanged || isSaving}>
                      {isSaving && <Loader2 className={styles.spinner} />}
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </form>
            </Tabs.Content>

            <Tabs.Content value='import-export'>
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
                    error={importError || undefined}
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

                {importSuccess && (
                  <div className={styles.successMessage}>
                    <Text size='2' color='light'>
                      {importSuccess}
                    </Text>
                  </div>
                )}

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
          </Tabs.Root>
        </div>
      </div>
    </div>
  )
}
