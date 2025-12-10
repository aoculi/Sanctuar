import type { UseMutationResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useNavigation } from '@/entrypoints/components/hooks/useNavigation'

import type { ApiError } from '@/entrypoints/lib/api'
import { whenCryptoReady } from '@/entrypoints/lib/cryptoEnv'

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
  const [error, setError] = useState<string | string[] | null>(null)
  const [cryptoReady, setCryptoReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const { setFlash, openSettings } = useNavigation()

  // Check sodium ready state
  useEffect(() => {
    const checkCryptoReady = async () => {
      try {
        await whenCryptoReady()
        setCryptoReady(true)
      } catch (error) {
        console.error('Failed to initialize crypto:', error)
        setError(
          'Failed to initialize encryption. Please refresh the extension.'
        )
      } finally {
        setIsInitializing(false)
      }
    }

    checkCryptoReady()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFlash(null)
    setError(null)

    if (!cryptoReady) {
      setError('Encryption not ready. Please wait...')
      return
    }

    if (!formData.login.trim() || !formData.password.trim()) {
      setError('Please fill in all fields')
      return
    }

    try {
      await mutation.mutateAsync({
        login: formData.login.trim(),
        password: formData.password
      })

      // Success - callback handles navigation
      onSuccess()
    } catch (err: any) {
      // Handle API URL configuration error
      const apiError = err as {
        status?: number
        message?: string
        details?: Record<string, any>
      }

      if (apiError.status === -1 && apiError.message?.includes('API URL')) {
        setFlash(apiError.message)
        openSettings()
        return
      }

      // Handle WMK upload failure differently - keep session, allow retry
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
            lines.push(`${field}: ${messages.join(', ')}`)
          }
        }
        setError(lines.length > 0 ? [baseMessage, ...lines] : baseMessage)
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

  const initializing = mutation.isPending || !cryptoReady || isInitializing
  const disabled =
    initializing || !formData.login.trim() || !formData.password.trim()

  return {
    formData,
    error,
    cryptoReady,
    isInitializing,
    initializing,
    disabled,
    handleSubmit,
    handleChange
  }
}
