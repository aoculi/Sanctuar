// GET /vault tests
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
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('GET /vault', () => {
  const app = new Hono().route('/auth', authRoutes).route('/vault', vaultRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string

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
  })

  afterEach(() => {
    clearDatabase(sqlite)
  })

  it('should create vault lazily on first access', async () => {
    const res = await client.vault.index.$get({}, generateHeaders(token))

    expect(res.status).toBe(200)
    const data: any = await res.json()

    // Validate response structure
    expect(data.vault_id).toBeDefined()
    expect(typeof data.vault_id).toBe('string')
    expect(data.vault_id).toMatch(/^vlt_/)
    expect(data.version).toBe(0)
    expect(data.bytes_total).toBe(0)
    expect(data.has_manifest).toBe(false)
    expect(data.updated_at).toBeDefined()
    expect(typeof data.updated_at).toBe('number')
  })

  it('should return same vault on subsequent requests', async () => {
    // First request
    const res1 = await client.vault.index.$get({}, generateHeaders(token))
    const data1: any = await res1.json()

    // Second request
    const res2 = await client.vault.index.$get({}, generateHeaders(token))
    const data2: any = await res2.json()

    // Should return the same vault
    expect(data1.vault_id).toBe(data2.vault_id)
    expect(data1.version).toBe(data2.version)
    expect(data1.bytes_total).toBe(data2.bytes_total)
    expect(data1.has_manifest).toBe(data2.has_manifest)
  })

  it('should return different vaults for different users', async () => {
    // Get vault for alice
    const aliceRes = await client.vault.index.$get({}, generateHeaders(token))
    const aliceData: any = await aliceRes.json()

    // Register and login as bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Get vault for bob
    const bobRes = await client.vault.index.$get(
      {},
      {
        headers: {
          Authorization: `Bearer ${bobToken}`
        }
      }
    )
    const bobData: any = await bobRes.json()

    // Vaults should be different
    expect(aliceData.vault_id).not.toBe(bobData.vault_id)
  })

  it('should return 401 without Authorization header', async () => {
    const res = await client.vault.index.$get({})

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with invalid token', async () => {
    const res = await client.vault.index.$get(
      {},
      {
        headers: {
          Authorization: 'Bearer invalid_token'
        }
      }
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with malformed Authorization header', async () => {
    const res = await client.vault.index.$get(
      {},
      {
        headers: {
          Authorization: 'InvalidFormat token'
        }
      }
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 for revoked session', async () => {
    // Logout (revoke session)
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to access vault
    const res = await client.vault.index.$get({}, generateHeaders(token))

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should have valid timestamp within reasonable range', async () => {
    const beforeRequest = Date.now()

    const res = await client.vault.index.$get({}, generateHeaders(token))

    const afterRequest = Date.now()
    const data: any = await res.json()

    // Timestamp should be between before and after request
    expect(data.updated_at).toBeGreaterThanOrEqual(beforeRequest - 1000) // 1s buffer
    expect(data.updated_at).toBeLessThanOrEqual(afterRequest + 1000) // 1s buffer
  })

  it('should work with multiple sessions for same user', async () => {
    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Get vault with first token
    const vault1Res = await client.vault.index.$get({}, generateHeaders(token))
    const vault1Data: any = await vault1Res.json()

    // Get vault with second token
    const vault2Res = await client.vault.index.$get(
      {},
      {
        headers: {
          Authorization: `Bearer ${token2}`
        }
      }
    )
    const vault2Data: any = await vault2Res.json()

    // Should return the same vault
    expect(vault1Data.vault_id).toBe(vault2Data.vault_id)
  })
})
