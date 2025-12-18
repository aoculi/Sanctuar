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

describe('GET /auth/session', () => {
  const app = new Hono().route('/auth', authRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string
  let expiresAt: number

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
    userId = loginData.user_id
    expiresAt = loginData.expires_at
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('should return session info with valid token', async () => {
    const res = await client.auth.session.$get({}, generateHeaders(token))

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.user_id).toBe(userId)
    expect(data.valid).toBe(true)
    expect(data.expires_at).toBeDefined()
    expect(typeof data.expires_at).toBe('number')
  })

  it('should return correct expires_at matching login', async () => {
    const res = await client.auth.session.$get({}, generateHeaders(token))

    const data: any = await res.json()
    expect(data.expires_at).toBe(expiresAt)
  })

  it('should return 401 without Authorization header', async () => {
    const res = await client.auth.session.$get({})

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with invalid token', async () => {
    const res = await client.auth.session.$get(
      {},
      generateHeaders('Bearer invalid_token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with malformed Authorization header', async () => {
    const res = await client.auth.session.$get(
      {},
      generateHeaders('InvalidFormat token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 for revoked session', async () => {
    // Logout (revoke session)
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to check session
    const res = await client.auth.session.$get({}, generateHeaders(token))

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBe('Session has been revoked')
  })

  it('should work for multiple active sessions', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Both sessions should be valid
    const session1Res = await client.auth.session.$get(
      {},
      generateHeaders(token)
    )
    expect(session1Res.status).toBe(200)

    const session2Res = await client.auth.session.$get(
      {},
      generateHeaders(token)
    )
    expect(session2Res.status).toBe(200)
  })

  it('should return same user_id for multiple sessions', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Check both sessions
    const session1Res = await client.auth.session.$get(
      {},
      generateHeaders(token)
    )
    const session1Data: any = await session1Res.json()

    const session2Res = await client.auth.session.$get(
      {},
      generateHeaders(token)
    )
    const session2Data: any = await session2Res.json()

    expect(session1Data.user_id).toBe(session2Data.user_id)
    expect(session1Data.user_id).toBe(userId)
  })
})
