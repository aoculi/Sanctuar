# LockMark - Secure Bookmarks Vault

LockMark is a secure, end-to-end encrypted bookmark management system consisting of a browser extension and a local API server. Heavily inspired by Proton's security architecture, your bookmarks are encrypted on the client side before being stored, ensuring that only you can access them. **No clear or unencrypted data is ever saved in the database.**

## Project Overview

LockMark consists of two main components:

1. **Browser Extension** (`apps/extension/`) - A Firefox/Chrome extension built with WXT and React that provides the user interface for managing encrypted bookmarks
2. **API Server** (`apps/api/`) - A local Bun/Hono API server that stores encrypted data using SQLite

### Key Features

- 🔐 **End-to-End Encryption**: All data is encrypted client-side before storage
- 🚀 **Local-First**: Run your own API server locally - no cloud dependency
- 🔑 **Secure Authentication**: Argon2id password hashing with client-side key derivation
- 🛡️ **Zero-Knowledge**: The server never sees your unencrypted bookmarks
- 📦 **Self-Hosted**: Complete control over your data

## Getting Started

This is a monorepo managed with `pnpm` workspaces. To get started, you'll need to set up both the API server and the browser extension.

### Prerequisites

- [Bun](https://bun.sh) (for the API server)
- [pnpm](https://pnpm.io) (package manager)
- Node.js 18+ (for the extension)

> **⚠️ Warning: Extension Installation Limitations**
>
> Currently, the extension can only be installed without extension signature verification on:
>
> - **Firefox ZEN** (fork of Firefox)
> - **Firefox Nightly**
>
> Chrome/Chromium compatibility for unsigned extensions has not been tested yet.
>
> For standard Firefox releases, you would need to sign the extension through Mozilla's Add-on Developer Hub. See the [Extension README](./apps/extension/README.md) for more details on Firefox installation.

### Quick Start

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up the API server:**
   Follow the instructions in [`apps/api/README.md`](./apps/api/README.md) to:

   - Generate a JWT secret
   - Initialize the database
   - Start the API server

3. **Set up the browser extension:**
   Follow the instructions in [`apps/extension/README.md`](./apps/extension/README.md) to:
   - Configure the API URL (if different from default)
   - Build and load the extension

## Development

### Running Everything

To run both the API server and extension in development mode:

```bash
pnpm run dev
```

This will:

- Start the API server at `http://127.0.0.1:3500`
- Start the extension development server for Firefox

### Running Components Individually

**API Server only:**

```bash
pnpm run dev:api
```

**Extension only:**

```bash
pnpm run dev:ext
```

## Project Structure

```
bookmarks/
├── apps/
│   ├── api/              # Backend API server (Bun + Hono)
│   │   ├── README.md     # API setup and documentation
│   │   └── src/
│   │       ├── routes/   # API route handlers
│   │       ├── services/ # Business logic
│   │       └── ...
│   └── extension/        # Browser extension (WXT + React)
│       ├── README.md     # Extension setup and documentation
│       └── entrypoints/  # Extension source code
├── package.json          # Root package.json with workspace scripts
└── README.md            # This file
```

## Architecture

### Security Model

Inspired by Proton's zero-knowledge architecture, LockMark ensures complete privacy:

- **Client-Side Encryption**: All bookmark data is encrypted using AES-256-GCM before being sent to the server
- **Key Derivation**: User Encryption Keys (UEK) are derived from passwords using Argon2id
- **Master Key Wrapping**: A random Master Key (MK) encrypts bookmarks, and the MK is wrapped with the UEK
- **Zero-Knowledge Storage**: The server only stores encrypted blobs and cannot decrypt your data
- **No Clear Data**: **Absolutely no unencrypted or plaintext data is saved in the database** - the server only stores encrypted ciphertext, hashed passwords (Argon2id), and metadata

### Data Flow

1. User registers/logs in → receives KDF parameters
2. Client derives UEK from password using KDF parameters
3. Client generates Master Key (MK) and wraps it with UEK
4. All bookmarks are encrypted with MK before being sent to the server
5. Server stores only encrypted data

## Learn More

- [API Documentation](./apps/api/README.md) - Complete API setup, configuration, and available routes
- [Extension Documentation](./apps/extension/README.md) - Extension setup, building, and Firefox installation
