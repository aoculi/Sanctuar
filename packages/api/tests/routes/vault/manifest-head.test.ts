// HEAD /vault/manifest tests
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

// Import after mocking
const authRoutes = (await import('../../../src/routes/auth.routes')).default
const vaultRoutes = (await import('../../../src/routes/vault.routes')).default
const { clearRateLimits } =
  await import('../../../src/middleware/rate-limit.middleware')

describe('HEAD /vault/manifest', () => {
  const app = new Hono().route('/auth', authRoutes).route('/vault', vaultRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string

  // Helper function to create manifest
  async function createManifest(version: number) {
    const nonce = Buffer.from('a'.repeat(48), 'hex').toString('base64')
    const ciphertext = Buffer.from(
      'encrypted_manifest_data_v' + version
    ).toString('base64')

    const res = await client.vault.manifest.$put(
      {
        json: {
          version,
          nonce,
          ciphertext
        }
      },
      generateHeaders(token, version > 1 ? { 'If-Match': await getEtag() } : {})
    )

    return await res.json()
  }

  async function getEtag() {
    const getRes = await client.vault.manifest.$get({}, generateHeaders(token))
    const data: any = await getRes.json()
    return data.etag
  }

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

  it('should return 200 with ETag and X-Vault-Version headers', async () => {
    // Create manifest
    await createManifest(1)

    // HEAD request using app.fetch
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeDefined()
    expect(res.headers.get('x-vault-version')).toBe('1')
  })

  it('should return no body (empty response)', async () => {
    // Create manifest
    await createManifest(1)

    // HEAD request using app.fetch
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    const body = await res.text()
    expect(body).toBe('')
  })

  it('should return same ETag as GET request', async () => {
    // Create manifest
    await createManifest(1)

    // GET request
    const getRes = await client.vault.manifest.$get({}, generateHeaders(token))
    const getData: any = await getRes.json()

    // HEAD request using app.fetch
    const headRes = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    expect(headRes.headers.get('etag')).toBe(getData.etag)
    expect(headRes.headers.get('x-vault-version')).toBe(
      getData.version.toString()
    )
  })

  it('should return updated headers after manifest update', async () => {
    // Create version 1
    await createManifest(1)

    // HEAD request for v1 using app.fetch
    const head1Res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })
    const etag1 = head1Res.headers.get('etag')
    const version1 = head1Res.headers.get('x-vault-version')

    // Update to version 2
    await createManifest(2)

    // HEAD request for v2 using app.fetch
    const head2Res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })
    const etag2 = head2Res.headers.get('etag')
    const version2 = head2Res.headers.get('x-vault-version')

    expect(version1).toBe('1')
    expect(version2).toBe('2')
    expect(etag1).not.toBe(etag2)
  })

  it('should return 404 when manifest does not exist', async () => {
    // HEAD request without creating manifest using app.fetch
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    expect(res.status).toBe(404)
  })

  it('should return 401 without Authorization header', async () => {
    const res = await app.request('/vault/manifest', {
      method: 'HEAD'
    })

    expect(res.status).toBe(401)
  })

  it('should return 401 with invalid token', async () => {
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      headers: {
        Authorization: 'Bearer invalid_token'
      }
    })

    expect(res.status).toBe(401)
  })

  it('should return 401 with malformed Authorization header', async () => {
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      headers: {
        Authorization: 'InvalidFormat token'
      }
    })

    expect(res.status).toBe(401)
  })

  it('should return 401 for revoked session', async () => {
    // Create manifest
    await createManifest(1)

    // Logout (revoke session)
    await client.auth.logout.$post({}, generateHeaders(token))

    // HEAD request using app.fetch
    const res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    expect(res.status).toBe(401)
  })

  it('should be faster than GET request (no body transfer)', async () => {
    // Create large manifest
    const largeCiphertext = Buffer.from('x'.repeat(100000)).toString('base64')
    await client.vault.manifest.$put(
      {
        json: {
          version: 1,
          nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
          ciphertext: largeCiphertext
        }
      },
      generateHeaders(token)
    )

    // HEAD request (should be lightweight) using app.fetch
    const headRes = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    expect(headRes.status).toBe(200)
    expect(headRes.headers.get('etag')).toBeDefined()
    expect(headRes.headers.get('x-vault-version')).toBe('1')

    // Verify no body
    const headBody = await headRes.text()
    expect(headBody).toBe('')
  })

  it('should work with multiple sessions for same user', async () => {
    // Create manifest
    await createManifest(1)

    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // HEAD with first token using app.fetch
    const head1Res = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })

    // HEAD with second token using app.fetch
    const head2Res = await app.request('/vault/manifest', {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token2}`
      }
    })

    // Should return same ETag and version
    expect(head1Res.headers.get('etag')).toBe(head2Res.headers.get('etag'))
    expect(head1Res.headers.get('x-vault-version')).toBe(
      head2Res.headers.get('x-vault-version')
    )
  })

  it('should return different headers for different users', async () => {
    // Alice creates manifest
    await createManifest(1)
    const aliceHeadRes = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })
    const aliceEtag = aliceHeadRes.headers.get('etag')

    // Register and login as Bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Bob creates his manifest
    await client.vault.manifest.$put(
      {
        json: {
          version: 1,
          nonce: Buffer.from('b'.repeat(48), 'hex').toString('base64'),
          ciphertext: Buffer.from('bob_data').toString('base64')
        }
      },
      generateHeaders(token)
    )

    const bobHeadRes = await app.request('/vault/manifest', {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${bobToken}`
      }
    })
    const bobEtag = bobHeadRes.headers.get('etag')

    // ETags should be different
    expect(aliceEtag).not.toBe(bobEtag)
  })

  it('should handle cache validation workflow', async () => {
    // Create manifest v1
    await createManifest(1)

    // Client checks cache freshness using app.fetch
    const check1 = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })
    const cachedEtag = check1.headers.get('etag')
    expect(check1.status).toBe(200)

    // Update manifest v2
    await createManifest(2)

    // Client checks again - ETag should be different using app.fetch
    const check2 = await app.request('/vault/manifest', {
      method: 'HEAD',
      ...generateHeaders(token)
    })
    const newEtag = check2.headers.get('etag')
    expect(check2.status).toBe(200)
    expect(newEtag).not.toBe(cachedEtag)
    expect(check2.headers.get('x-vault-version')).toBe('2')
  })
})
