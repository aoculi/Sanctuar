import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'
import { generateHeaders } from '../../helpers/utils'

// Create test database
const { db, sqlite } = createTestDatabase()

// Mock db module used by repositories
mock.module('../../../src/database/db', () => ({ db }))

// Import routes after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const tagRoutes = (await import('../../../src/routes/tag.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('POST /tags', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/tags', tagRoutes)
  const client = testClient(app) as any

  let token: string

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()
    // Register and login
    await client.auth.register.$post({ json: testUsers.alice })
    const loginRes = await client.auth.login.$post({ json: testUsers.alice })
    const loginData: any = await loginRes.json()
    token = loginData.token

    // Ensure vault exists (lazy-create)
    await client.vault.index.$get({}, generateHeaders(token))
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('creates a tag and returns metadata (201)', async () => {
    const nonce = Buffer.alloc(24, 1).toString('base64')
    const ciphertext = Buffer.from('encrypted-tag-content').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()

    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_abc123',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now,
          tag_token: null
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data.tag_id).toBe('tag_abc123')
    expect(typeof data.etag).toBe('string')
    expect(data.etag.length).toBeGreaterThan(0)
    expect(data.version).toBe(1)
    expect(typeof data.updated_at).toBe('number')
  })

  it('returns 409 on duplicate tag_id', async () => {
    const nonce = Buffer.alloc(24, 2).toString('base64')
    const ciphertext = Buffer.from('encrypted-1').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()

    const body = {
      tag_id: 'tag_dup',
      nonce_content: nonce,
      ciphertext_content: ciphertext,
      size,
      created_at: now,
      updated_at: now
    }

    const res1 = await client.tags.$post({ json: body }, generateHeaders(token))
    expect(res1.status).toBe(201)

    const res2 = await client.tags.$post({ json: body }, generateHeaders(token))
    expect(res2.status).toBe(409)
  })

  it('returns 400 for invalid base64 payloads', async () => {
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_invalid_b64',
          nonce_content: '!!!!',
          ciphertext_content: 'also-invalid',
          size: 10,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 413 when item exceeds max size', async () => {
    const nonce = Buffer.alloc(24, 3)
    const tooLargeCipher = Buffer.alloc(70_000, 4) // > 64KB
    const size = nonce.length + tooLargeCipher.length
    const now = Date.now()

    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_large',
          nonce_content: nonce.toString('base64'),
          ciphertext_content: tooLargeCipher.toString('base64'),
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(413)
  })

  it('returns 401 without Authorization header', async () => {
    const nonce = Buffer.alloc(24, 5).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post({
      json: {
        tag_id: 'tag_noauth',
        nonce_content: nonce,
        ciphertext_content: ciphertext,
        size,
        created_at: now,
        updated_at: now
      }
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const nonce = Buffer.alloc(24, 6).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_invalid_token',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      { headers: { Authorization: 'Bearer invalid_token' } }
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header', async () => {
    const nonce = Buffer.alloc(24, 7).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_malformed_auth',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      { headers: { Authorization: 'InvalidFormat token' } }
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await client.tags.$post(
      {
        json: {
          // Missing tag_id
          nonce_content: Buffer.alloc(24).toString('base64'),
          ciphertext_content: Buffer.from('ct').toString('base64'),
          size: 50,
          created_at: Date.now(),
          updated_at: Date.now()
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty tag_id', async () => {
    const nonce = Buffer.alloc(24, 8).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: '', // Empty string
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty nonce_content', async () => {
    const ciphertext = Buffer.from('ct').toString('base64')
    const size = Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_empty_nonce',
          nonce_content: '', // Empty string
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty ciphertext_content', async () => {
    const nonce = Buffer.alloc(24, 9).toString('base64')
    const size = Buffer.from(nonce, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_empty_cipher',
          nonce_content: nonce,
          ciphertext_content: '', // Empty string
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative size', async () => {
    const nonce = Buffer.alloc(24, 10).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_negative_size',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size: -1, // Negative size
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-integer size', async () => {
    const nonce = Buffer.alloc(24, 11).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_nonint_size',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size: 3.14, // Non-integer size
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for zero created_at', async () => {
    const nonce = Buffer.alloc(24, 12).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_zero_created',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: 0, // Zero timestamp
          updated_at: Date.now()
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative created_at', async () => {
    const nonce = Buffer.alloc(24, 13).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_negative_created',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: -1000, // Negative timestamp
          updated_at: Date.now()
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for zero updated_at', async () => {
    const nonce = Buffer.alloc(24, 14).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_zero_updated',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: Date.now(),
          updated_at: 0 // Zero timestamp
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-integer timestamps', async () => {
    const nonce = Buffer.alloc(24, 15).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_nonint_timestamps',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: 1234.567, // Non-integer timestamp
          updated_at: Date.now()
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when vault does not exist', async () => {
    // Create a new user but don't create vault
    await client.auth.register.$post({ json: testUsers.bob })
    const loginRes = await client.auth.login.$post({ json: testUsers.bob })
    const loginData: any = await loginRes.json()
    const bobToken = loginData.token

    const nonce = Buffer.alloc(24, 16).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_no_vault',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for revoked session', async () => {
    // Logout to revoke session
    await client.auth.logout.$post({}, generateHeaders(token))

    const nonce = Buffer.alloc(24, 17).toString('base64')
    const ciphertext = Buffer.from('ct').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_revoked_session',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res.status).toBe(401)
  })

  it('accepts optional tag_token field', async () => {
    const nonce = Buffer.alloc(24, 18).toString('base64')
    const ciphertext = Buffer.from('encrypted-tag-with-token').toString(
      'base64'
    )
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()

    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_with_token',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now,
          tag_token: 'blind_index_token_123'
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data.tag_id).toBe('tag_with_token')
    expect(data.etag).toBeDefined()
    expect(data.version).toBe(1)
  })

  it('accepts null tag_token field', async () => {
    const nonce = Buffer.alloc(24, 19).toString('base64')
    const ciphertext = Buffer.from('encrypted-tag-null-token').toString(
      'base64'
    )
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()

    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_null_token',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now,
          tag_token: null
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data.tag_id).toBe('tag_null_token')
    expect(data.etag).toBeDefined()
    expect(data.version).toBe(1)
  })

  it('handles different users independently', async () => {
    // Create tag for alice
    const nonce1 = Buffer.alloc(24, 20).toString('base64')
    const ciphertext1 = Buffer.from('alice-tag').toString('base64')
    const size1 =
      Buffer.from(nonce1, 'base64').length +
      Buffer.from(ciphertext1, 'base64').length
    const now = Date.now()

    const res1 = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_same_id_different_users',
          nonce_content: nonce1,
          ciphertext_content: ciphertext1,
          size: size1,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(res1.status).toBe(201)

    // Register and login as bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({ json: testUsers.bob })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Ensure bob's vault exists
    await client.vault.index.$get(
      {},
      { headers: { Authorization: `Bearer ${bobToken}` } }
    )

    // Create tag with same tag_id for bob (should work - different vaults)
    const nonce2 = Buffer.alloc(24, 21).toString('base64')
    const ciphertext2 = Buffer.from('bob-tag').toString('base64')
    const size2 =
      Buffer.from(nonce2, 'base64').length +
      Buffer.from(ciphertext2, 'base64').length

    const res2 = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_same_id_different_users', // Same tag_id
          nonce_content: nonce2,
          ciphertext_content: ciphertext2,
          size: size2,
          created_at: now,
          updated_at: now
        }
      },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    )
    expect(res2.status).toBe(201)
  })

  it('validates ETag format and uniqueness', async () => {
    const nonce1 = Buffer.alloc(24, 22).toString('base64')
    const ciphertext1 = Buffer.from('tag1').toString('base64')
    const size1 =
      Buffer.from(nonce1, 'base64').length +
      Buffer.from(ciphertext1, 'base64').length
    const now = Date.now()

    const res1 = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_etag_test1',
          nonce_content: nonce1,
          ciphertext_content: ciphertext1,
          size: size1,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    const data1: any = await res1.json()

    const nonce2 = Buffer.alloc(24, 23).toString('base64')
    const ciphertext2 = Buffer.from('tag2').toString('base64')
    const size2 =
      Buffer.from(nonce2, 'base64').length +
      Buffer.from(ciphertext2, 'base64').length

    const res2 = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_etag_test2',
          nonce_content: nonce2,
          ciphertext_content: ciphertext2,
          size: size2,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    const data2: any = await res2.json()

    // ETags should be different for different content
    expect(data1.etag).not.toBe(data2.etag)

    // ETags should be base64url format (no padding, no + or /)
    expect(data1.etag).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(data2.etag).toMatch(/^[A-Za-z0-9_-]+$/)

    // ETags should be reasonable length (SHA-256 base64url = 43 chars)
    expect(data1.etag.length).toBe(43)
    expect(data2.etag.length).toBe(43)
  })

  it('handles size mismatch gracefully', async () => {
    const nonce = Buffer.alloc(24, 24).toString('base64')
    const ciphertext = Buffer.from('size-mismatch-test').toString('base64')
    const actualSize =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const providedSize = actualSize + 100 // Different from actual
    const now = Date.now()

    const res = await client.tags.$post(
      {
        json: {
          tag_id: 'tag_size_mismatch',
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size: providedSize, // Different from actual
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )

    // Should still succeed (size mismatch is just a warning)
    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data.tag_id).toBe('tag_size_mismatch')
  })
})
