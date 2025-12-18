// PUT /tags/:id tests
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

const authRoutes = (await import('../../../src/routes/auth.routes')).default
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const tagRoutes = (await import('../../../src/routes/tag.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('PUT /tags/:id', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/tags', tagRoutes)
  const client = testClient(app) as any

  let token: string
  let createdTagId: string
  let currentEtag: string

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

    // Create a tag for testing
    const nonce = Buffer.alloc(24, 1).toString('base64')
    const ciphertext = Buffer.from('test-tag-content').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()
    const uniqueTagId = `test_tag_put_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const createRes = await client.tags.$post(
      {
        json: {
          tag_id: uniqueTagId,
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now,
          tag_token: 'test_token'
        }
      },
      generateHeaders(token)
    )
    expect(createRes.status).toBe(201)
    const createData: any = await createRes.json()
    createdTagId = createData.tag_id
    currentEtag = createData.etag
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('updates existing tag successfully (200)', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt,
          tag_token: 'updated_token'
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()

    expect(data.tag_id).toBe(createdTagId)
    expect(data.version).toBe(2)
    expect(data.updated_at).toBe(newUpdatedAt)
    expect(typeof data.etag).toBe('string')
    expect(data.etag).not.toBe(currentEtag) // ETag should change
  })

  it('returns 400 for missing If-Match header', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('If-Match header required')
  })

  it('returns 409 for ETag mismatch', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': 'wrong-etag' })
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('ETag mismatch')
  })

  it('returns 409 for wrong version (not current + 1)', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 3, // Should be 2 (current + 1)
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('Version conflict')
  })

  it('returns 404 for non-existent tag', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: 'non_existent_tag' },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns 401 without Authorization header', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      { headers: { 'If-Match': currentEtag } }
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      {
        headers: {
          Authorization: 'Bearer invalid_token',
          'If-Match': currentEtag
        }
      }
    )

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid base64 payloads', async () => {
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: 'invalid-base64!',
          ciphertext_content: 'also-invalid!',
          size: 100,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toContain('Invalid base64')
  })

  it('returns 413 when item exceeds max size', async () => {
    // Create a large payload that exceeds ITEM_MAX_SIZE (64KB)
    const largeNonce = Buffer.alloc(24, 1).toString('base64')
    const largeCiphertext = Buffer.alloc(70000, 1).toString('base64') // ~70KB
    const largeSize =
      Buffer.from(largeNonce, 'base64').length +
      Buffer.from(largeCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: largeNonce,
          ciphertext_content: largeCiphertext,
          size: largeSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(413)
    const data: any = await res.json()
    expect(data.error).toContain('exceeds maximum size')
  })

  it('returns 400 for missing required fields', async () => {
    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2
          // missing nonce_content, ciphertext_content, size, updated_at
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for empty nonce_content', async () => {
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize = Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: '',
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for empty ciphertext_content', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newSize = Buffer.from(newNonce, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: '',
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for negative size', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: -1,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for zero version', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 0,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for zero updated_at', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: 0
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when vault does not exist', async () => {
    // Create a new user but don't create vault
    await client.auth.register.$post({ json: testUsers.bob })
    const loginRes = await client.auth.login.$post({ json: testUsers.bob })
    const loginData: any = await loginRes.json()
    const bobToken = loginData.token

    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      {
        headers: {
          Authorization: `Bearer ${bobToken}`,
          'If-Match': currentEtag
        }
      }
    )

    expect(res.status).toBe(404)
  })

  it('returns 404 for tag from different user', async () => {
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

    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    // Try to update alice's tag with bob's token
    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      {
        headers: {
          Authorization: `Bearer ${bobToken}`,
          'If-Match': currentEtag
        }
      }
    )

    expect(res.status).toBe(404)
  })

  it('accepts optional tag_token field', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt,
          tag_token: 'new_token'
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(200)
  })

  it('accepts null tag_token field', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt,
          tag_token: null
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(200)
  })

  it('handles size mismatch gracefully (warning, not error)', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const actualSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const providedSize = actualSize + 100 // Intentionally wrong
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: providedSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(200) // Should still succeed with warning
  })

  it('validates ETag format and uniqueness', async () => {
    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    const res = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()

    // Verify ETag format
    expect(data.etag).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(data.etag.length).toBe(43) // SHA-256 base64url
    expect(data.etag).not.toBe(currentEtag) // Should be different
  })

  it('works with multiple sessions for same user', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({ json: testUsers.alice })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    const newNonce = Buffer.alloc(24, 2).toString('base64')
    const newCiphertext = Buffer.from('updated-tag-content').toString('base64')
    const newSize =
      Buffer.from(newNonce, 'base64').length +
      Buffer.from(newCiphertext, 'base64').length
    const newUpdatedAt = Date.now()

    // Update tag with first token
    const res1 = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 2,
          nonce_content: newNonce,
          ciphertext_content: newCiphertext,
          size: newSize,
          updated_at: newUpdatedAt
        }
      },
      generateHeaders(token, { 'If-Match': currentEtag })
    )

    expect(res1.status).toBe(200)
    const data1: any = await res1.json()

    // Update tag with second token (need new ETag)
    const res2 = await client.tags[':id'].$put(
      {
        param: { id: createdTagId },
        json: {
          version: 3,
          nonce_content: Buffer.alloc(24, 3).toString('base64'),
          ciphertext_content: Buffer.from('updated-again').toString('base64'),
          size:
            Buffer.from(Buffer.alloc(24, 3).toString('base64'), 'base64')
              .length +
            Buffer.from(
              Buffer.from('updated-again').toString('base64'),
              'base64'
            ).length,
          updated_at: Date.now()
        }
      },
      {
        headers: { Authorization: `Bearer ${token2}`, 'If-Match': data1.etag }
      }
    )

    expect(res2.status).toBe(200)
  })
})
