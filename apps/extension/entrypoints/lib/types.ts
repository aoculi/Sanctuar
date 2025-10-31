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
    algo: "argon2id";
    salt: string; // base64
    opslimit: "MODERATE";
    memlimit: "MODERATE";
  };
  hkdf: {
    salt: string; // base64 - separate salt for HKDF key derivation
  };
  aead: {
    algo: "xchacha20poly1305";
    nonce_len: 24;
  };
}

/**
 * ManifestV1 - In-memory decrypted structure
 */
export interface ManifestV1 {
  version: number; // mirrors server version
  items: Bookmark[]; // editable list
  tags?: Tag[]; // optional centralized tag list
  chain_head?: string; // reserved (ignore for now)
}

/**
 * Bookmark
 */
export interface Bookmark {
  id: string; // nanoid
  url: string;
  title: string;
  tags: string[]; // tag ids
  created_at: number; // epoch ms
  updated_at: number; // epoch ms
}

/**
 * Tag
 */
export interface Tag {
  id: string; // nanoid
  name: string; // display name
  color?: string; // optional UI hint
}

/**
 * Unlocked vault session (in-memory only)
 */
export interface UnlockedVault {
  header: VaultHeader;
  manifest: ManifestV1;
  fileHandle: FileSystemFileHandle;
  // Session keys (kept in memory while unlocked)
  sessionKeys: {
    kek: Uint8Array; // Key Encryption Key
    mak: Uint8Array; // Manifest Auth/Enc Key
  };
}

/**
 * Crypto environment state
 */
export interface CryptoEnv {
  ready: boolean;
  sodium: typeof import("libsodium-wrappers-sumo") | null;
}

/**
 * App routes
 */
export type AppRoute = "/" | "/create" | "/open" | "/unlock" | "/vault";

/**
 * App state for routing and vault management
 */
export interface AppState {
  route: AppRoute;
  unlockedVault: UnlockedVault | null;
  cryptoReady: boolean;
}
