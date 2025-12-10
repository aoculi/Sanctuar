// POST /user/wmk tests
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { testUsers, testWmk } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'
import { generateHeaders } from '../../helpers/utils'

// Create test database
const { db, sqlite } = createTestDatabase()

// Mock db module
mock.module('../../../src/database/db', () => ({ db }))

// Import routes after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default
const userRoutes = (await import('../../../src/routes/user.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('POST /user/wmk', () => {
  const app = new Hono().route('/auth', authRoutes).route('/user', userRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string

  beforeEach(async () => {
    clearDatabase(sqlite)
    clearRateLimits()
    // Register and login to get token
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

  it('should upload WMK successfully with valid token', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid,
          label: 'wmk_v1'
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.ok).toBe(true)
  })

  it('should return WMK on subsequent login', async () => {
    // Upload WMK
    await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid,
          label: 'wmk_v1'
        }
      },
      generateHeaders(token)
    )

    // Login again
    const loginRes = await client.auth.login.$post({
      json: testUsers.alice
    })
    const loginData: any = await loginRes.json()

    expect(loginData.wrapped_mk).toBe(testWmk.valid)
  })

  it('should upload WMK without label (use default)', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.ok).toBe(true)
  })

  it('should return 401 without Authorization header', async () => {
    const res = await client.user.wmk.$post({
      json: {
        wrapped_mk: testWmk.valid
      }
    })

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with invalid token', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid
        }
      },
      generateHeaders('Bearer invalid_token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 400 for too short WMK (< 40 bytes)', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.tooShort
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.wrapped_mk).toBeDefined()
  })

  it('should return 400 for invalid base64', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.invalidBase64
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
    expect(data.details.wrapped_mk).toBeDefined()
  })

  it('should return 400 for missing wrapped_mk field', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          label: 'wmk_v1'
        } as any
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toBe('Invalid input')
  })

  it('should update WMK if uploaded again', async () => {
    // Upload first WMK
    await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid,
          label: 'wmk_v1'
        }
      },
      generateHeaders(token)
    )

    // Upload different WMK
    const newWmk =
      'TmV3IDI0IGJ5dGUgbm9uY2Vob3BlISFOZXcgMzIgYnl0ZXMgb2YgY2lwaGVydGV4dCEh'
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: newWmk,
          label: 'wmk_v2'
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)

    // Verify new WMK is returned on login
    const loginRes = await client.auth.login.$post({
      json: testUsers.alice
    })
    const loginData: any = await loginRes.json()
    expect(loginData.wrapped_mk).toBe(newWmk)
  })

  it('should not allow uploading WMK with revoked token', async () => {
    // Logout (revoke token)
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to upload WMK
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBe('Session has been revoked')
  })

  it('should allow different users to have different WMKs', async () => {
    // Upload WMK for Alice
    await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid
        }
      },
      generateHeaders(token)
    )

    // Register and login as Bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Upload different WMK for Bob
    const bobWmk =
      'Qm9iIDI0IGJ5dGUgbm9uY2Vob3BlISFCb2IgMzIgYnl0ZXMgb2YgY2lwaGVydGV4dCEh'
    await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: bobWmk
        }
      },
      generateHeaders(bobToken)
    )

    // Clear rate limits to avoid hitting the limit (we've made 5 requests so far)
    clearRateLimits()

    // Verify Alice's WMK
    const aliceLoginRes = await client.auth.login.$post({
      json: testUsers.alice
    })
    const aliceLoginData: any = await aliceLoginRes.json()
    expect(aliceLoginData.wrapped_mk).toBe(testWmk.valid)

    // Verify Bob's WMK
    const bobLoginRes2 = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData2: any = await bobLoginRes2.json()
    expect(bobLoginData2.wrapped_mk).toBe(bobWmk)
  })

  it('should return null wrapped_mk before upload', async () => {
    // Register new user
    await client.auth.register.$post({ json: testUsers.charlie })

    // Login without uploading WMK
    const loginRes = await client.auth.login.$post({
      json: testUsers.charlie
    })
    const loginData: any = await loginRes.json()

    expect(loginData.wrapped_mk).toBeNull()
  })

  it('should accept WMK with exactly 40 bytes (minimum)', async () => {
    // 24 byte nonce + 16 byte minimum ciphertext = 40 bytes
    const minWmk = Buffer.alloc(40).fill(0).toString('base64')

    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: minWmk
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)
  })

  it('should accept WMK with custom label', async () => {
    const res = await client.user.wmk.$post(
      {
        json: {
          wrapped_mk: testWmk.valid,
          label: 'custom_wmk_v2'
        }
      },
      generateHeaders(token)
    )

    expect(res.status).toBe(200)

    // WMK should still be returned on login
    const loginRes = await client.auth.login.$post({
      json: testUsers.alice
    })
    const loginData: any = await loginRes.json()
    expect(loginData.wrapped_mk).toBe(testWmk.valid)
  })
})
