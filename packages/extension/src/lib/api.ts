/**
 * API client for secure extension
 */

import { getSettings } from '@/lib/storage'
import { keystoreManager } from '@/utils/keystore'
import { sessionManager } from '@/utils/session'

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
 * Helper functions for API client
 */

/**
 * Get API URL from settings
 * @throws ApiError if API URL is not configured
 */
async function getApiUrl(): Promise<string> {
  const settings = await getSettings()
  if (!settings?.apiUrl || settings.apiUrl.trim() === '') {
    throw {
      status: -1,
      message:
        'API URL is not configured. Please set the API Base URL in Settings.',
      details:
        'The API URL must be defined in the extension settings before making API calls.'
    } as ApiError
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
  const session = await sessionManager.getSession()
  return session?.token ? `Bearer ${session.token}` : undefined
}

/**
 * Parse response body (handles JSON and text)
 * @param response - Fetch response
 * @returns Parsed data
 */
async function parseResponseBody(response: Response): Promise<any> {
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
async function handle401Error(data: any): Promise<never> {
  await sessionManager.clearSession()
  await keystoreManager.zeroize()
  sessionManager.notifyListeners()

  throw {
    status: 401,
    message: data?.message || data?.error || 'Unauthorized',
    details: data?.details
  } as ApiError
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
  } catch (err: any) {
    if (err?.status === -1 && err?.message?.includes('API URL')) {
      throw err as ApiError
    }
    throw {
      status: -1,
      message: 'Network error',
      details: err?.message
    } as ApiError
  }

  const data = await parseResponseBody(response)

  if (response.status === 401) {
    await handle401Error(data)
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: data?.message || data?.error || 'Request failed',
      details: data?.details
    } as ApiError
  }

  return {
    data: data as T,
    status: response.status
  }
}

// /**
//  * Vault prefetch utilities
//  */
// const QUERY_KEYS = {
//   vault: () => ['vault'] as const,
//   manifest: () => ['vault', 'manifest'] as const
// }

// /**
//  * Prefetches vault metadata
//  * Creates vault lazily if it doesn't exist
//  */
// export async function prefetchVault(queryClient: QueryClient) {
//   await queryClient.prefetchQuery({
//     queryKey: QUERY_KEYS.vault(),
//     queryFn: () => apiClient('/vault').then((r) => r.data)
//   })
// }

// /**
//  * Prefetches manifest data
//  * If manifest doesn't exist (404), ensures vault exists and retries
//  */
// export async function prefetchManifest(
//   queryClient: QueryClient,
//   retryAfterVault = false
// ) {
//   await queryClient.prefetchQuery({
//     queryKey: QUERY_KEYS.manifest(),
//     queryFn: async () => {
//       try {
//         const response = await apiClient('/vault/manifest')
//         return response.data
//       } catch (error: any) {
//         // Handle 404 gracefully - manifest doesn't exist yet
//         if (error?.status === 404) {
//           // If we haven't retried yet, ensure vault exists and retry
//           if (!retryAfterVault) {
//             await prefetchVault(queryClient)
//             // Recursively call itself to retry after vault is created
//             return prefetchManifest(queryClient, true)
//           }
//           // If we already retried, manifest truly doesn't exist
//           return null
//         }
//         throw error
//       }
//     }
//   })
// }

// /**
//  * Prefetches vault and manifest data after successful authentication
//  * Handles the case where manifest might not exist yet (404)
//  */
// // export async function prefetchVaultData(queryClient: QueryClient) {
// //   await prefetchVault(queryClient)
// //   await prefetchManifest(queryClient)
// // }

// /**
//  * Prefetches vault and manifest data after successful authentication
//  * Handles the case where manifest might not exist yet (404)
//  */
// export async function prefetchVaultData(queryClient: QueryClient) {
//   await queryClient.prefetchQuery({
//     queryKey: QUERY_KEYS.vault(),
//     queryFn: () => apiClient('/vault').then((r) => r.data)
//   })

//   const vaultData = queryClient.getQueryData<{ has_manifest?: boolean }>(
//     QUERY_KEYS.vault()
//   )
//   if (vaultData?.has_manifest) {
//     await queryClient.prefetchQuery({
//       queryKey: QUERY_KEYS.manifest(),
//       queryFn: async () => {
//         try {
//           const response = await apiClient('/vault/manifest')
//           return response.data
//         } catch (error: any) {
//           // Handle 404 gracefully - manifest doesn't exist yet
//           if (error?.status === 404) {
//             return null
//           }
//           throw error
//         }
//       }
//     })
//   }
// }

// /**
//  * Decrypts and parses a manifest from API response
//  * Returns the parsed manifest and handles key cleanup
//  */
// export async function decryptManifest(
//   data: ManifestApiResponse
// ): Promise<ManifestV1> {
//   // Ensure crypto environment (libsodium) is initialized
//   await whenCryptoReady()

//   const mak = await keystoreManager.getMAK()
//   const aadContext = await keystoreManager.getAadContext()

//   if (!mak || !aadContext) {
//     throw new Error('Keys not available for decryption')
//   }

//   const aadManifest = new TextEncoder().encode(
//     constructAadManifest(aadContext.userId, aadContext.vaultId)
//   )
//   const plaintext = decryptAEAD(
//     base64ToUint8Array(data.ciphertext),
//     base64ToUint8Array(data.nonce),
//     mak,
//     aadManifest
//   )
//   const manifestText = new TextDecoder().decode(plaintext)

//   let manifest: ManifestV1
//   try {
//     manifest = JSON.parse(manifestText)
//     if (!manifest.items || !Array.isArray(manifest.items)) {
//       manifest.items = []
//     }
//     if (!manifest.tags || !Array.isArray(manifest.tags)) {
//       manifest.tags = []
//     }
//     if (!manifest.version) {
//       manifest.version = data.version
//     }
//   } catch (err) {
//     manifest = { version: data.version, items: [], tags: [] }
//   }

//   zeroize(plaintext)
//   return manifest
// }
