import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import {
  clearRateLimits,
  getRateLimitStats
} from '../../../src/middleware/rate-limit.middleware'
import { testUsers } from '../../helpers/fixtures'
import { clearDatabase, createTestDatabase } from '../../helpers/setup'

// Create test database
const { db, sqlite } = createTestDatabase()

// Mock db module
mock.module('../../../src/database/db', () => ({ db }))

// Import routes after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default

describe('Rate Limiting', () => {
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

  describe('POST /auth/register - Rate Limiting', () => {
    it('should allow up to 5 registration attempts per minute', async () => {
      // First 5 attempts should succeed (with different logins)
      for (let i = 0; i < 5; i++) {
        const res = await client.auth.register.$post({
          json: {
            login: `test${i}@example.com`,
            password: 'ValidPass123!'
          }
        })

        expect(res.status).toBe(201)
      }
    })

    it('should return 429 after 5 attempts from same IP', async () => {
      // First 5 attempts
      for (let i = 0; i < 5; i++) {
        await client.auth.register.$post({
          json: {
            login: `test${i}@example.com`,
            password: 'ValidPass123!'
          }
        })
      }

      // 6th attempt should be rate limited
      const res = await client.auth.register.$post({
        json: {
          login: 'test6@example.com',
          password: 'ValidPass123!'
        }
      })

      expect(res.status).toBe(429)
      const data: any = await res.json()
      expect(data.error).toContain('Too many requests')
    })

    it('should include Retry-After header when rate limited', async () => {
      // Make 5 requests to hit the limit
      for (let i = 0; i < 5; i++) {
        await client.auth.register.$post({
          json: {
            login: `test${i}@example.com`,
            password: 'ValidPass123!'
          }
        })
      }

      // 6th request should return 429 with Retry-After
      const res = await client.auth.register.$post({
        json: {
          login: 'test6@example.com',
          password: 'ValidPass123!'
        }
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should rate limit per login identifier', async () => {
      const sameLogin = 'duplicate@example.com'

      // First attempt should succeed
      const res1 = await client.auth.register.$post({
        json: {
          login: sameLogin,
          password: 'ValidPass123!'
        }
      })
      expect(res1.status).toBe(201)

      // Next 4 attempts with same login should fail (409 conflict)
      // but still count towards rate limit
      for (let i = 0; i < 4; i++) {
        await client.auth.register.$post({
          json: {
            login: sameLogin,
            password: 'ValidPass123!'
          }
        })
      }

      // 6th attempt should be rate limited
      const res6 = await client.auth.register.$post({
        json: {
          login: sameLogin,
          password: 'ValidPass123!'
        }
      })

      expect(res6.status).toBe(429)
      const data: any = await res6.json()
      expect(data.error).toContain('Too many requests')
    })
  })

  describe('POST /auth/login - Rate Limiting', () => {
    beforeEach(async () => {
      // Register a test user for login tests
      await client.auth.register.$post({ json: testUsers.alice })
    })

    it('should allow up to 5 requests per minute (including registration)', async () => {
      // beforeEach already made 1 request (register), so we can make 4 more
      // Total = 5 requests from this IP (1 register + 4 logins)
      for (let i = 0; i < 4; i++) {
        const res = await client.auth.login.$post({
          json: {
            login: testUsers.alice.login,
            password: testUsers.alice.password
          }
        })

        // Should succeed or return 401, but not 429
        expect(res.status).not.toBe(429)
      }
    })

    it('should return 429 after 5 attempts from same IP', async () => {
      // First 5 attempts
      for (let i = 0; i < 5; i++) {
        await client.auth.login.$post({
          json: {
            login: testUsers.alice.login,
            password: testUsers.alice.password
          }
        })
      }

      // 6th attempt should be rate limited
      const res = await client.auth.login.$post({
        json: {
          login: testUsers.alice.login,
          password: testUsers.alice.password
        }
      })

      expect(res.status).toBe(429)
      const data: any = await res.json()
      expect(data.error).toContain('Too many requests')
    })

    it('should include Retry-After header when rate limited', async () => {
      // Make 5 requests to hit the limit
      for (let i = 0; i < 5; i++) {
        await client.auth.login.$post({
          json: {
            login: testUsers.alice.login,
            password: testUsers.alice.password
          }
        })
      }

      // 6th request should return 429 with Retry-After
      const res = await client.auth.login.$post({
        json: {
          login: testUsers.alice.login,
          password: testUsers.alice.password
        }
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')

      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10)
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
    })

    it('should rate limit per login identifier (account-specific)', async () => {
      // Try to login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await client.auth.login.$post({
          json: {
            login: testUsers.alice.login,
            password: 'WrongPassword123!'
          }
        })
      }

      // 6th attempt should be rate limited even with correct password
      const res = await client.auth.login.$post({
        json: {
          login: testUsers.alice.login,
          password: testUsers.alice.password
        }
      })

      expect(res.status).toBe(429)
      const data: any = await res.json()
      expect(data.error).toContain('Too many requests')
    })

    it('should rate limit per account (login) independently from IP limits', async () => {
      // Register second user
      await client.auth.register.$post({ json: testUsers.bob })

      // Make 3 attempts for alice (not enough to hit IP limit)
      for (let i = 0; i < 3; i++) {
        await client.auth.login.$post({
          json: {
            login: testUsers.alice.login,
            password: 'WrongPassword123!'
          }
        })
      }

      // Make 2 more attempts with bob (total 5 from this IP, hitting IP limit)
      for (let i = 0; i < 2; i++) {
        await client.auth.login.$post({
          json: {
            login: testUsers.bob.login,
            password: testUsers.bob.password
          }
        })
      }

      // Now both Alice and Bob should be rate limited by IP
      const aliceRes = await client.auth.login.$post({
        json: {
          login: testUsers.alice.login,
          password: testUsers.alice.password
        }
      })
      expect(aliceRes.status).toBe(429)

      const bobRes = await client.auth.login.$post({
        json: {
          login: testUsers.bob.login,
          password: testUsers.bob.password
        }
      })
      expect(bobRes.status).toBe(429)
    })
  })

  describe('Rate Limit Cleanup', () => {
    it('should track rate limit entries', async () => {
      // Make a few requests
      await client.auth.login.$post({
        json: {
          login: 'test@example.com',
          password: 'TestPass123!'
        }
      })

      await client.auth.register.$post({
        json: {
          login: 'another@example.com',
          password: 'AnotherPass123!'
        }
      })

      const stats = getRateLimitStats()
      expect(stats.ipLimits).toBeGreaterThan(0)
    })

    it('should clear rate limits when clearRateLimits is called', async () => {
      // Make some requests
      for (let i = 0; i < 3; i++) {
        await client.auth.login.$post({
          json: {
            login: 'test@example.com',
            password: 'TestPass123!'
          }
        })
      }

      // Clear limits
      clearRateLimits()

      // Should be able to make 5 more requests without hitting limit
      for (let i = 0; i < 5; i++) {
        const res = await client.auth.login.$post({
          json: {
            login: 'test@example.com',
            password: 'TestPass123!'
          }
        })

        expect([200, 401]).toContain(res.status)
      }
    })
  })

  describe('Rate Limiting with Invalid Requests', () => {
    it('should still apply IP-based rate limiting for invalid JSON', async () => {
      // Make 5 requests with invalid JSON
      for (let i = 0; i < 5; i++) {
        await client.auth.login.$post({
          json: { invalid: 'data' } as any
        })
      }

      // 6th request should be rate limited by IP
      const res = await client.auth.login.$post({
        json: { invalid: 'data' } as any
      })

      expect(res.status).toBe(429)
    })
  })
})
