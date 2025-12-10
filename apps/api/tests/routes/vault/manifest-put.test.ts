// PUT /vault/manifest tests
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

describe('PUT /vault/manifest', () => {
  const app = new Hono().route('/auth', authRoutes).route('/vault', vaultRoutes)
  const client = testClient(app) as any
  let token: string
  let userId: string

  // Helper function to create test manifest data
  function createManifestData(version: number) {
    const nonce = Buffer.from('a'.repeat(48), 'hex').toString('base64') // 24 bytes
    const ciphertext = Buffer.from(
      'encrypted_manifest_data_v' + version
    ).toString('base64')
    return {
      version,
      nonce,
      ciphertext
    }
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

  it('should create first manifest (version 1) and return 201', async () => {
    const manifestData = createManifestData(1)

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(201)
    const data: any = await res.json()

    expect(data.vault_id).toBeDefined()
    expect(data.vault_id).toMatch(/^vlt_/)
    expect(data.version).toBe(1)
    expect(data.etag).toBeDefined()
    expect(typeof data.etag).toBe('string')
    expect(data.updated_at).toBeDefined()
    expect(typeof data.updated_at).toBe('number')
  })

  it('should update manifest (version 2) with If-Match and return 200', async () => {
    // Create first manifest
    const manifest1 = createManifestData(1)
    const res1 = await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )
    const data1: any = await res1.json()

    // Update with version 2
    const manifest2 = createManifestData(2)
    const res2 = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token, { 'If-Match': data1.etag })
    )

    expect(res2.status).toBe(200)
    const data2: any = await res2.json()
    expect(data2.version).toBe(2)
    expect(data2.etag).not.toBe(data1.etag)
  })

  it('should reject version 2 without If-Match header (409 Conflict)', async () => {
    // Create first manifest
    const manifest1 = createManifestData(1)
    await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )

    // Try to update without If-Match
    const manifest2 = createManifestData(2)
    const res = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('If-Match')
  })

  it('should reject with wrong ETag (409 Conflict)', async () => {
    // Create first manifest
    const manifest1 = createManifestData(1)
    await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )

    // Try to update with wrong ETag
    const manifest2 = createManifestData(2)
    const res = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token, { 'If-Match': 'wrong_etag' })
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('ETag')
  })

  it('should reject wrong version sequencing (409 Conflict)', async () => {
    // Try to create version 2 without version 1
    const manifest2 = createManifestData(2)
    const res = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('Version conflict')
  })

  it('should reject skipping version (409 Conflict)', async () => {
    // Create version 1
    const manifest1 = createManifestData(1)
    await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )

    // Try to skip to version 3
    const manifest3 = createManifestData(3)
    const res = await client.vault.manifest.$put(
      { json: manifest3 },
      generateHeaders(token)
    )

    expect(res.status).toBe(409)
    const data: any = await res.json()
    expect(data.error).toContain('Version conflict')
  })

  it('should reject invalid base64 nonce (400 Bad Request)', async () => {
    const manifestData = {
      version: 1,
      nonce: 'not-valid-base64!!!',
      ciphertext: Buffer.from('data').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toContain('base64')
  })

  it('should reject invalid base64 ciphertext (400 Bad Request)', async () => {
    const manifestData = {
      version: 1,
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
      ciphertext: 'not-valid-base64!!!'
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
    const data: any = await res.json()
    expect(data.error).toContain('base64')
  })

  it('should reject manifest exceeding max size (413 Payload Too Large)', async () => {
    // Create ciphertext larger than 5MB
    const largeCiphertext = Buffer.from('x'.repeat(6 * 1024 * 1024)).toString(
      'base64'
    )

    const manifestData = {
      version: 1,
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
      ciphertext: largeCiphertext
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(413)
    const data: any = await res.json()
    expect(data.error).toContain('maximum size')
  })

  it('should reject missing version field (400 Bad Request)', async () => {
    const manifestData = {
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
      ciphertext: Buffer.from('data').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('should reject missing nonce field (400 Bad Request)', async () => {
    const manifestData = {
      version: 1,
      ciphertext: Buffer.from('data').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('should reject missing ciphertext field (400 Bad Request)', async () => {
    const manifestData = {
      version: 1,
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('should return 401 without Authorization header', async () => {
    const manifestData = createManifestData(1)

    const res = await client.vault.manifest.$put({ json: manifestData })

    expect(res.status).toBe(401)
  })

  it('should return 401 with invalid token', async () => {
    const manifestData = createManifestData(1)

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      {
        headers: {
          Authorization: 'Bearer invalid_token'
        }
      }
    )

    expect(res.status).toBe(401)
  })

  it('should return 401 for revoked session', async () => {
    // Logout (revoke session)
    await client.auth.logout.$post({}, generateHeaders(token))

    const manifestData = createManifestData(1)
    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(401)
  })

  it('should update vault metadata after manifest creation', async () => {
    const manifestData = createManifestData(1)

    await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    // Get vault metadata
    const vaultRes = await client.vault.index.$get({}, generateHeaders(token))
    const vaultData: any = await vaultRes.json()

    expect(vaultData.version).toBe(1)
    expect(vaultData.has_manifest).toBe(true)
    expect(vaultData.bytes_total).toBeGreaterThan(0)
  })

  it('should handle sequential updates correctly', async () => {
    // Create version 1
    const manifest1 = createManifestData(1)
    const res1 = await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )
    const data1: any = await res1.json()

    // Update to version 2
    const manifest2 = createManifestData(2)
    const res2 = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token, { 'If-Match': data1.etag })
    )
    const data2: any = await res2.json()

    // Update to version 3
    const manifest3 = createManifestData(3)
    const res3 = await client.vault.manifest.$put(
      { json: manifest3 },
      generateHeaders(token, { 'If-Match': data2.etag })
    )

    expect(res3.status).toBe(200)
    const data3: any = await res3.json()
    expect(data3.version).toBe(3)
    expect(data3.etag).not.toBe(data2.etag)
  })

  it('should generate different ETags for different content', async () => {
    // Create version 1
    const manifest1 = createManifestData(1)
    const res1 = await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )
    const data1: any = await res1.json()

    // Update to version 2 with different content
    const manifest2 = {
      version: 2,
      nonce: Buffer.from('b'.repeat(48), 'hex').toString('base64'),
      ciphertext: Buffer.from('different_encrypted_data').toString('base64')
    }
    const res2 = await client.vault.manifest.$put(
      { json: manifest2 },
      generateHeaders(token, { 'If-Match': data1.etag })
    )
    const data2: any = await res2.json()

    expect(data2.etag).not.toBe(data1.etag)
  })

  it('should retrieve manifest after creation via GET', async () => {
    // Create manifest
    const manifestData = createManifestData(1)
    const putRes = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )
    const putData: any = await putRes.json()

    // Get manifest
    const getRes = await client.vault.manifest.$get({}, generateHeaders(token))
    const getData: any = await getRes.json()

    expect(getData.version).toBe(1)
    expect(getData.etag).toBe(putData.etag)
    expect(getData.nonce).toBe(manifestData.nonce)
    expect(getData.ciphertext).toBe(manifestData.ciphertext)
  })

  it('should handle different users independently', async () => {
    // Alice creates manifest
    const aliceManifest = createManifestData(1)
    const aliceRes = await client.vault.manifest.$put(
      { json: aliceManifest },
      generateHeaders(token)
    )
    const aliceData: any = await aliceRes.json()

    // Register and login as Bob
    await client.auth.register.$post({ json: testUsers.bob })
    const bobLoginRes = await client.auth.login.$post({
      json: testUsers.bob
    })
    const bobLoginData: any = await bobLoginRes.json()
    const bobToken = bobLoginData.token

    // Bob creates his own manifest (also version 1)
    const bobManifest = createManifestData(1)
    const bobRes = await client.vault.manifest.$put(
      { json: bobManifest },
      {
        headers: {
          Authorization: `Bearer ${bobToken}`
        }
      }
    )
    const bobData: any = await bobRes.json()

    // Both should be version 1 but different vaults
    expect(aliceData.version).toBe(1)
    expect(bobData.version).toBe(1)
    expect(aliceData.vault_id).not.toBe(bobData.vault_id)
    expect(aliceData.etag).not.toBe(bobData.etag)
  })

  it('should reject negative version', async () => {
    const manifestData = {
      version: -1,
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
      ciphertext: Buffer.from('data').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('should reject zero version', async () => {
    const manifestData = {
      version: 0,
      nonce: Buffer.from('a'.repeat(48), 'hex').toString('base64'),
      ciphertext: Buffer.from('data').toString('base64')
    }

    const res = await client.vault.manifest.$put(
      { json: manifestData },
      generateHeaders(token)
    )

    expect(res.status).toBe(400)
  })

  it('should work with multiple sessions for same user', async () => {
    // Create manifest with first session
    const manifest1 = createManifestData(1)
    const res1 = await client.vault.manifest.$put(
      { json: manifest1 },
      generateHeaders(token)
    )
    const data1: any = await res1.json()

    // Login again (second session)
    const login2Res = await client.auth.login.$post({
      json: testUsers.alice
    })
    const login2Data: any = await login2Res.json()
    const token2 = login2Data.token

    // Update manifest with second session
    const manifest2 = createManifestData(2)
    const res2 = await client.vault.manifest.$put(
      { json: manifest2 },
      {
        headers: {
          Authorization: `Bearer ${token2}`,
          'If-Match': data1.etag
        }
      }
    )

    expect(res2.status).toBe(200)
    const data2: any = await res2.json()
    expect(data2.version).toBe(2)
    expect(data2.vault_id).toBe(data1.vault_id)
  })
})
