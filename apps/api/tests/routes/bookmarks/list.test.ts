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

describe('GET /bookmarks', () => {
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

  it('lists bookmarks with pagination', async () => {
    const ids = ['bm_a', 'bm_b', 'bm_c']
    for (const id of ids) {
      const res = await client.bookmarks.$post(
        { json: makeBookmarkCreatePayload(id) },
        generateHeaders(token)
      )
      expect(res.status).toBe(201)
    }

    const page1 = await client.bookmarks.$get(
      { query: { limit: 2 } },
      generateHeaders(token)
    )
    expect(page1.status).toBe(200)
    const data1: any = await page1.json()
    expect(data1.items.length).toBe(2)
    expect(data1.next_cursor).toBeTruthy()

    const page2 = await client.bookmarks.$get(
      { query: { limit: 2, cursor: data1.next_cursor } },
      generateHeaders(token)
    )
    expect(page2.status).toBe(200)
    const data2: any = await page2.json()
    expect(data2.items.length).toBe(1)
    expect(data2.next_cursor).toBeNull()
  })

  it('excludes soft-deleted items unless includeDeleted is true', async () => {
    const createPayload = makeBookmarkCreatePayload('bm_list_delete')
    const createRes = await client.bookmarks.$post(
      { json: createPayload },
      generateHeaders(token)
    )
    const created: any = await createRes.json()

    await client.bookmarks[':id'].$delete(
      {
        param: { id: createPayload.item_id },
        json: { version: 2, deleted_at: Date.now() }
      },
      generateHeaders(token, { 'If-Match': created.etag })
    )

    const listDefault = await client.bookmarks.$get({}, generateHeaders(token))
    const defaultData: any = await listDefault.json()
    expect(defaultData.items.length).toBe(0)

    const listDeleted = await client.bookmarks.$get(
      { query: { includeDeleted: true } },
      generateHeaders(token)
    )
    const deletedData: any = await listDeleted.json()
    expect(deletedData.items.length).toBe(1)
    expect(deletedData.items[0].deleted_at).not.toBeNull()
  })

  it('returns empty list when user has no vault', async () => {
    await client.auth.register.$post({ json: testUsers.charlie })
    const loginRes = await client.auth.login.$post({ json: testUsers.charlie })
    const loginData: any = await loginRes.json()
    const charlieToken = loginData.token

    const res = await client.bookmarks.$get({}, generateHeaders(charlieToken))

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.items).toEqual([])
    expect(data.next_cursor).toBeNull()
  })

  it('validates query params (limit)', async () => {
    const res = await client.bookmarks.$get(
      { query: { limit: 0 } },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('returns 401 without Authorization header', async () => {
    const res = await client.bookmarks.$get({})
    expect(res.status).toBe(401)
  })
})
