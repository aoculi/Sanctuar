import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryPin } from '@/components/hooks/queries/useQueryPin'
import usePopupSize from '@/components/hooks/usePopupSize'
import { PIN_FAILED_ATTEMPTS_THRESHOLD } from '@/lib/pin'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import PinInput from '@/components/ui/PinInput'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

function getButtonLabel(
  phase: 'idle' | 'verifying' | 'unlocking' | 'loading'
): string {
  switch (phase) {
    case 'verifying':
      return 'Verifying...'
    case 'unlocking':
    case 'loading':
      return 'Unlocking...'
    default:
      return 'Unlock'
  }
}

export default function PinUnlock() {
  usePopupSize('compact')
  const { navigate } = useNavigation()
  const { clearSession } = useAuthSession()
  const [pin, setPin] = useState('')
  const { unlockWithPin, phase, lockState } = useQueryPin()

  useEffect(() => {
    if (unlockWithPin.isSuccess) {
      navigate('/bookmark')
    }
  }, [unlockWithPin.isSuccess, navigate])

  const handlePinComplete = (completedPin: string) => {
    if (!unlockWithPin.isPending) {
      unlockWithPin.mutateAsync(completedPin).catch(() => {
        // Clear PIN on error
        setPin('')
      })
    }
  }

  const handlePinChange = (newPin: string) => {
    setPin(newPin)
  }

  const handleLogout = async () => {
    await clearSession('hard')
    navigate('/login')
  }

  const remainingAttempts = lockState
    ? PIN_FAILED_ATTEMPTS_THRESHOLD - lockState.failedPinAttempts
    : PIN_FAILED_ATTEMPTS_THRESHOLD

  const isLocked = lockState?.isHardLocked

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.content}>
        <div className={styles.pageTitle}>
          <Text as='h1' size='3'>
            Enter PIN
          </Text>
        </div>
        {isLocked ? (
          <div className={styles.lockedMessage}>
            <Text size='2' align='center'>
              Too many failed attempts. Please logout and try again.
            </Text>
            <Button onClick={handleLogout} className={styles.button}>
              Logout
            </Button>
          </div>
        ) : (
          <>
            <PinInput
              value={pin}
              onChange={handlePinChange}
              onComplete={handlePinComplete}
              disabled={unlockWithPin.isPending}
              autoFocus
            />

            {unlockWithPin.isError && (
              <div className={styles.error}>
                <Text size='2'>
                  {unlockWithPin.error?.message === 'Invalid PIN' ? (
                    <>
                      Invalid PIN. {remainingAttempts} attempt
                      {remainingAttempts !== 1 ? 's' : ''} remaining.
                    </>
                  ) : (
                    'Unable to unlock. Please try again.'
                  )}
                </Text>
              </div>
            )}

            {unlockWithPin.isPending && (
              <div className={styles.loadingContainer}>
                <Loader2 className={styles.spinner} />
                <Text size='2' color='light'>
                  {getButtonLabel(phase)}
                </Text>
              </div>
            )}

            <div className={styles.logoutLink}>
              <Button
                variant='ghost'
                onClick={handleLogout}
                disabled={unlockWithPin.isPending}
                color='light'
              >
                Logout
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
