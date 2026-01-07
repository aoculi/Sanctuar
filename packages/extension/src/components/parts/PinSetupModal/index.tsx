/**
 * Modal for setting up a new PIN
 * 2-step process: PIN → Confirm PIN
 */

import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'

import Button from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

type SetupStep = 'pin' | 'confirm'

interface PinSetupModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (pin: string) => Promise<void>
}

export function PinSetupModal({
  open,
  onClose,
  onSuccess
}: PinSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('pin')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length === 6) {
      setStep('confirm')
      setError(null)
    }
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSuccess(pin)
      handleClose()
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to setup PIN')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep('pin')
    setPin('')
    setConfirmPin('')
    setError(null)
    onClose()
  }

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('pin')
      setConfirmPin('')
      setError(null)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 'pin':
        return (
          <form onSubmit={handlePinSubmit} className={styles.form}>
            <Text size='2' color='light'>
              Enter a 6-digit PIN to protect your vault
            </Text>
            <Input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='000000'
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              autoFocus
              className={styles.pinInput}
            >
              <KeyRound size={16} />
            </Input>
            <Button
              type='submit'
              disabled={pin.length !== 6}
              className={styles.button}
            >
              Continue
            </Button>
          </form>
        )

      case 'confirm':
        return (
          <form onSubmit={handleConfirmSubmit} className={styles.form}>
            <Text size='2' color='light'>
              Confirm your PIN
            </Text>
            <Input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='000000'
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                // Clear error when user types
                if (error) setError(null)
              }}
              autoFocus
              className={styles.pinInput}
            >
              <KeyRound size={16} />
            </Input>
            {error && (
              <div className={styles.error}>
                <Text size='2'>{error}</Text>
              </div>
            )}
            <div className={styles.actions}>
              <Button
                variant='ghost'
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type='submit'
                disabled={confirmPin.length !== 6 || isSubmitting}
              >
                {isSubmitting && <Loader2 className={styles.spinner} />}
                {isSubmitting ? 'Setting up...' : 'Setup PIN'}
              </Button>
            </div>
          </form>
        )
    }
  }

  return (
    <Drawer
      open={open}
      title='Setup PIN'
      description='Create a 6-digit PIN to quickly unlock your vault'
      width={400}
      onClose={handleClose}
    >
      <div className={styles.container}>{renderStep()}</div>
    </Drawer>
  )
}
