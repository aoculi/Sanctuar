# Tests

Comprehensive test suite for the Bookmarks API using Bun's built-in test runner and in-memory SQLite database.

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/routes/auth.test.ts
```

## Test Structure

```
tests/
├── helpers/
│   ├── fixtures.ts    # Test data (users, WMK, invalid inputs)
│   └── setup.ts       # Database setup and teardown utilities
├── auth/
│   ├── register.test.ts   # POST /auth/register tests (11 tests)
│   ├── login.test.ts      # POST /auth/login tests (9 tests)
│   ├── logout.test.ts     # POST /auth/logout tests (7 tests)
│   └── session.test.ts    # GET /auth/session tests (8 tests)
└── user/
    └── wmk.test.ts        # POST /user/wmk tests (14 tests)
```

## Test Database

Tests use an **in-memory SQLite database** (`:memory:`) that is:
- Created fresh for each test file
- Isolated from the production database
- Automatically cleaned between tests
- Fast and disposable

## Test Coverage

### Authentication Routes

#### POST /auth/register (`tests/auth/register.test.ts` - 11 tests)
- ✅ Register new user successfully
- ✅ Return 409 when login already exists
- ✅ Return 400 for short login (< 3 characters)
- ✅ Return 400 for long login (> 255 characters)
- ✅ Return 400 for short password (< 8 characters)
- ✅ Return 400 for long password (> 128 characters)
- ✅ Return 400 for missing login field
- ✅ Return 400 for missing password field
- ✅ Trim whitespace from login
- ✅ Generate unique user IDs for different users
- ✅ Generate unique KDF salts for different users

#### POST /auth/login (`tests/auth/login.test.ts` - 9 tests)
- ✅ Login successfully with correct credentials
- ✅ Return 401 for wrong password
- ✅ Return 401 for non-existent user
- ✅ Return 400 for invalid input (short password)
- ✅ Return 400 for missing fields
- ✅ Return KDF parameters matching registration
- ✅ Generate different tokens for multiple logins
- ✅ Return user_id consistently across logins
- ✅ Set expires_at in the future (15 minutes)

#### POST /auth/logout (`tests/auth/logout.test.ts` - 7 tests)
- ✅ Logout successfully with valid token
- ✅ Return 401 without Authorization header
- ✅ Return 401 with invalid token
- ✅ Return 401 with malformed Authorization header
- ✅ Return 401 when using revoked token
- ✅ Allow multiple sessions and logout independently
- ✅ Not allow using token after logout

#### GET /auth/session (`tests/auth/session.test.ts` - 8 tests)
- ✅ Return session info with valid token
- ✅ Return correct expires_at matching login
- ✅ Return 401 without Authorization header
- ✅ Return 401 with invalid token
- ✅ Return 401 with malformed Authorization header
- ✅ Return 401 for revoked session
- ✅ Work for multiple active sessions
- ✅ Return same user_id for multiple sessions

### User Routes

#### POST /user/wmk (`tests/user/wmk.test.ts` - 14 tests)
- ✅ Upload WMK successfully with valid token
- ✅ Return WMK on subsequent login
- ✅ Upload WMK without label (use default)
- ✅ Return 401 without Authorization header
- ✅ Return 401 with invalid token
- ✅ Return 400 for too short WMK (< 40 bytes)
- ✅ Return 400 for invalid base64
- ✅ Return 400 for missing wrapped_mk field
- ✅ Update WMK if uploaded again
- ✅ Not allow uploading WMK with revoked token
- ✅ Allow different users to have different WMKs
- ✅ Return null wrapped_mk before upload
- ✅ Accept WMK with exactly 40 bytes (minimum)
- ✅ Accept WMK with custom label

## Test Helpers

### `fixtures.ts`

Provides test data:

```typescript
import { testUsers, testWmk, invalidCredentials } from './helpers/fixtures';

// Use predefined test users
await client.auth.register.$post({ json: testUsers.alice });

// Use valid WMK
await client.user.wmk.$post({ json: { wrapped_mk: testWmk.valid } });

// Test invalid inputs
await client.auth.register.$post({ json: invalidCredentials.shortPassword });
```

### `setup.ts`

Database utilities:

```typescript
import { createTestDatabase, clearDatabase } from './helpers/setup';

