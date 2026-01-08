import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import Button from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import PinInput from '@/components/ui/PinInput'
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

  const handlePinComplete = (completedPin: string) => {
    if (completedPin.length === 6) {
      setStep('confirm')
      setConfirmPin('') // Clear confirm PIN when transitioning
      setError(null)
    }
  }

  const handleConfirmComplete = async (completedPin: string) => {
    // Prevent multiple submissions
    if (isSubmitting) return

    if (pin !== completedPin) {
      setError('PINs do not match. Please try again.')
      setConfirmPin('')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSuccess(pin)
      handleClose()
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to setup PIN')
      setConfirmPin('')
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
          <div className={styles.form}>
            <Text size='2' color='light'>
              Enter a 6-digit PIN to protect your vault
            </Text>
            <PinInput
              value={pin}
              onChange={setPin}
              onComplete={handlePinComplete}
              autoFocus
            />
          </div>
        )

      case 'confirm':
        return (
          <div className={styles.form}>
            <Text size='2' color='light'>
              Confirm your PIN
            </Text>
            <PinInput
              key='confirm-pin'
              value={confirmPin}
              onChange={(newPin) => {
                setConfirmPin(newPin)
                // Clear error when user types
                if (error) setError(null)
              }}
              onComplete={handleConfirmComplete}
              disabled={isSubmitting}
              autoFocus
            />
            {error && (
              <div className={styles.error}>
                <Text size='2'>{error}</Text>
              </div>
            )}
            {isSubmitting && (
              <div className={styles.loading}>
                <Loader2 className={styles.spinner} />
                <Text size='2' color='light'>
                  Setting up...
                </Text>
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
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog
      open={open}
      title='Setup PIN'
      description='Create a 6-digit PIN to quickly unlock your vault'
      width={400}
      onClose={handleClose}
    >
      {renderStep()}
    </Dialog>
  )
}
