import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'
import {
  generateHeaders,
  makeBookmarkCreatePayload,
  makeBookmarkUpdatePayload
} from '../../helpers/utils'

const { db, sqlite } = createTestDatabase()
mock.module('../../../src/database/db', () => ({ db }))

const authRoutes = (await import('../../../src/routes/auth.routes')).default
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const bookmarkRoutes = (await import('../../../src/routes/bookmark.routes'))
  .default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('PUT /bookmarks/:id', () => {
  const app = new Hono()
    .route('/auth', authRoutes)
    .route('/vault', vaultRoutes)
    .route('/bookmarks', bookmarkRoutes)
  const client = testClient(app) as any
  let token: string

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()

    await client.auth.register.$post({ json: testUsers.alice })
    const loginRes = await client.auth.login.$post({ json: testUsers.alice })
    const loginData: any = await loginRes.json()
    token = loginData.token

    await client.vault.index.$get({}, generateHeaders(token))
  })

  afterEach(() => {
    clearDatabase(sqlite)
    clearRateLimits()
  })

  it('updates bookmark with matching ETag and version', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_update_me')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const updatePayload = makeBookmarkUpdatePayload(2, {
      updated_at: createPayload.updated_at + 10_000
    })

    const updateRes = await client.bookmarks[':id'].$put(
      { param: { id: createPayload.item_id }, json: updatePayload },
      generateHeaders(token, { 'If-Match': created.etag })
    )

    expect(updateRes.status).toBe(200)
    const updated: any = await updateRes.json()
    expect(updated.version).toBe(2)
    expect(updated.etag).not.toBe(created.etag)
  })

  it('rejects updates without If-Match header', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_no_if_match')
    await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )

    const res = await client.bookmarks[':id'].$put(
      {
        param: { id: createPayload.item_id },
        json: makeBookmarkUpdatePayload(2)
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
  })

  it('rejects updates with invalid base64 data', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_bad_update')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const res = await client.bookmarks[':id'].$put(
      {
        param: { id: createPayload.item_id },
        json: makeBookmarkUpdatePayload(2, {
          ciphertext_content: '***not-base64***',
          skipSizeRecalc: true
        })
      },
      generateHeaders(token, { 'If-Match': created.etag })
    )

    expect(res.status).toBe(400)
  })

  it('enforces sequential versioning', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_version_check')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const res = await client.bookmarks[':id'].$put(
      {
        param: { id: createPayload.item_id },
        json: makeBookmarkUpdatePayload(3) // should be 2
      },
      generateHeaders(token, { 'If-Match': created.etag })
    )

    expect(res.status).toBe(409)
  })

  it('returns 401 when Authorization is missing', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_update_unauthorized')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const res = await client.bookmarks[':id'].$put(
      {
        param: { id: createPayload.item_id },
        json: makeBookmarkUpdatePayload(2)
      },
      { headers: { 'If-Match': created.etag } }
    )

    expect(res.status).toBe(401)
  })
})
