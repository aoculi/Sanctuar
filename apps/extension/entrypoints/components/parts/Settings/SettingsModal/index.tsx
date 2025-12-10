import { useEffect, useState } from 'react'

import { useNavigation } from '@/entrypoints/components/hooks/useNavigation'
import {
  settingsStore,
  type AutoLockTimeout
} from '@/entrypoints/store/settings'

import Button from '@/entrypoints/components/ui/Button'
import { Checkbox } from '@/entrypoints/components/ui/Checkbox'
import { Drawer } from '@/entrypoints/components/ui/Drawer'
import Input from '@/entrypoints/components/ui/Input'
import Select from '@/entrypoints/components/ui/Select'
import Text from '@/entrypoints/components/ui/Text'

import styles from './styles.module.css'

export const SettingsModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) => {
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
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { setFlash } = useNavigation()

  // Load settings when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadSettings = async () => {
      setIsLoading(true)
      const currentState = await settingsStore.getState()
      setFields({
        showHiddenTags: currentState.showHiddenTags || false,
        apiUrl: currentState.apiUrl || '',
        autoLockTimeout: currentState.autoLockTimeout || '20min'
      })
      setOriginalFields({
        showHiddenTags: currentState.showHiddenTags || false,
        apiUrl: currentState.apiUrl || '',
        autoLockTimeout: currentState.autoLockTimeout || '20min'
      })
      setIsLoading(false)
    }

    loadSettings()

    // Subscribe to changes
    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState()
      setFields({
        showHiddenTags: state.showHiddenTags,
        apiUrl: state.apiUrl,
        autoLockTimeout: state.autoLockTimeout
      })
      setOriginalFields({
        showHiddenTags: state.showHiddenTags,
        apiUrl: state.apiUrl,
        autoLockTimeout: state.autoLockTimeout
      })
    })

    return unsubscribe
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFlash(null)
    try {
      await settingsStore.setSettings(fields)
      setOriginalFields({ ...fields })
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const hasChanged = JSON.stringify(fields) !== JSON.stringify(originalFields)
  const version = chrome.runtime.getManifest().version

  if (!isOpen) return null

  if (isLoading) {
    return (
      <Drawer
        title='Settings'
        description='Manage your extension settings'
        open={isOpen}
        onClose={onClose}
      >
        <Text>Loading settings...</Text>
      </Drawer>
    )
  }

  return (
    <Drawer
      title='Settings'
      description='Manage your extension settings'
      open={isOpen}
      onClose={onClose}
    >
      <div className={styles.content}>
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
              setFields((prev: any) => ({
                ...prev,
                autoLockTimeout: e.target.value
              }))
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
            />
            Display hidden tags
          </Text>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.version}>
          Version: {import.meta.env.WXT_VERSION} : {version}
        </div>
        <Button onClick={handleSubmit} disabled={!hasChanged || isSaved}>
          {isSaved ? 'Saved!' : 'Save'}
        </Button>
      </div>
    </Drawer>
  )
}
