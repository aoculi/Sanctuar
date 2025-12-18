import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'
import { generateHeaders } from '../../helpers/utils'

// Create test database
const { db, sqlite } = createTestDatabase()

// Mock db module
mock.module('../../../src/database/db', () => ({ db }))

// Import routes after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('POST /auth/logout', () => {
  const app = new Hono().route('/auth', authRoutes)
  const client = testClient(app) as any
  let token: string

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()
    // Register and login
    await client.auth.register.$post({ json: testUsers.alice })
    const loginRes = await client.auth.login.$post({
      json: testUsers.alice
    })
    const loginData: any = await loginRes.json()
    token = loginData.token
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('should logout successfully with valid token', async () => {
    const res = await client.auth.logout.$post({}, generateHeaders(token))

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.ok).toBe(true)
  })

  it('should return 401 without Authorization header', async () => {
    const res = await client.auth.logout.$post({})

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
    expect(data.error).toContain('Authorization')
  })

  it('should return 401 with invalid token', async () => {
    const res = await client.auth.logout.$post(
      {},
      generateHeaders('Bearer invalid_token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with malformed Authorization header', async () => {
    const res = await client.auth.logout.$post(
      {},
      generateHeaders('NotBearer token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 when using revoked token', async () => {
    // Logout once
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to logout again with same token
    const res = await client.auth.logout.$post({}, generateHeaders(token))

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBe('Session has been revoked')
  })

  it('should allow multiple sessions and logout independently', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Logout first session
    const logout1Res = await client.auth.logout.$post(
      {},
      generateHeaders(token)
    )
    expect(logout1Res.status).toBe(200)

    // Second session should still work
    const logout2Res = await client.auth.logout.$post(
      {},
      generateHeaders(token2)
    )
    expect(logout2Res.status).toBe(200)
  })

  it('should not allow using token after logout', async () => {
    // Logout
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to check session with revoked token
    const res = await client.auth.session.$get({}, generateHeaders(token))

    expect(res.status).toBe(401)
  })
})
