import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'
import { generateHeaders, makeBookmarkCreatePayload } from '../../helpers/utils'

const { db, sqlite } = createTestDatabase()
mock.module('../../../src/database/db', () => ({ db }))

const authRoutes = (await import('../../../src/routes/auth.routes')).default
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const bookmarkRoutes = (await import('../../../src/routes/bookmark.routes'))
  .default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('POST /bookmarks and GET /bookmarks/:id', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/bookmarks', bookmarkRoutes)
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
    clearRateLimits()
  })

  it('creates and returns a bookmark', async () => {
    const payload = makeBookmarkCreatePayload()

    const createRes = await client.bookmarks.$post(
      { json: payload },
      generateHeaders(token)
    )

    expect(createRes.status).toBe(201)
    const created: any = await createRes.json()
    expect(created.item_id).toBe(payload.item_id)
    expect(created.version).toBe(1)
    expect(typeof created.etag).toBe('string')

    const getRes = await client.bookmarks[':id'].$get(
      { param: { id: payload.item_id } },
      generateHeaders(token)
    )
    expect(getRes.status).toBe(200)
    const fetched: any = await getRes.json()
    expect(fetched.item_id).toBe(payload.item_id)
    expect(fetched.deleted_at).toBeNull()
  })

  it('returns 404 when vault has not been initialized', async () => {
    // Register a new user but do not create a vault
    await client.auth.register.$post({ json: testUsers.bob })
    const loginRes = await client.auth.login.$post({ json: testUsers.bob })
    const loginData: any = await loginRes.json()
    const bobToken = loginData.token

    const res = await client.bookmarks.$post(
      { json: makeBookmarkCreatePayload('bm_missing_vault') },
      generateHeaders(bobToken)
    )

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toContain('Vault')
  })

  it('rejects invalid base64 payloads', async () => {
    const res = await client.bookmarks.$post(
      {
        json: makeBookmarkCreatePayload('bm_bad_base64', {
          nonce_content: 'not-base64!!!',
          skipSizeRecalc: true
        })
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toContain('base64')
  })

  it('rejects payloads that exceed size limits', async () => {
    const oversizedCiphertext = Buffer.alloc(70_000, 5).toString('base64')

    const res = await client.bookmarks.$post(
      {
        json: makeBookmarkCreatePayload('bm_too_big', {
          ciphertext_content: oversizedCiphertext
        })
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(413)
    const data: any = await res.json()
    expect(data.error).toContain('maximum size')
  })

  it('returns 404 when bookmark id is not found', async () => {
    const res = await client.bookmarks[':id'].$get(
      { param: { id: 'bm_missing' } },
      generateHeaders(token)
    )

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toContain('not found')
  })

  it('returns 401 for GET without Authorization header', async () => {
    const res = await client.bookmarks[':id'].$get({
      param: { id: 'bm_no_auth' }
    })

    expect(res.status).toBe(401)
  })

  it('returns 401 for POST without Authorization header', async () => {
    const res = await client.bookmarks.$post({
      json: makeBookmarkCreatePayload()
    })
    expect(res.status).toBe(401)
  })
})
