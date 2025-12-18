// Error constants and helpers for consistent error handling

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  LOGIN_EXISTS: 'Login already exists',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  INVALID_SESSION: 'Invalid session',
  SESSION_REVOKED: 'Session has been revoked',
  SESSION_EXPIRED: 'Session has expired',
  INVALID_TOKEN: 'Invalid or expired token',
  MISSING_AUTH_HEADER: 'Missing or invalid Authorization header'
} as const

export const ERROR_NAMES = {
  UNAUTHORIZED: 'UnauthorizedError',
  CONFLICT: 'ConflictError'
} as const

/**
 * Create an unauthorized error (invalid credentials)
 */
export function createUnauthorizedError(
  message: string = ERROR_MESSAGES.INVALID_CREDENTIALS
): Error {
  const error = new Error(message)
  error.name = ERROR_NAMES.UNAUTHORIZED
  return error
}

/**
 * Create a conflict error (e.g., login already exists)
 */
export function createConflictError(
  message: string = ERROR_MESSAGES.LOGIN_EXISTS
): Error {
  const error = new Error(message)
  error.name = ERROR_NAMES.CONFLICT
  return error
}

/**
 * Log error safely (without sensitive data)
 */
export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`${context}:`, message)
}
