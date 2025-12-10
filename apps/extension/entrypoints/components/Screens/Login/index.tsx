import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useLoginAndUnlock } from '@/entrypoints/components/hooks/auth'
import { useAuthForm } from '@/entrypoints/components/hooks/useAuthForm'
import { useNavigation } from '@/entrypoints/components/hooks/useNavigation'

import Menu from '@/entrypoints/components/parts/Menu'
import Button from '@/entrypoints/components/ui/Button'
import ErrorCallout from '@/entrypoints/components/ui/ErrorCallout'
import Input from '@/entrypoints/components/ui/Input'
import Text from '@/entrypoints/components/ui/Text'

import styles from './styles.module.css'

interface LoginProps {
  onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const loginMutation = useLoginAndUnlock()
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
    onSuccess: onLoginSuccess,
    mutation: loginMutation
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
            disabled={loginMutation.isPending}
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
            disabled={loginMutation.isPending}
          >
            <KeyRound size={16} />
          </Input>

          <Button disabled={disabled}>
            {initializing && <Loader2 className={styles.spinner} />}
            {isInitializing
              ? 'Initializing...'
              : loginMutation.isPending
                ? 'Logging in...'
                : 'Unlock Vault'}
          </Button>
        </form>
        <div className={styles.registerLink}>
          <Button variant='ghost' onClick={() => navigate('/register')}>
            Not registered? Create an account
          </Button>
        </div>
      </div>
    </div>
  )
}
