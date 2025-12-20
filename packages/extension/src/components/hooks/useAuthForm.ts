import type { UseMutationResult } from '@tanstack/react-query'
import { useState } from 'react'

import type { ApiError } from '@/lib/api'
import { useNavigation } from './providers/useNavigationProvider'

export type AuthFormData = {
  login: string
  password: string
}

export type UseAuthFormOptions = {
  onSuccess: () => void
  mutation: UseMutationResult<any, ApiError, AuthFormData, unknown>
}

export function useAuthForm({ onSuccess, mutation }: UseAuthFormOptions) {
  const [formData, setFormData] = useState<AuthFormData>({
    login: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const { setFlash } = useNavigation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFlash(null)
    setError(null)

    if (!formData.login.trim() || !formData.password.trim()) {
      setError('Please fill in all fields')
      return
    }

    try {
      await mutation.mutateAsync({
        login: formData.login.trim(),
        password: formData.password
      })

      onSuccess()
    } catch (err: any) {
      const apiError = err as {
        status?: number
        message?: string
        details?: Record<string, any>
      }

      // The api url is not set in the settings
      if (apiError.status === -1 && apiError.message?.includes('API URL')) {
        setFlash(apiError.message)
        return
      }

      // The WMK upload failed
      if (apiError.details?.wmkUploadFailed) {
        // WMK upload failed - show error but keep session
        setError('Could not initialize vault. Please try again.')
        return
      }

      // Handle other errors
      const baseMessage = apiError.message || 'Operation failed'
      const details = apiError.details as Record<string, string[]> | undefined

      if (details && typeof details === 'object' && !details.wmkUploadFailed) {
        const lines: string[] = []
        for (const [field, messages] of Object.entries(details)) {
          if (Array.isArray(messages) && messages.length > 0) {
            lines.push(`${messages.join(', ')}`)
          }
        }

        setError(
          lines.length > 0
            ? `${baseMessage}\n${lines.map((l) => `• ${l}`).join('\n')}`
            : baseMessage
        )
      } else {
        setError(baseMessage)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const disabled =
    mutation.isPending || !formData.login.trim() || !formData.password.trim()

  return {
    formData,
    error,
    disabled,
    handleSubmit,
    handleChange
  }
}
