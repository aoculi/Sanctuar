import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useRegisterAndLogin } from '@/entrypoints/components/hooks/auth'
import { useAuthForm } from '@/entrypoints/components/hooks/useAuthForm'
import { useNavigation } from '@/entrypoints/components/hooks/useNavigation'

import Menu from '@/entrypoints/components/parts/Menu'
import Button from '@/entrypoints/components/ui/Button'
import ErrorCallout from '@/entrypoints/components/ui/ErrorCallout'
import Input from '@/entrypoints/components/ui/Input'
import Text from '@/entrypoints/components/ui/Text'

import styles from './styles.module.css'

interface RegisterProps {
  onRegisterSuccess: () => void
}

export default function Register({ onRegisterSuccess }: RegisterProps) {
  const registerMutation = useRegisterAndLogin()
  const { navigate } = useNavigation()

  const {
    formData,
    error,
    isInitializing,
    initializing,
    disabled,
    handleSubmit,
    handleChange
  } = useAuthForm({
    onSuccess: onRegisterSuccess,
    mutation: registerMutation
  })

  return (
    <div className={styles.container}>
      <div className={styles.special} />

      <div className={styles.menu}>
        <Menu />
      </div>

      <div className={styles.content}>
        <Text as='h1' size='6' weight='medium'>
          LockMark
        </Text>

        {error && <ErrorCallout>{error}</ErrorCallout>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            size='lg'
            placeholder='Email or username'
            name='login'
            autoComplete='off'
            value={formData.login}
            onChange={handleChange}
            disabled={registerMutation.isPending}
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
            disabled={registerMutation.isPending}
          >
            <KeyRound size={16} />
          </Input>

          <Button disabled={disabled}>
            {initializing && <Loader2 className={styles.spinner} />}
            {isInitializing
              ? 'Initializing...'
              : registerMutation.isPending
                ? 'Creating account...'
                : 'Create Account'}
          </Button>
        </form>

        <div className={styles.loginLink}>
          <Button variant='ghost' onClick={() => navigate('/login')}>
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  )
}
