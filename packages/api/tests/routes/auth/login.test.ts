import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { invalidCredentials, testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'

// Create test database
const { db, sqlite } = createTestDatabase()

// Mock db module
mock.module('../../../src/database/db', () => ({ db }))

// Import routes after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('POST /auth/login', () => {
  const app = new Hono().route('/auth', authRoutes)
  const client = testClient(app) as any

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()
    // Register a test user
    await client.auth.register.$post({ json: testUsers.alice })
  })

  afterEach(() => {
    clearDatabase(sqlite)
    clearRateLimits()
  })

  it('should login successfully with correct credentials', async () => {
    const res = await client.auth.login.$post({
      json: testUsers.alice
    })

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data).toHaveProperty('user_id')
    expect(data).toHaveProperty('token')
    expect(data).toHaveProperty('expires_at')
    expect(data).toHaveProperty('kdf')
    expect(data).toHaveProperty('wrapped_mk')
    expect(data.wrapped_mk).toBeNull()
    expect(data.token).toBeTruthy()
    expect(typeof data.expires_at).toBe('number')
    expect(data.expires_at).toBeGreaterThan(Date.now())
  })

  it('should return 401 for wrong password', async () => {
    const res = await client.auth.login.$post({
      json: {
        login: testUsers.alice.login,
        password: 'WrongPassword123!'
      }
    })

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid credentials')
  })

  it('should return 401 for non-existent user', async () => {
    const res = await client.auth.login.$post({
      json: {
        login: 'nonexistent@example.com',
        password: 'SomePass123!'
      }
    })

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid credentials')
  })

  it('should return 400 for invalid input (short password)', async () => {
    const res = await client.auth.login.$post({
      json: invalidCredentials.shortPassword as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
  })

  it('should return 400 for missing fields', async () => {
    const res = await client.auth.login.$post({
      json: invalidCredentials.missingPassword as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
  })

  it('should return KDF parameters matching registration', async () => {
    // Get KDF from registration
    const registerRes = await client.auth.register.$post({
      json: testUsers.bob
    })
    const registerData: any = await registerRes.json()

    // Login and get KDF
    const loginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const loginData: any = await loginRes.json()

    expect(loginData.kdf.salt).toBe(registerData.kdf.salt)
    expect(loginData.kdf.m).toBe(registerData.kdf.m)
    expect(loginData.kdf.t).toBe(registerData.kdf.t)
    expect(loginData.kdf.p).toBe(registerData.kdf.p)
    expect(loginData.kdf.algo).toBe(registerData.kdf.algo)
  })

  it('should generate different tokens for multiple logins', async () => {
    const login1 = await client.auth.login.$post({ json: testUsers.alice })
    const data1: any = await login1.json()

    const login2 = await client.auth.login.$post({ json: testUsers.alice })
    const data2: any = await login2.json()

    expect(data1.token).not.toBe(data2.token)
  })

  it('should return user_id consistently across logins', async () => {
    const login1 = await client.auth.login.$post({ json: testUsers.alice })
    const data1: any = await login1.json()

    const login2 = await client.auth.login.$post({ json: testUsers.alice })
    const data2: any = await login2.json()

    expect(data1.user_id).toBe(data2.user_id)
  })

  it('should set expires_at in the future (60 minutes)', async () => {
    const before = Date.now()
    const res = await client.auth.login.$post({ json: testUsers.alice })
    const data: any = await res.json()

    const oneHour = 60 * 60 * 1000
    expect(data.expires_at).toBeGreaterThan(before)
    expect(data.expires_at).toBeLessThan(before + oneHour + 5000) // +5s buffer
  })
})
