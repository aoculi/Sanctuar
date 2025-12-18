// Configuration for security parameters and environment variables
export const config = {
  // Server binding
  server: {
    host: process.env.HOST || '127.0.0.1', // Bind only to loopback by default
    port: parseInt(process.env.PORT || '3500', 10)
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || 'sqlite.db'
  },

  // JWT session configuration
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET
      if (!secret || secret.trim() === '') {
        console.error(
          'FATAL ERROR: JWT_SECRET environment variable is required'
        )
        console.error('Run: bun run scripts/generate-jwt-secret.ts')
        process.exit(1)
      }
      return secret
    })(),
    // Access tokens expire after 1 hour; refresh creates a new token
    expiresIn: '1h'
  },

  // Rate limiting configuration
  rateLimit: {
    auth: {
      maxAttempts: 5, // Maximum attempts per window
      windowMs: 60 * 1000 // 1 minute window
    }
  },

  // Argon2id parameters for AUTH (password verification)
  argon2: {
    auth: {
      memoryCost: 524288, // 2^19 = 512 MB in KiB
      timeCost: 3,
      parallelism: 1,
      saltLength: 32 // 32 bytes
    },
    // KDF parameters for UEK (User Encryption Key) - client-side derivation
    // IMPORTANT: These values are sent to the client and must be in KiB units
    // because the hash-wasm library expects memorySize in KiB
    kdf: {
      memoryCost: 524288, // 512 MB in KiB (512 * 1024) - NOT bytes!
      timeCost: 3,
      parallelism: 1,
      saltLength: 32, // 32 bytes
      hkdfSaltLength: 16 // 16 bytes for HKDF salt
    }
  },

  // Validation rules
  validation: {
    password: {
      minLength: 8,
      maxLength: 128
    },
    login: {
      minLength: 3,
      maxLength: 255
    }
  },

  // Manifest constraints (Phase 1)
  manifest: {
    // Maximum manifest size in bytes
    maxSize: 5_000_000 // 5,000,000 bytes (MANIFEST_MAX_SIZE)

    // Vault ID strategy: one vault per user (VAULT_ID_STRATEGY = "user_id")
    // Each user has exactly one vault, vault_id is derived from user_id

    // ETag algorithm: SHA-256 with base64url encoding (ETAG_ALGO = "sha256")
    // Computed as: SHA256(vault_id || version || nonce || ciphertext)

    // Blob encoding: base64 (BLOB_ENCODING = "base64")
    // Client sends nonce and ciphertext as base64-encoded strings
  },

  // Bookmark/Tag item constraints (Phase 2)
  items: {
    // Maximum size for individual bookmark or tag items
    maxSize: 65_536 // 64 KB (ITEM_MAX_SIZE)
  }
}
