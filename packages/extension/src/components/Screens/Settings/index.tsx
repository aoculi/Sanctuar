import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import usePopupSize from '@/components/hooks/usePopupSize'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
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

export default function Settings() {
  const { navigate } = useNavigation()
  const { isAuthenticated } = useAuthSession()
  const { settings, isLoading, updateSettings } = useSettings()
  usePopupSize('compact')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await updateSettings({
        showHiddenTags: fields.showHiddenTags,
        apiUrl: fields.apiUrl,
        autoLockTimeout: fields.autoLockTimeout
      })
      setOriginalFields({ ...fields })
      navigate(isAuthenticated ? '/vault' : '/login')
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanged = JSON.stringify(fields) !== JSON.stringify(originalFields)
  const version = chrome.runtime.getManifest().version

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Header title='Settings' />
        <div className={styles.content}>
          <Text>Loading settings...</Text>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Header title='Settings' canSwitchToVault={true} />
      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <Text as='label' size='3' weight='medium'>
              API Base URL
            </Text>
            <Input
              type='url'
              placeholder='http://127.0.0.1:3500'
              value={fields.apiUrl}
              onChange={(e) => setFields({ ...fields, apiUrl: e.target.value })}
            />
            <Text size='2' color='light'>
              Enter the base URL for the API endpoint
            </Text>
          </div>

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
                  setFields({ ...fields, showHiddenTags: e.target.checked })
                }
                label='Display hidden tags'
              />
            </Text>
          </div>

          <div className={styles.actionsContainer}>
            <div className={styles.actions}>
              <Button
                onClick={() => navigate(isAuthenticated ? '/vault' : '/login')}
                color='black'
              >
                Cancel
              </Button>

              <Button type='submit' disabled={!hasChanged || isSaving}>
                {isSaving && <Loader2 className={styles.spinner} />}
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>

            <div className={styles.version}>
              Version: {import.meta.env.WXT_VERSION} : {version}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
