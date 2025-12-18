// GET /vault/manifest tests
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

describe('GET /vault/manifest', () => {
  const app = new Hono().route('/auth', authRoutes).route('/vault', vaultRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string
  let vaultId: string

  // Helper function to create a manifest
  async function createTestManifest() {
    // Get vault first (creates it if needed)
    const vaultRes = await client.vault.index.$get({}, generateHeaders(token))
    const vaultData: any = await vaultRes.json()
    vaultId = vaultData.vault_id

    // Insert manifest directly into database
    const nonce = Buffer.from('a'.repeat(48), 'hex') // 24 bytes
    const ciphertext = Buffer.from(
      'encrypted_manifest_data_here_with_more_content'
    )
    const etag = 'test_etag_abc123'
    const version = 12
    const size = ciphertext.length
    const updatedAt = Date.now()

    sqlite.run(
      `INSERT INTO manifests (vault_id, etag, version, nonce, ciphertext, size, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vaultId, etag, version, nonce, ciphertext, size, updatedAt]
    )

    return { nonce, ciphertext, etag, version, size, updatedAt }
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

  it('should return manifest successfully when it exists', async () => {
    const testData = await createTestManifest()

    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    expect(res.status).toBe(200)
    const data: any = await res.json()

    // Validate response structure
    expect(data.vault_id).toBe(vaultId)
    expect(data.version).toBe(testData.version)
    expect(data.etag).toBe(testData.etag)
    expect(data.nonce).toBeDefined()
    expect(typeof data.nonce).toBe('string')
    expect(data.ciphertext).toBeDefined()
    expect(typeof data.ciphertext).toBe('string')
    expect(data.size).toBe(testData.size)
    expect(data.updated_at).toBe(testData.updatedAt)
  })

  it('should return base64-encoded nonce and ciphertext', async () => {
    const testData = await createTestManifest()

    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    const data: any = await res.json()

    // Verify base64 encoding
    const decodedNonce = Buffer.from(data.nonce, 'base64')
    const decodedCiphertext = Buffer.from(data.ciphertext, 'base64')

    expect(decodedNonce).toEqual(testData.nonce)
    expect(decodedCiphertext).toEqual(testData.ciphertext)
  })

  it('should return 404 when manifest does not exist', async () => {
    // Create vault but no manifest
    await client.vault.index.$get({}, generateHeaders(token))

    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toBe('Manifest not found')
  })

  it('should return 404 when vault does not exist', async () => {
    // Don't create vault at all
    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    expect(res.status).toBe(404)
    const data: any = await res.json()
    expect(data.error).toBe('Manifest not found')
  })

  it('should return 401 without Authorization header', async () => {
    const res = await client.vault.manifest.$get({})

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with invalid token', async () => {
    const res = await client.vault.manifest.$get(
      {},
      generateHeaders('Bearer invalid_token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 with malformed Authorization header', async () => {
    const res = await client.vault.manifest.$get(
      {},
      generateHeaders('InvalidFormat token')
    )

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return 401 for revoked session', async () => {
    await createTestManifest()

    // Logout (revoke session)
    await client.auth.logout.$post({}, generateHeaders(token))

    // Try to get manifest
    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    expect(res.status).toBe(401)
    const data: any = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should return different manifests for different users', async () => {
    // Create manifest for alice
    const aliceData = await createTestManifest()

    const aliceRes = await client.vault.manifest.$get(
      {},
      generateHeaders(token)
    )
    const aliceManifest: any = await aliceRes.json()

    // Register and login as bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Bob should get 404 (no manifest)
    const bobRes = await client.vault.manifest.$get(
      {},
      generateHeaders(bobToken)
    )

    expect(bobRes.status).toBe(404)
    expect(aliceManifest.vault_id).toBeDefined()
  })

  it('should work with multiple sessions for same user', async () => {
    await createTestManifest()

    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Get manifest with first token
    const manifest1Res = await client.vault.manifest.$get(
      {},
      generateHeaders(token)
    )
    const manifest1Data: any = await manifest1Res.json()

    // Get manifest with second token
    const manifest2Res = await client.vault.manifest.$get(
      {},
      generateHeaders(token2)
    )
    const manifest2Data: any = await manifest2Res.json()

    // Should return the same manifest
    expect(manifest1Data.vault_id).toBe(manifest2Data.vault_id)
    expect(manifest1Data.version).toBe(manifest2Data.version)
    expect(manifest1Data.etag).toBe(manifest2Data.etag)
    expect(manifest1Data.nonce).toBe(manifest2Data.nonce)
    expect(manifest1Data.ciphertext).toBe(manifest2Data.ciphertext)
  })

  it('should handle large manifest data', async () => {
    // Get vault first
    const vaultRes = await client.vault.index.$get({}, generateHeaders(token))
    const vaultData: any = await vaultRes.json()
    vaultId = vaultData.vault_id

    // Create large manifest
    const nonce = Buffer.from('a'.repeat(48), 'hex') // 24 bytes
    const ciphertext = Buffer.from('x'.repeat(10000)) // 10KB
    const etag = 'large_etag_test'
    const version = 1
    const size = ciphertext.length
    const updatedAt = Date.now()

    sqlite.run(
      `INSERT INTO manifests (vault_id, etag, version, nonce, ciphertext, size, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vaultId, etag, version, nonce, ciphertext, size, updatedAt]
    )

    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.size).toBe(10000)

    // Verify data integrity
    const decodedCiphertext = Buffer.from(data.ciphertext, 'base64')
    expect(decodedCiphertext.length).toBe(10000)
  })

  it('should include all required fields in response', async () => {
    await createTestManifest()

    const res = await client.vault.manifest.$get({}, generateHeaders(token))

    const data: any = await res.json()

    // Check all required fields exist
    expect(data).toHaveProperty('vault_id')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('etag')
    expect(data).toHaveProperty('nonce')
    expect(data).toHaveProperty('ciphertext')
    expect(data).toHaveProperty('size')
    expect(data).toHaveProperty('updated_at')
  })
})
