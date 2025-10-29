/**
 * Hardcoded security constants for the vault system (Milestone 1)
 * Based on Proton-level security with libsodium and HKDF
 */

export const FORMAT_VERSION = 1;

export const KDF = {
    algo: 'argon2id' as const,
    opslimit: 'MODERATE' as const,
    memlimit: 'MODERATE' as const,
    outLen: 32, // bytes
    saltLen: 16, // bytes
};

export const HKDF = {
    saltLen: 16, // bytes - separate salt for HKDF
    keyLen: 32, // bytes - output key length
};

export const AEAD = {
    algo: 'xchacha20poly1305' as const,
    nonceLen: 24, // bytes
};

export const AAD_LABELS = {
    manifest: 'manifest_v1' as const,
};

export const KEY_DERIVATION = {
    kek_info: 'VAULT/KEK v1',
    mak_info: 'VAULT/MAK v1',
};

export const CHAIN_SEED_LEN = 32; // bytes

// File format marker: two newlines separate header from encrypted payload
export const FILE_SEPARATOR = '\n\n';

// Storage keys for chrome.storage.local
export const STORAGE_KEYS = {
    FILE_HANDLE_REF: 'vault_file_handle_ref',
    VAULT_UUID: 'vault_uuid',
} as const;

