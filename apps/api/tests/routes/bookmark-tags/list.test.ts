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
const bookmarkRoutes = (await import('../../../src/routes/bookmark.routes'))
  .default
const tagRoutes = (await import('../../../src/routes/tag.routes')).default
const bookmarkTagRoutes = (
  await import('../../../src/routes/bookmark-tag.routes')
).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('GET /bookmarks/:id/tags', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/bookmarks', bookmarkRoutes)
    .route('/tags', tagRoutes)
    .route('/bookmark-tags', bookmarkTagRoutes)
  const client = testClient(app) as any

  let token: string
  let bookmarkId: string
  let tagIds: string[]

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()

    const testId = Math.random().toString(36).substring(2, 8)
    bookmarkId = `bm_test_${testId}`
    tagIds = [`tag_${testId}_1`, `tag_${testId}_2`]

    // Register and login
    await client.auth.register.$post({ json: testUsers.alice })
    const loginRes = await client.auth.login.$post({ json: testUsers.alice })
    const loginData: any = await loginRes.json()
    token = loginData.token

    // Ensure vault exists (lazy-create)
    await client.vault.index.$get({}, generateHeaders(token))

    // Create a bookmark
    const nonce = Buffer.alloc(24, 1).toString('base64')
    const ciphertext = Buffer.from('encrypted-bookmark-content').toString(
      'base64'
    )
    const nonceWrap = Buffer.alloc(24, 2).toString('base64')
    const dekWrapped = Buffer.alloc(32, 3).toString('base64')
    const size =
      Buffer.from(nonce, 'base64').length +
      Buffer.from(ciphertext, 'base64').length +
      Buffer.from(nonceWrap, 'base64').length +
      Buffer.from(dekWrapped, 'base64').length
    const now = Date.now()

    const bookmarkRes = await client.bookmarks.$post(
      {
        json: {
          item_id: bookmarkId,
          nonce_content: nonce,
          ciphertext_content: ciphertext,
          nonce_wrap: nonceWrap,
          dek_wrapped: dekWrapped,
          size,
          created_at: now,
          updated_at: now
        }
      },
      generateHeaders(token)
    )
    expect(bookmarkRes.status).toBe(201)

    // Create two tags
    for (const t of tagIds) {
      const tNonce = Buffer.alloc(24, 4).toString('base64')
      const tCipher = Buffer.from(`encrypted-${t}`).toString('base64')
      const tSize =
        Buffer.from(tNonce, 'base64').length +
        Buffer.from(tCipher, 'base64').length
      const tagRes = await client.tags.$post(
        {
          json: {
            tag_id: t,
            nonce_content: tNonce,
            ciphertext_content: tCipher,
            size: tSize,
            created_at: now,
            updated_at: now
          }
        },
        generateHeaders(token)
      )
      expect(tagRes.status).toBe(201)
    }

    // Link both tags
    for (const t of tagIds) {
      const res = await client['bookmark-tags'].$post(
        {
          json: { item_id: bookmarkId, tag_id: t, created_at: Date.now() }
        },
        generateHeaders(token)
      )
      expect(res.status).toBe(201)
    }
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('lists tag IDs linked to a bookmark (200)', async () => {
    const res = await client.bookmarks[bookmarkId].tags.$get(
      {},
      generateHeaders(token)
    )
    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.item_id).toBe(bookmarkId)
    expect(Array.isArray(data.tag_ids)).toBe(true)
    expect(data.tag_ids.sort()).toEqual(tagIds.sort())
  })

  it('excludes unlinked tags after unlink operation', async () => {
    // Unlink first tag
    const delLink = await client['bookmark-tags'].$delete(
      {
        json: {
          item_id: bookmarkId,
          tag_id: tagIds[0]
        }
      },
      generateHeaders(token)
    )
    expect(delLink.status).toBe(200)

    const res = await client.bookmarks[bookmarkId].tags.$get(
      {},
      generateHeaders(token)
    )
    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.tag_ids.sort()).toEqual([tagIds[1]].sort())
  })

  it('returns 404 when bookmark does not exist', async () => {
    const res = await client.bookmarks['bm_nonexistent'].tags.$get(
      {},
      generateHeaders(token)
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 without Authorization header', async () => {
    const res = await client.bookmarks[bookmarkId].tags.$get()
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await client.bookmarks[bookmarkId].tags.$get(
      {},
      { headers: { Authorization: 'Bearer invalid' } }
    )
    expect(res.status).toBe(401)
  })
})
