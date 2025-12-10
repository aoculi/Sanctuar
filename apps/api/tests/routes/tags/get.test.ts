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

describe('GET /tags/:id', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/tags', tagRoutes)
  const client = testClient(app) as any

  let token: string
  let createdTagId: string

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
    const uniqueTagId = `test_tag_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('fetches existing tag successfully (200)', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()

    expect(data.tag_id).toBe(createdTagId)
    expect(data.version).toBe(1)
    expect(typeof data.etag).toBe('string')
    expect(data.etag.length).toBeGreaterThan(0)
    expect(typeof data.nonce_content).toBe('string')
    expect(typeof data.ciphertext_content).toBe('string')
    expect(typeof data.size).toBe('number')
    expect(typeof data.created_at).toBe('number')
    expect(typeof data.updated_at).toBe('number')
    expect(data.deleted_at).toBeNull()
  })

  it('returns 404 for non-existent tag', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: 'non_existent_tag' } },
      generateHeaders(token)
    )

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await client.tags[':id'].$get({ param: { id: createdTagId } })

    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      { headers: { Authorization: 'Bearer invalid_token' } }
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      { headers: { Authorization: 'InvalidFormat token' } }
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 for revoked session', async () => {
    // Logout to revoke session
    await client.auth.logout.$post({}, generateHeaders(token))

    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      generateHeaders(token)
    )

    expect(res.status).toBe(401)
  })

  it('returns 404 when vault does not exist', async () => {
    // Create a new user but don't create vault
    await client.auth.register.$post({ json: testUsers.bob })
    const loginRes = await client.auth.login.$post({ json: testUsers.bob })
    const loginData: any = await loginRes.json()
    const bobToken = loginData.token

    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      { headers: { Authorization: `Bearer ${bobToken}` } }
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

    // Try to access alice's tag with bob's token
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      { headers: { Authorization: `Bearer ${bobToken}` } }
    )

    expect(res.status).toBe(404)
  })

  it('returns correct base64 encoded fields', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()

    // Verify base64 encoding
    expect(() => Buffer.from(data.nonce_content, 'base64')).not.toThrow()
    expect(() => Buffer.from(data.ciphertext_content, 'base64')).not.toThrow()

    // Verify decoded content matches what we created
    const decodedNonce = Buffer.from(data.nonce_content, 'base64')
    const decodedCiphertext = Buffer.from(data.ciphertext_content, 'base64')

    expect(decodedNonce.length).toBe(24)
    expect(decodedCiphertext.toString()).toBe('test-tag-content')
  })

  it('returns correct metadata fields', async () => {
    const res = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()

    // Verify metadata
    expect(data.tag_id).toBe(createdTagId)
    expect(data.version).toBe(1)
    expect(data.size).toBeGreaterThan(0)
    expect(data.created_at).toBeGreaterThan(0)
    expect(data.updated_at).toBeGreaterThan(0)
    expect(data.deleted_at).toBeNull()

    // Verify ETag format
    expect(data.etag).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(data.etag.length).toBe(43) // SHA-256 base64url
  })

  it('handles special characters in tag_id', async () => {
    // Create tag with special characters
    const nonce = Buffer.alloc(24, 2).toString('base64')
    const ciphertext = Buffer.from('special-chars-tag').toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length
    const now = Date.now()

    const specialTagId = 'tag_with-special.chars_123'
    const createRes = await client.tags.$post(
      {
        json: {
          tag_id: specialTagId,
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(createRes.status).toBe(201)

    // Fetch the tag
    const res = await client.tags[':id'].$get(
      { param: { id: specialTagId } },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.tag_id).toBe(specialTagId)
  })

  it('works with multiple sessions for same user', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({ json: testUsers.alice })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Get tag with first token
    const res1 = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      generateHeaders(token)
    )

    // Get tag with second token
    const res2 = await client.tags[':id'].$get(
      { param: { id: createdTagId } },
      { headers: { Authorization: `Bearer ${token2}` } }
    )

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const data1: any = await res1.json()
    const data2: any = await res2.json()

    // Should return the same tag data
    expect(data1.tag_id).toBe(data2.tag_id)
    expect(data1.version).toBe(data2.version)
    expect(data1.etag).toBe(data2.etag)
  })
})
