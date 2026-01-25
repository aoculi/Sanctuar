import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useAuthForm } from '@/components/hooks/useAuthForm'
import usePopupSize from '@/components/hooks/usePopupSize'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Input from '@/components/ui/Input'
import Text from '@/components/ui/Text'

import type { AuthPhase } from '@/components/hooks/queries/useQueryAuth'
import type { UseMutationResult } from '@tanstack/react-query'
import type { LoginResponse, RegisterResponse } from '@/api/auth-api'
import type { ApiError } from '@/lib/api'
import type { AuthFormData } from '@/components/hooks/useAuthForm'

import styles from './AuthForm.module.css'

type AuthFormProps = {
  title: string
  defaultButtonLabel: string
  linkText: string
  onLinkClick: () => void
  mutation: UseMutationResult<LoginResponse | RegisterResponse, ApiError, AuthFormData, unknown>
  phase: AuthPhase
}

function getButtonLabel(phase: AuthPhase, defaultLabel: string): string {
  switch (phase) {
    case 'authenticating':
      return 'Authenticating...'
    case 'fetching':
      return 'Fetching vault...'
    case 'unlocking':
      return 'Unlocking...'
    case 'decrypting':
      return 'Decrypting vault...'
    default:
      return defaultLabel
  }
}

export default function AuthForm({
  title,
  defaultButtonLabel,
  linkText,
  onLinkClick,
  mutation,
  phase
}: AuthFormProps) {
  usePopupSize('compact')
  const { navigate } = useNavigation()

  const onSuccess = () => {
    navigate('/bookmark')
  }

  const { formData, disabled, handleSubmit, handleChange, error } = useAuthForm({
    onSuccess,
    mutation
  })

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.content}>
        <div className={styles.pageTitle}>
          <Text as='h1' size='3'>
            {title}
          </Text>
        </div>
        
        {error && (
          <ErrorMessage message={error.message} type={error.type} />
        )}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            size='lg'
            placeholder='Email or username'
            name='login'
            autoComplete='off'
            value={formData.login}
            onChange={handleChange}
            disabled={mutation.isPending}
            autoFocus
          >
            <Mail size={16} />
          </Input>

          <Input
            size='lg'
            placeholder='Password'
            type='password'
            name='password'
            value={formData.password}
            onChange={handleChange}
            disabled={mutation.isPending}
          >
            <KeyRound size={16} />
          </Input>

          <Button disabled={disabled}>
            {mutation.isPending && <Loader2 className={styles.spinner} />}
            {getButtonLabel(phase, defaultButtonLabel)}
          </Button>
        </form>

        <div className={styles.authLink}>
          <Button
            variant='ghost'
            onClick={onLinkClick}
            color='light'
          >
            {linkText}
          </Button>
        </div>
      </div>
    </div>
  )
}