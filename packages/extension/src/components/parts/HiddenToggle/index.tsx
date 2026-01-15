import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useSettings } from '@/components/hooks/providers/useSettingsProvider'
import { PinVerifyModal } from '@/components/parts/pin/PinVerifyModal'
import { verifyPin } from '@/lib/pin'
import { getPinStore } from '@/lib/storage'

import styles from './styles.module.css'

export default function HiddenToggle() {
  const { settings, updateSettings } = useSettings()
  const { session } = useAuthSession()
  const [showPinVerifyModal, setShowPinVerifyModal] = useState(false)
  const [hasPinConfigured, setHasPinConfigured] = useState(false)

  // Check if PIN store exists for this user
  useEffect(() => {
    const checkPinStore = async () => {
      if (!session.userId) {
        setHasPinConfigured(false)
        return
      }
      const pinStore = await getPinStore(session.userId)
      setHasPinConfigured(!!pinStore)
    }
    checkPinStore()
  }, [session.userId])

  const handleToggle = () => {
    if (settings.showHiddenBookmarks) {
      // Hiding doesn't require PIN verification
      updateSettings({ showHiddenBookmarks: false })
    } else {
      // Showing requires PIN verification only if PIN is configured
      if (hasPinConfigured) {
        setShowPinVerifyModal(true)
      } else {
        updateSettings({ showHiddenBookmarks: true })
      }
    }
  }

  const handlePinVerifySuccess = async (pin: string) => {
    if (!session.userId) {
      throw new Error('No user session found')
    }
    const pinStore = await getPinStore(session.userId)
    if (!pinStore) {
      throw new Error('No PIN configured')
    }

    const isValid = await verifyPin(pin, pinStore)
    if (!isValid) {
      throw new Error('Invalid PIN')
    }

    await updateSettings({ showHiddenBookmarks: true })
  }

  return (
    <>
      <button
        type='button'
        className={`${styles.toggle} ${settings.showHiddenBookmarks ? styles.active : ''}`}
        onClick={handleToggle}
        title={
          settings.showHiddenBookmarks
            ? 'Hide hidden items'
            : 'Show hidden items'
        }
      >
        {settings.showHiddenBookmarks ? (
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
