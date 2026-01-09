import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { PinVerifyModal } from '@/components/parts/pin/PinVerifyModal'
import { STORAGE_KEYS } from '@/lib/constants'
import { verifyPin } from '@/lib/pin'
import { getStorageItem, type PinStoreData } from '@/lib/storage'

import styles from './styles.module.css'

export default function HiddenToggle() {
  const { settings, updateSettings } = useSettings()
  const [showPinVerifyModal, setShowPinVerifyModal] = useState(false)
  const [hasPinConfigured, setHasPinConfigured] = useState(false)

  // Check if PIN store exists
  useEffect(() => {
    const checkPinStore = async () => {
      const pinStore = await getStorageItem<PinStoreData>(
        STORAGE_KEYS.PIN_STORE
      )
      setHasPinConfigured(!!pinStore)
    }
    checkPinStore()
  }, [])

  const handleToggle = () => {
    if (settings.showHiddenTags) {
      // Hiding doesn't require PIN verification
      updateSettings({ showHiddenTags: false })
    } else {
      // Showing requires PIN verification only if PIN is configured
      if (hasPinConfigured) {
        setShowPinVerifyModal(true)
      } else {
        updateSettings({ showHiddenTags: true })
      }
    }
  }

  const handlePinVerifySuccess = async (pin: string) => {
    const pinStore = await getStorageItem<PinStoreData>(STORAGE_KEYS.PIN_STORE)
    if (!pinStore) {
      throw new Error('No PIN configured')
    }

    const isValid = await verifyPin(pin, pinStore)
    if (!isValid) {
      throw new Error('Invalid PIN')
    }

    await updateSettings({ showHiddenTags: true })
  }

  return (
    <>
      <button
        type='button'
        className={`${styles.toggle} ${settings.showHiddenTags ? styles.active : ''}`}
        onClick={handleToggle}
        title={
          settings.showHiddenTags ? 'Hide hidden items' : 'Show hidden items'
        }
      >
        {settings.showHiddenTags ? (
          <>
            <Eye size={16} strokeWidth={1.5} />
            <span>Visible</span>
          </>
        ) : (
          <>
            <EyeOff size={16} strokeWidth={1.5} />
            <span>Hidden</span>
          </>
        )}
      </button>
      <PinVerifyModal
        open={showPinVerifyModal}
        onClose={() => setShowPinVerifyModal(false)}
        onSuccess={handlePinVerifySuccess}
        description='Enter your PIN to view hidden items'
      />
    </>
  )
}
