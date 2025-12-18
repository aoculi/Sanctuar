# LockMark

LockMark is a local-first, end-to-end encrypted bookmark manager. The React/WXT browser extension encrypts everything on your device and talks to a lightweight Bun + Hono API that only stores ciphertext in SQLite.

Inspired by Proton’s privacy-first approach (especially Proton Pass).

## What you get

- 🔐 End-to-end encryption with client-side key derivation (Argon2id + XChaCha20-Poly1305)
- 🛡️ Zero-knowledge server: only ciphertext, nonces, and Argon2id password hashes live in the database
- 🧩 Two components: browser extension UI (`packages/extension`) and local API (`packages/api`)
- 🗄️ SQLite via Drizzle ORM with optimistic concurrency (ETags/If-Match) for manifests and items
- ⚡ Local-only by default (`127.0.0.1:3500`), rate-limited auth, and JWT session revocation

## Repository layout

```
bookmarks/
├── packages/
│   ├── api/          # Bun + Hono API (SQLite + Drizzle)
│   └── extension/    # WXT + React browser extension
├── package.json      # Workspace scripts
└── pnpm-workspace.yaml
```

## Requirements

- pnpm (workspace manager)
- Bun (to run the API)
- Node.js 18+ (for the extension toolchain)
- Firefox Nightly or Firefox ZEN for unsigned builds (Chrome/Chromium not yet tested for unsigned installs)

## Quick start (dev)

From the repo root:

1. Install dependencies

```bash
pnpm install
```

2. Bootstrap the API (`packages/api`)

```bash
cd packages/api
echo "DATABASE_URL=sqlite.db" > .env
bun run generate:secret | grep '^JWT_SECRET=' >> .env
bun run db:migrate
```

3. Run everything

```bash
cd /home/alex/Projects/bookmarks
pnpm run dev      # API on 127.0.0.1:3500, extension dev server
```

### Run components individually

- API: `cd packages/api && bun run dev`
- Extension (Chrome): `cd packages/extension && pnpm run dev`
- Extension (Firefox): `cd packages/extension && pnpm run dev:firefox`

### Building/packaging the extension

See `packages/extension/README.md` for production builds and ZIP packaging commands.

## Usage

- Ensure the API is running on `http://127.0.0.1:3500` (default host/port).
- Load the extension in your browser (unsigned loading instructions are in `packages/extension/README.md`).
- Open the extension settings and set the API URL if you’re not using the default.
- Register a new account (provides KDF params and wraps your master key), then log in.
- Add bookmarks/tags in the extension; the vault manifest is stored as encrypted blobs in SQLite with concurrency protection via ETags.

Want to poke the API directly? Example (register):

```bash
curl -X POST http://127.0.0.1:3500/auth/register \
  -H "content-type: application/json" \
  -d '{"login":"alice","password":"correct horse battery staple"}'
```

## Security at a glance

- Client-side crypto: Argon2id KDF (512 MiB, 3 iterations) + XChaCha20-Poly1305 + HKDF-SHA-256; master key is wrapped with the derived UEK and only ciphertext/nonces are sent.
- Server storage (`packages/api/src/database/schema.ts`): Argon2id password hashes, KDF/HKDF salts, wrapped master key blob, encrypted manifest/items, and metadata—no plaintext bookmarks.
- Authentication: JWT sessions (HS256, 1h default) checked against a sessions table; tokens require non-revoked, non-expired sessions (`auth.middleware.ts`).
- Rate limiting: auth endpoints limited to 5 attempts/min per IP and per login; refresh limited to 30 per 5 minutes (`rate-limit.middleware.ts`).
- Network surface: binds to `127.0.0.1` by default; set `HOST`/`PORT` in `packages/api/.env` to change.
- Integrity/DoS guards: manifest size capped at 5 MB; item size capped at 64 KB; base64 validation and optimistic concurrency via ETags (`vault.service.ts`).

## More docs

- API: `packages/api/README.md`
- Extension: `packages/extension/README.md`
