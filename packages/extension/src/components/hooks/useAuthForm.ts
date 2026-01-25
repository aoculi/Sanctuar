import type { UseMutationResult } from '@tanstack/react-query'
import { useState } from 'react'

import type { LoginResponse, RegisterResponse } from '@/api/auth-api'
import type { ApiError } from '@/lib/api'

export type AuthErrorType = 'general' | 'api-config' | 'network'

export type AuthFormData = {
  login: string
  password: string
}

export type UseAuthFormOptions = {
  onSuccess: () => void
  mutation: UseMutationResult<
    LoginResponse | RegisterResponse,
    ApiError,
    AuthFormData,
    unknown
  >
}

export type AuthErrorState = {
  message: string
  type: AuthErrorType
}

export function useAuthForm({ onSuccess, mutation }: UseAuthFormOptions) {
  const [formData, setFormData] = useState<AuthFormData>({
    login: '',
    password: ''
  })
  const [error, setError] = useState<AuthErrorState | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.login.trim() || !formData.password.trim()) {
      setError({ message: 'Please fill in all fields', type: 'general' })
      return
    }

    try {
      await mutation.mutateAsync({
        login: formData.login.trim(),
        password: formData.password
      })

      onSuccess()
    } catch (err: unknown) {
      const apiError = err as {
        status?: number
        message?: string
        details?: Record<string, unknown>
      }

      // The api url is not set in the settings
      if (apiError.status === -1 && typeof apiError.details === 'string' && apiError.details === 'NETWORK_ERROR_CONFIGURE_API') {
        setError({ message: apiError.message || 'API URL not configured', type: 'api-config' })
        return
      }

      // Network connection failed
      if (apiError.status === -1 && typeof apiError.details === 'string' && apiError.details === 'NETWORK_ERROR_FAILED') {
        setError({ message: apiError.message || 'Network connection failed', type: 'network' })
        return
      }

      // The WMK upload failed
      if (apiError.details?.wmkUploadFailed) {
        setError({ message: 'Could not initialize vault. Please try again.', type: 'general' })
        return
      }

      // Handle other errors
      const baseMessage = apiError.message || 'Operation failed'
      const details = apiError.details as Record<string, string[]> | undefined

      if (details && typeof details === 'object' && !details.wmkUploadFailed) {
        const lines: string[] = []
        for (const [field, messages] of Object.entries(details)) {
          if (Array.isArray(messages) && messages.length > 0) {
            lines.push(messages.join(', '))
          }
        }

        setError({
          message: lines.length > 0 ? lines.join('. ') : baseMessage,
          type: 'general'
        })
      } else {
        setError({ message: baseMessage, type: 'general' })
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
    disabled,
    handleSubmit,
    handleChange,
    error
  }
}