// Create in-memory database
const { db, sqlite } = createTestDatabase();

// Clear between tests
clearDatabase(sqlite);
```

## Test Patterns

### Hono Testing Helper

Uses [@hono/testing](https://hono.dev/docs/helpers/testing) for type-safe route testing:

```typescript
import { testClient } from 'hono/testing';
import { Hono } from 'hono';

const app = new Hono().route('/auth', authRoutes);
const client = testClient(app);

// Type-safe API calls
const res = await client.auth.register.$post({ json: { login, password } });
```

### Database Mocking

Each test file mocks the database module to use in-memory SQLite:

```typescript
import { mock } from 'bun:test';

const { db, sqlite } = createTestDatabase();

mock.module('../../src/database/db', () => ({ db }));

// Import routes after mocking
const authRoutes = (await import('../../src/routes/auth.routes')).default;
```

### Test Lifecycle

```typescript
beforeEach(() => {
    clearDatabase(sqlite); // Clean state before each test
});

afterEach(() => {
    clearDatabase(sqlite); // Clean state after each test
});
```

## Common Test Scenarios

### Testing Protected Routes

```typescript
// 1. Register user
await client.auth.register.$post({ json: testUsers.alice });

// 2. Login to get token
const loginRes = await client.auth.login.$post({ json: testUsers.alice });
const { token } = await loginRes.json();

// 3. Use token for protected routes
const res = await client.user.wmk.$post(
    { json: { wrapped_mk: testWmk.valid } },
    { headers: { Authorization: `Bearer ${token}` } }
);
```

### Testing Error Cases

```typescript
// Invalid input
const res = await client.auth.register.$post({
    json: invalidCredentials.shortPassword
});
expect(res.status).toBe(400);

// Unauthorized access
const res = await client.user.wmk.$post({
    json: { wrapped_mk: testWmk.valid }
    // No Authorization header
});
expect(res.status).toBe(401);
```

### Testing Session Management

```typescript
// Create multiple sessions
const login1 = await client.auth.login.$post({ json: testUsers.alice });
const token1 = login1.token;

const login2 = await client.auth.login.$post({ json: testUsers.alice });
const token2 = login2.token;

// Logout one session
await client.auth.logout.$post({}, {
    headers: { Authorization: `Bearer ${token1}` }
});

// Other session still works
const session = await client.auth.session.$get({}, {
    headers: { Authorization: `Bearer ${token2}` }
});
expect(session.status).toBe(200);
```

## Test Results

```bash
$ bun test

 49 pass
 0 fail
 122 expect() calls
Ran 49 tests across 5 files. [65.77s]
```

All tests pass successfully! ✅

### Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| POST /auth/register | 11 | ✅ |
| POST /auth/login | 9 | ✅ |
| POST /auth/logout | 7 | ✅ |
| GET /auth/session | 8 | ✅ |
| POST /user/wmk | 14 | ✅ |
| **Total** | **49** | **✅** |

## Adding New Tests

When adding new routes, follow this pattern:

1. Create test file in `tests/routes/`
2. Import test helpers and fixtures
3. Mock the database
4. Import routes after mocking
5. Write describe blocks for each endpoint
6. Test success cases and all error cases
7. Use `beforeEach` to set up test data
8. Use `afterEach` to clean up

Example:

```typescript
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { testClient } from 'hono/testing';
import { Hono } from 'hono';
import { createTestDatabase, clearDatabase } from '../helpers/setup';

const { db, sqlite } = createTestDatabase();
mock.module('../../src/database/db', () => ({ db }));

const myRoutes = (await import('../../src/routes/my.routes')).default;

describe('GET /my/route', () => {
    const app = new Hono().route('/my', myRoutes);
    const client = testClient(app);

    beforeEach(() => clearDatabase(sqlite));
    afterEach(() => clearDatabase(sqlite));

    it('should work', async () => {
        const res = await client.my.route.$get();
        expect(res.status).toBe(200);
    });
});
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies
- Fast execution (~40s for full suite)
- Deterministic results
- Self-contained (in-memory database)

Add to your CI configuration:

```yaml
- name: Run tests
  run: bun test
```

