import { KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryPin } from '@/components/hooks/queries/useQueryPin'
import usePopupSize from '@/components/hooks/usePopupSize'
import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'
import { PIN_FAILED_ATTEMPTS_THRESHOLD } from '@/lib/pin'
import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'

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
      navigate('/vault')
    }
  }, [unlockWithPin.isSuccess, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length === 6) {
      await unlockWithPin.mutateAsync(pin)
      if (!unlockWithPin.isError) {
        setPin('')
      }
    }
  }

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(value)
  }

  const handlePasswordLogin = async () => {
    await clearSession('hard')
    navigate('/login')
  }

  const remainingAttempts = lockState
    ? PIN_FAILED_ATTEMPTS_THRESHOLD - lockState.failedPinAttempts
    : PIN_FAILED_ATTEMPTS_THRESHOLD

  const isLocked = lockState?.isHardLocked

  return (
    <div className={styles.container}>
      <Header title='Enter PIN' />
      <div className={styles.content}>
        {isLocked ? (
          <div className={styles.lockedMessage}>
            <Text size='2' align='center'>
              Too many failed attempts. Please login with your password.
            </Text>
            <Button onClick={handlePasswordLogin} className={styles.button}>
              Login with Password
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                size='lg'
                type='password'
                inputMode='numeric'
                pattern='[0-9]*'
                placeholder='Enter 6-digit PIN'
                value={pin}
                onChange={handlePinChange}
                disabled={unlockWithPin.isPending}
                autoFocus
                className={styles.pinInput}
              >
                <KeyRound size={16} />
              </Input>

              {unlockWithPin.isError && (
                <div className={styles.error}>
                  <Text size='2'>
                    Invalid PIN. {remainingAttempts} attempt
                    {remainingAttempts !== 1 ? 's' : ''} remaining.
                  </Text>
                </div>
              )}

              <Button
                type='submit'
                disabled={pin.length !== 6 || unlockWithPin.isPending}
              >
                {unlockWithPin.isPending && (
                  <Loader2 className={styles.spinner} />
                )}
                {getButtonLabel(phase)}
              </Button>
            </form>

            <div className={styles.passwordLink}>
              <Button
                variant='ghost'
                onClick={handlePasswordLogin}
                disabled={unlockWithPin.isPending}
                color='light'
              >
                Use password instead
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
