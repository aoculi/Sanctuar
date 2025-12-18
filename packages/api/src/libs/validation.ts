// Zod validation utilities for consistent error handling across routes
import { ZodError } from 'zod'

/**
 * Interface for formatted validation errors
 */
interface ValidationErrorResponse {
  error: string
  details: Record<string, string[]>
}

/**
 * Format Zod validation errors into a consistent structure
 * @param error - ZodError instance
 * @param customErrorMessage - Optional custom error message (default: 'Invalid input')
 * @returns Formatted error response object
 */
function formatValidationError(
  error: ZodError,
  customErrorMessage: string = 'Invalid input'
): ValidationErrorResponse {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    fieldErrors[path].push(issue.message)
  }

  return {
    error: customErrorMessage,
    details: fieldErrors
  }
}

/**
 * Create a validation error handler for Hono zValidator
 * @param customErrorMessage - Optional custom error message
 * @returns Error handler function for zValidator
 */
export function createValidationErrorHandler(customErrorMessage?: string) {
  return (result: any, c: any) => {
    if (!result.success) {
      const formattedError = formatValidationError(
        result.error,
        customErrorMessage
      )
      return c.json(formattedError, 400)
    }
  }
}
