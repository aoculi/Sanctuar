import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryPin } from '@/components/hooks/queries/useQueryPin'
import usePopupSize from '@/components/hooks/usePopupSize'
import { PIN_FAILED_ATTEMPTS_THRESHOLD } from '@/lib/pin'

import Button from '@/components/ui/Button'
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
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const { unlockWithPin, phase, lockState } = useQueryPin()

  useEffect(() => {
    if (unlockWithPin.isSuccess) {
      navigate('/vault')
    }
  }, [unlockWithPin.isSuccess, navigate])

  useEffect(() => {
    // Auto-submit when all 6 digits are filled
    const pin = pinDigits.join('')
    if (pin.length === 6 && !unlockWithPin.isPending) {
      unlockWithPin.mutateAsync(pin).catch(() => {
        // Clear PIN on error
        setPinDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      })
    }
  }, [pinDigits, unlockWithPin])

  const handleInputChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1)

    const newDigits = [...pinDigits]
    newDigits[index] = digit
    setPinDigits(newDigits)

    // Auto-focus next input if digit was entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        const newDigits = [...pinDigits]
        newDigits[index - 1] = ''
        setPinDigits(newDigits)
        inputRefs.current[index - 1]?.focus()
      } else if (pinDigits[index]) {
        // Clear current digit
        const newDigits = [...pinDigits]
        newDigits[index] = ''
        setPinDigits(newDigits)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6)

    if (pastedData) {
      const newDigits = pastedData
        .split('')
        .concat(['', '', '', '', '', ''])
        .slice(0, 6)
      setPinDigits(newDigits)

      // Focus last filled input or first empty
      const nextIndex = Math.min(pastedData.length, 5)
      inputRefs.current[nextIndex]?.focus()
    }
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
      <div className={styles.content}>
        <div className={styles.header}>
          <Text size='6' weight='bold'>
            Unlock Lockmark
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
            <div className={styles.pinContainer}>
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type='password'
                  inputMode='numeric'
                  pattern='[0-9]'
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={unlockWithPin.isPending}
                  autoFocus={index === 0}
                  className={styles.pinDigit}
                />
              ))}
            </div>

            {unlockWithPin.isError && (
              <div className={styles.error}>
                <Text size='2'>
                  Invalid PIN. {remainingAttempts} attempt
                  {remainingAttempts !== 1 ? 's' : ''} remaining.
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
