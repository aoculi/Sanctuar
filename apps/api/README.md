# Bookmarks API

A secure, Proton-grade bookmark management API built with Bun and Hono. Features end-to-end encryption design with client-side key derivation.

## Features

- 🔐 **Secure Authentication**: Argon2id password hashing with high memory/time costs
- 🔑 **Client-Side Encryption**: KDF parameters for User Encryption Key (UEK) derivation
- 🚀 **Fast Runtime**: Built on Bun for maximum performance
- 🛡️ **Security First**: Loopback-only binding, no password logging, PHC string storage
- ✅ **Type-Safe**: Full TypeScript with Zod validation
- 📦 **SQLite**: Embedded database with Drizzle ORM

## Stack

- **Runtime**: Bun
- **Framework**: Hono (lightweight web framework)
- **Database**: SQLite with Drizzle ORM
- **Validation**: Zod with @hono/zod-validator
- **Cryptography**:
  - `@node-rs/argon2` - Argon2id password hashing
  - `jose` - JWT for sessions (future)
  - `nanoid` - Secure ID generation
  - `@noble/hashes` - SHA-256 utilities (future)

## Security Architecture

### Password Handling
- **Argon2id AUTH**: 256 MB memory, 3 iterations (server-side verification)
- **Argon2id KDF**: 512 MB memory, 3 iterations (client-side UEK derivation)
- **Salts**: 32 bytes random per user for both AUTH and KDF
- **Storage**: PHC string format with embedded salt and parameters

### Network Security
- Binds to `127.0.0.1` only (loopback)
- Intended for use behind TLS-terminating reverse proxy
- No direct internet exposure

## Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random value

# Run database migrations
bun run db:migrate
```

## Development

```bash
# Start development server (hot reload enabled)
bun run dev
```

Server will start on `http://127.0.0.1:3000`


## Database

```bash
# Generate new migration
bun run db:generate

# Run migrations
bun run db:migrate

# Generate and run migrations
bun run db:generate:run
```


## Environment Variables

```bash
# Database
DATABASE_URL=sqlite.db

# JWT Secret (REQUIRED)
# Generate: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key

# Server (optional)
PORT=3000
```

## Security Notes

### What the Server Stores
- User ID, login (email/username)
- Argon2id AUTH hash (for password verification)
- KDF parameters (for client-side UEK derivation)
- Timestamps

### What the Server Never Stores
- Plain text passwords
- User Encryption Key (UEK)
- Master Key (MK)
- Unencrypted user data

### Client-Side Workflow
1. Register user → receive KDF parameters
2. Derive UEK from password using KDF parameters
3. Generate Master Key (MK)
4. Encrypt MK with UEK → Wrapped Master Key (WMK)
5. Store WMK on server (future endpoint)
6. Use MK to encrypt/decrypt bookmarks

## API Endpoints

See [docs/API.md](docs/API.md) for complete API documentation.

### Available Endpoints

#### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `POST /auth/logout` - Revoke current session
- `GET /auth/session` - Check session validity

#### User
- `POST /user/wmk` - Upload/update wrapped master key

#### Vault
- `GET /vault` - Get vault metadata (lazy creation)
- `GET /vault/manifest` - Fetch encrypted manifest blob
- `HEAD /vault/manifest` - Check manifest ETag/version (cache freshness)
- `PUT /vault/manifest` - Create/update manifest with optimistic concurrency

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/routes/vault/vault.test.ts

# Watch mode
bun test --watch
```

## Future Roadmap

- [ ] Manifest upload/download endpoints
- [ ] Bookmark CRUD operations
- [ ] PAKE authentication (OPAQUE)
- [ ] Audit logging
- [ ] Multi-device synchronization

## License

Proprietary - Secure bookmark management system
