/**
 * Type definitions for the vault system
 */

/**
 * Vault Header (stored as plaintext JSON in the vault file)
 */
export interface VaultHeader {
    format_version: number;
    vault_uuid: string;
    created_at: string; // ISO8601
    kdf: {
        algo: 'argon2id';
        salt: string; // base64
        opslimit: 'MODERATE';
        memlimit: 'MODERATE';
    };
    hkdf: {
        salt: string; // base64 - separate salt for HKDF key derivation
    };
    aead: {
        algo: 'xchacha20poly1305';
        nonce_len: 24;
    };
}

/**
 * Vault Manifest (encrypted and stored in the vault file)
 */
export interface VaultManifest {
    version_counter: number;
    book_index: BookmarkEntry[]; // Empty for milestone 1
    chain_head: string; // base64 - HMAC chain seed
}

/**
 * Bookmark entry (future milestone)
 */
export interface BookmarkEntry {
    id: string;
    url: string;
    title: string;
    tags: string[];
    created_at: string;
    updated_at: string;
}

/**
 * Unlocked vault session (in-memory only)
 */
export interface UnlockedVault {
    header: VaultHeader;
    manifest: VaultManifest;
    fileHandle: FileSystemFileHandle;
    // Session keys (kept in memory while unlocked)
    sessionKeys: {
        kek: Uint8Array; // Key Encryption Key (not used in milestone 1, but derived)
        mak: Uint8Array; // Manifest Auth/Enc Key
    };
}

/**
 * Crypto environment state
 */
export interface CryptoEnv {
    ready: boolean;
    sodium: typeof import('libsodium-wrappers-sumo') | null;
}

/**
 * App routes
 */
export type AppRoute = '/' | '/create' | '/open' | '/unlock' | '/vault';

/**
 * App state for routing and vault management
 */
export interface AppState {
    route: AppRoute;
    unlockedVault: UnlockedVault | null;
    cryptoReady: boolean;
}

