import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { config } from '../../src/config'

// Initialize JWT secret for tests (use a fixed test secret)
if (!config.jwt.secret) {
  config.jwt.secret =
    'test-secret-for-jwt-signing-do-not-use-in-production-0123456789abcdef'
}

// Use faster Argon2 parameters for tests (production uses 512MB which is too slow for tests)
// Production: memoryCost: 524288 (512 MB)
// Test: memoryCost: 65536 (64 MB) - 8x faster while still secure for testing
config.argon2.auth.memoryCost = 65536 // 2^16 = 64 MB
config.argon2.auth.timeCost = 2 // Reduced from 3
config.argon2.kdf.memoryCost = 131072 // 2^17 = 128 MB (reduced from 512 MB)

/**
 * Create an in-memory database for testing
 * @returns Drizzle database instance
 */
export function createTestDatabase() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite)

  // Run migrations
  migrate(db, { migrationsFolder: './drizzle' })

  return { db, sqlite }
}

/**
 * Clear all data from test database
 * @param sqlite - SQLite database instance
 */
export function clearDatabase(sqlite: Database) {
  sqlite.run('DELETE FROM manifests')
  sqlite.run('DELETE FROM vaults')
  sqlite.run('DELETE FROM sessions')
  sqlite.run('DELETE FROM users')
}

/**
 * Close test database connection
 * @param sqlite - SQLite database instance
 */
export function closeDatabase(sqlite: Database) {
  sqlite.close()
}
