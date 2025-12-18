# LockMark API - Local Encrypted Bookmarks Backend

LockMark API is a Bun + Hono service that stores only ciphertext for the LockMark browser extension. It keeps authentication, vault metadata, and encrypted blobs in SQLite via Drizzle.

## What this service provides

- Local-only by default (`127.0.0.1:3500`)
- JWT sessions with revocation + 1h expiry
- Rate-limited auth endpoints (5 attempts/min per IP and per login)
- Optimistic concurrency with ETags/If-Match on manifests and items
- Zero plaintext storage: encrypted manifest/items, wrapped master key, Argon2id password hashes, salts, and metadata only

## Requirements

- Bun (runtime + package manager)
- SQLite (file-based; `sqlite.db` by default)
- Optional: pnpm if you prefer workspace installs from the repo root

## Quick start (from `packages/api`)

```bash
# 1) Install dependencies
bun install

# 2) Create .env with database path and JWT secret
echo "DATABASE_URL=sqlite.db" > .env
bun run generate:secret | grep '^JWT_SECRET=' >> .env

# 3) Run migrations
bun run db:migrate

# 4) Start the API (hot reload)
bun run dev
```

Defaults: `HOST=127.0.0.1`, `PORT=3500` → `http://127.0.0.1:3500`.

## Configuration

Set these in `.env` (or `.env.production` for prod):

```bash
DATABASE_URL=sqlite.db
JWT_SECRET=hex-encoded-32-bytes-secret   # use bun run generate:secret
HOST=127.0.0.1                           # optional
PORT=3500                                # optional
```

## Scripts

```bash
bun run generate:secret   # prints JWT_SECRET=... line

# Migrations
bun run db:generate       # create a new migration from schema
bun run db:migrate        # apply migrations
bun run db:generate:run   # generate and immediately apply

# Dev and tests
bun run dev               # start API with hot reload
bun test                  # run test suite
```

## Data & storage model (zero-knowledge)

- `users`: Argon2id password hash (auth), client KDF/HKDF salts, wrapped master key blob
- `sessions`: JWT jti mapping with expiry/revocation
- `vaults` + `manifests`: encrypted manifest blob with ETag + version
- `bookmarks`, `tags`, `bookmark_tags`: encrypted items, per-item DEK wrapped and versioned

All bookmark/tag data and manifests are base64-validated, size-bounded (manifest 5 MB, item 64 KB), and stored as ciphertext only.

## Security notes

- Auth hashing: Argon2id (server-side) for password verification
- Client KDF: Argon2id (512 MiB, 3 iters) → UEK; master key wrapped client-side
- Transport surface: binds to loopback by default; adjust `HOST`/`PORT` to expose
- Rate limiting: auth endpoints limited per IP and per login; refresh limited per user
- JWT: HS256, 1h default, must correspond to a non-revoked session in DB

## Example usage (manual)

```bash
# Register
curl -X POST http://127.0.0.1:3500/auth/register \
  -H "content-type: application/json" \
  -d '{"login":"alice","password":"correct horse battery staple"}'

# Login (returns token, kdf params, wrapped_mk)
curl -X POST http://127.0.0.1:3500/auth/login \
  -H "content-type: application/json" \
  -d '{"login":"alice","password":"correct horse battery staple"}'

# Get vault metadata
curl -H "authorization: Bearer <token>" http://127.0.0.1:3500/vault
```

## Available routes

Base URL: `http://127.0.0.1:3500`

```text
# Auth
POST   /auth/register
POST   /auth/login
POST   /auth/logout            (requires Bearer token)
GET    /auth/session           (requires Bearer token)

# User
POST   /user/wmk               (requires Bearer token)

# Vault
GET    /vault                  (requires Bearer token)
GET    /vault/manifest         (requires Bearer token)
HEAD   /vault/manifest         (requires Bearer token)
PUT    /vault/manifest         (requires Bearer token; If-Match for updates)

# Bookmarks
GET    /bookmarks              (requires Bearer token; query: cursor, limit, includeDeleted, updatedAfter)
POST   /bookmarks              (requires Bearer token)
GET    /bookmarks/:id          (requires Bearer token)
PUT    /bookmarks/:id          (requires Bearer token; If-Match header)
DELETE /bookmarks/:id          (requires Bearer token; If-Match header)
GET    /bookmarks/:id/tags     (requires Bearer token)

# Tags
GET    /tags                   (requires Bearer token; query: cursor, limit, includeDeleted, updatedAfter, byToken)
POST   /tags                   (requires Bearer token)
GET    /tags/:id               (requires Bearer token)
PUT    /tags/:id               (requires Bearer token; If-Match header)

# Bookmark-Tag links
POST   /bookmark-tags          (requires Bearer token)
DELETE /bookmark-tags          (requires Bearer token)
```
