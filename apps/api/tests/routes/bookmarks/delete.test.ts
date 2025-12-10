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

describe('DELETE /bookmarks/:id', () => {
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

  it('soft deletes a bookmark with correct ETag', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_delete_me')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const deletedAt = Date.now()
    const deleteRes = await client.bookmarks[':id'].$delete(
      {
        param: { id: createPayload.item_id },
        json: { version: 2, deleted_at: deletedAt }
      },
      generateHeaders(token, { 'If-Match': created.etag })
    )

    expect(deleteRes.status).toBe(200)
    const deleted: any = await deleteRes.json()
    expect(deleted.version).toBe(2)
    expect(deleted.deleted_at).toBe(deletedAt)

    const getRes = await client.bookmarks[':id'].$get(
      { param: { id: createPayload.item_id } },
      generateHeaders(token)
    )
    expect(getRes.status).toBe(200)
    const fetched: any = await getRes.json()
    expect(fetched.deleted_at).toBe(deletedAt)
    expect(fetched.version).toBe(2)
  })

  it('rejects delete without If-Match', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_delete_no_if_match')
    await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )

    const res = await client.bookmarks[':id'].$delete(
      {
        param: { id: createPayload.item_id },
        json: { version: 2, deleted_at: Date.now() }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
  })

  it('returns 404 when deleting an already deleted bookmark', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_delete_twice')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    const deleteBody = { version: 2, deleted_at: Date.now() }

    const firstDelete = await client.bookmarks[':id'].$delete(
      { param: { id: createPayload.item_id }, json: deleteBody },
      generateHeaders(token, { 'If-Match': created.etag })
    )
    expect(firstDelete.status).toBe(200)
    const firstDeleted: any = await firstDelete.json()

    const secondDelete = await client.bookmarks[':id'].$delete(
      { param: { id: createPayload.item_id }, json: deleteBody },
      generateHeaders(token, { 'If-Match': firstDeleted.etag })
    )
    expect(secondDelete.status).toBe(404)
  })
})
