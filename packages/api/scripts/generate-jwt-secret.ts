#!/usr/bin/env bun
/**
 * Generate a secure random JWT secret
 * Run this once during initial setup and add the output to your .env file
 *
 * Usage:
 *   bun run scripts/generate-jwt-secret.ts
 */

/**
 * Generate a cryptographically secure 256-bit (32 bytes) random secret
 * Returns hex-encoded string (64 characters)
 */
function generateJWTSecret(): string {
  const buffer = new Uint8Array(32) // 256 bits
  crypto.getRandomValues(buffer)
  return Buffer.from(buffer).toString('hex')
}

// Generate and display the secret
const secret = generateJWTSecret()

console.log(
  '╔════════════════════════════════════════════════════════════════════╗'
)
console.log(
  '║                    JWT Secret Generated                           ║'
)
console.log(
  '╚════════════════════════════════════════════════════════════════════╝'
)
console.log('')
console.log('Add this line to your .env file:')
console.log('')
console.log(`JWT_SECRET=${secret}`)
console.log('')
console.log(
  '⚠️  Keep this secret secure and never commit it to version control!'
)
console.log('')
