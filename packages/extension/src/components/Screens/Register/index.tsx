import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import {
  useQueryAuth,
  type AuthPhase
} from '@/components/hooks/queries/useQueryAuth'
import { useAuthForm } from '@/components/hooks/useAuthForm'
import usePopupSize from '@/components/hooks/usePopupSize'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'

import styles from './styles.module.css'

function getButtonLabel(phase: AuthPhase): string {
  switch (phase) {
    case 'authenticating':
      return 'Creating account...'
    case 'fetching':
      return 'Fetching vault...'
    case 'unlocking':
      return 'Unlocking...'
    case 'decrypting':
      return 'Decrypting vault...'
    default:
      return 'Create Account'
  }
}

interface RegisterProps {
  onRegisterSuccess: () => void
}

export default function Register({ onRegisterSuccess }: RegisterProps) {
  usePopupSize('compact')
  const { register, phase } = useQueryAuth()
  const { navigate } = useNavigation()

  const mutation = register

  const { formData, error, disabled, handleSubmit, handleChange } = useAuthForm(
    {
      onSuccess: onRegisterSuccess,
      mutation
    }
  )

  return (
    <div className={styles.container}>
      <Header title='Register' />
      <div className={styles.content}>
        {error && <ErrorCallout>{error}</ErrorCallout>}

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
            {getButtonLabel(phase)}
          </Button>
        </form>

        <div className={styles.loginLink}>
          <Button
            variant='ghost'
            onClick={() => navigate('/login')}
            color='light'
          >
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  )
}
