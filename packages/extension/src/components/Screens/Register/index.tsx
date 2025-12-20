import { KeyRound, Loader2, Mail } from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'
import { useAuthForm } from '@/components/hooks/useAuthForm'

import Header from '@/components/parts/Header'
import Button from '@/components/ui/Button'
import ErrorCallout from '@/components/ui/ErrorCallout'
import Input from '@/components/ui/Input'

import styles from './styles.module.css'

interface RegisterProps {
  onRegisterSuccess: () => void
}

export default function Register({ onRegisterSuccess }: RegisterProps) {
  const { register } = useQueryAuth()
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
            {mutation.isPending ? 'Creating account...' : 'Create Account'}
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
