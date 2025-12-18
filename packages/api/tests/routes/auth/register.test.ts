import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { config } from '../../../src/config'
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

describe('POST /auth/register', () => {
  const app = new Hono().route('/auth', authRoutes)
  const client = testClient(app) as any

  beforeEach(() => {
    clearDatabase(sqlite)
    clearRateLimits()
  })

  afterEach(() => {
    clearDatabase(sqlite)
    clearRateLimits()
  })

  it('should register a new user successfully', async () => {
    const res = await client.auth.register.$post({
      json: testUsers.alice
    })

    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data).toHaveProperty('user_id')
    expect(data.user_id).toMatch(/^u_/)
    expect(data).toHaveProperty('kdf')
    expect(data.kdf.algo).toBe('argon2id')
    // Check for actual test config values
    expect(data.kdf.m).toBe(config.argon2.kdf.memoryCost)
    expect(data.kdf.t).toBe(config.argon2.kdf.timeCost)
    expect(data.kdf.p).toBe(config.argon2.kdf.parallelism)
    expect(data.kdf.salt).toBeTruthy()
  })

  it('should return 409 when login already exists', async () => {
    // Register first user
    await client.auth.register.$post({ json: testUsers.alice })

    // Try to register again with same login
    const res = await client.auth.register.$post({
      json: testUsers.alice
    })

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toBe('Login already exists')
  })

  it('should return 400 for short login (< 3 characters)', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.shortLogin as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.login).toBeDefined()
    expect(data.details.login[0]).toContain('3 characters')
  })

  it('should return 400 for long login (> 255 characters)', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.longLogin as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.login).toBeDefined()
  })

  it('should return 400 for short password (< 8 characters)', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.shortPassword as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.password).toBeDefined()
    expect(data.details.password[0]).toContain('8 characters')
  })

  it('should return 400 for long password (> 128 characters)', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.longPassword as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.password).toBeDefined()
  })

  it('should return 400 for missing login field', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.missingLogin as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.login).toBeDefined()
  })

  it('should return 400 for missing password field', async () => {
    const res = await client.auth.register.$post({
      json: invalidCredentials.missingPassword as any
    })

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.password).toBeDefined()
  })

  it('should trim whitespace from login', async () => {
    const res = await client.auth.register.$post({
      json: {
        login: '  trimmed@example.com  ',
        password: 'ValidPass123!'
      }
    })

    expect(res.status).toBe(201)
    const data: any = await res.json()
    expect(data.user_id).toBeDefined()

    // Try to register with same login (should fail due to trim)
    const res2 = await client.auth.register.$post({
      json: {
        login: 'trimmed@example.com',
        password: 'ValidPass123!'
      }
    })
    expect(res2.status).toBe(409)
  })

  it('should generate unique user IDs for different users', async () => {
    const res1 = await client.auth.register.$post({ json: testUsers.alice })
    const data1: any = await res1.json()

    const res2 = await client.auth.register.$post({ json: testUsers.bob })
    const data2: any = await res2.json()

    expect(data1.user_id).not.toBe(data2.user_id)
  })

  it('should generate unique KDF salts for different users', async () => {
    const res1 = await client.auth.register.$post({ json: testUsers.alice })
    const data1: any = await res1.json()

    const res2 = await client.auth.register.$post({ json: testUsers.bob })
    const data2: any = await res2.json()

    expect(data1.kdf.salt).not.toBe(data2.kdf.salt)
  })
})
