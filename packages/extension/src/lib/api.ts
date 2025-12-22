/**
 * API client for secure extension
 */

import { LoginResponse } from '@/api/auth-api'
import { STORAGE_KEYS } from '@/lib/constants'
import { clearStorageItem, getSettings, getStorageItem } from '@/lib/storage'

/**
 * API client types
 */
export type ApiClientOptions = {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
}

export type ApiSuccess<T = unknown> = {
  data: T
  status: number
}

export type ApiError = {
  status: number
  message: string
  details?: unknown
}

/**
 * Create an ApiError object
 */
export function createApiError(
  status: number,
  message: string,
  details?: unknown
): ApiError {
  return {
    status,
    message,
    details
  }
}

/**
 * Helper functions for API client
 */

/**
 * Get API URL from settings
 * @throws ApiError if API URL is not configured
 */
async function getApiUrl(): Promise<string> {
  const settings = await getSettings()
  if (!settings?.apiUrl || settings.apiUrl.trim() === '') {
    throw createApiError(
      -1,
      'API URL is not configured. Please set the API Base URL in Settings.',
      'The API URL must be defined in the extension settings before making API calls.'
    )
  }
  return settings.apiUrl.trim()
}

/**
 * Build full API URL from path
 * @param path - API endpoint path
 * @returns Full URL
 */
async function buildUrl(path: string): Promise<string> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const apiUrl = await getApiUrl()
  return `${apiUrl}${normalizedPath}`
}

/**
 * Get authorization header if session exists
 * @returns Bearer token header or undefined
 */
async function getAuthHeader(): Promise<string | undefined> {
  const session = await getStorageItem<LoginResponse>(STORAGE_KEYS.SESSION)
  return session?.token ? `Bearer ${session.token}` : undefined
}

/**
 * Parse response body (handles JSON and text)
 * @param response - Fetch response
 * @returns Parsed data
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.length === 0) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Handle 401 Unauthorized response
 * Clears session and keystore, then throws ApiError
 */
async function handle401Error(data: unknown): Promise<never> {
  // Try to clear session storage, but don't fail if it errors
  try {
    await clearStorageItem(STORAGE_KEYS.SESSION)
  } catch (error) {
    // Log but don't throw - we still want to throw the 401 error
    console.warn('Failed to clear session storage on 401:', error)
  }

  const errorData = data as {
    message?: string
    error?: string
    details?: unknown
  }
  throw createApiError(
    401,
    errorData?.message || errorData?.error || 'Unauthorized',
    errorData?.details
  )
}

/**
 * Main API client function
 * Makes HTTP requests with automatic auth header injection and error handling
 * @param path - API endpoint path
 * @param options - Request options
 * @returns Promise with response data and status
 * @throws ApiError on failure
 */
export async function apiClient<T = unknown>(
  path: string,
  options: ApiClientOptions = {}
): Promise<ApiSuccess<T>> {
  const { method = 'GET', headers = {}, body, signal } = options

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...headers
  }

  const authHeader = await getAuthHeader()
  if (authHeader) {
    requestHeaders['Authorization'] = authHeader
  }

  const requestBody = body !== undefined ? JSON.stringify(body) : undefined
  let response: Response
  try {
    const url = await buildUrl(path)
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal,
      credentials: 'omit',
      mode: 'cors'
    })
  } catch (err: unknown) {
    // Check if it's already an ApiError (from getApiUrl)
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      'message' in err &&
      (err as ApiError).status === -1 &&
      typeof (err as ApiError).message === 'string' &&
      (err as ApiError).message.includes('API URL')
    ) {
      throw err as ApiError
    }
    // Handle network errors or other unknown errors
    const errorMessage =
      err instanceof Error ? err.message : 'Network request failed'
    throw createApiError(-1, 'Network error', errorMessage)
  }

  const data = await parseResponseBody(response)

  if (response.status === 401) {
    await handle401Error(data)
  }

  if (!response.ok) {
    const errorData = data as {
      message?: string
      error?: string
      details?: unknown
    }
    throw createApiError(
      response.status,
      errorData?.message || errorData?.error || 'Request failed',
      errorData?.details
    )
  }

  return {
    data: data as T,
    status: response.status
  }
}
