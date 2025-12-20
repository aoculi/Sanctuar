import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'
import { useAuthForm } from '@/components/hooks/useAuthForm'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'

import styles from './styles.module.css'

interface LoginProps {
  onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const { login } = useQueryAuth()
  const { navigate } = useNavigation()

  const mutation = login

  const { formData, error, disabled, handleSubmit, handleChange } = useAuthForm(
    {
      onSuccess: onLoginSuccess,
      mutation
    }
  )

  return (
    <div className={styles.container}>
      <Header title='Login' />
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
            {mutation.isPending ? 'Logging in...' : 'Unlock Vault'}
          </Button>
        </form>

        <div className={styles.registerLink}>
          <Button
            variant='ghost'
            onClick={() => navigate('/register')}
            color='light'
          >
            Not registered? Create an account
          </Button>
        </div>
      </div>
    </div>
  )
}
