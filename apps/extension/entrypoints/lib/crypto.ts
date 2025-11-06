/**
 * Cryptographic operations for the vault system
 * Implements Argon2id, HKDF-SHA-256, and XChaCha20-Poly1305
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { argon2id } from 'hash-wasm';
import { AEAD, HKDF, KDF, KEY_DERIVATION } from './constants';
import { getCryptoEnv } from './cryptoEnv';

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate random bytes using libsodium
 */
export function generateRandomBytes(length: number): Uint8Array {
    const sodium = getCryptoEnv();
    return sodium.randombytes_buf(length);
}

/**
 * Derive master key from password using Argon2id
 * @param password - User password (UTF-8)
 * @param salt - Random salt (32 bytes)
 * @returns Master Key (32 bytes)
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const hash = await argon2id({
        password,
        salt,
        parallelism: 1,
        iterations: 3,
        memorySize: 512 * 1024, // in KiB
        hashLength: KDF.outLen,
        outputType: 'binary',
    });
    return hash as Uint8Array;
}

/**
 * Derive subkeys (KEK and MAK) from master key using HKDF-SHA-256
 * @param masterKey - Master key from KDF (32 bytes)
 * @param hkdfSalt - Salt for HKDF (16 bytes)
 * @returns Object with KEK and MAK (each 32 bytes)
 */
export function deriveSubKeys(
    masterKey: Uint8Array,
    hkdfSalt: Uint8Array
): { kek: Uint8Array; mak: Uint8Array } {
    // Convert info strings to Uint8Array
    const kekInfo = new TextEncoder().encode(KEY_DERIVATION.kek_info);
    const makInfo = new TextEncoder().encode(KEY_DERIVATION.mak_info);

    // Derive KEK
    const kek = hkdf(
        sha256,
        masterKey,
        hkdfSalt,
        kekInfo,
        HKDF.keyLen
    );

    // Derive MAK
    const mak = hkdf(
        sha256,
        masterKey,
        hkdfSalt,
        makInfo,
        HKDF.keyLen
    );

    return { kek, mak };
}

/**
 * Encrypt data using XChaCha20-Poly1305
 * @param plaintext - Data to encrypt
 * @param key - Encryption key (32 bytes)
 * @param aad - Associated authenticated data
 * @returns Object with nonce and ciphertext
 */
export function encryptAEAD(
    plaintext: Uint8Array,
    key: Uint8Array,
    aad: Uint8Array
): { nonce: Uint8Array; ciphertext: Uint8Array } {
    const sodium = getCryptoEnv();

    // Generate random nonce
    const nonce = sodium.randombytes_buf(AEAD.nonceLen);

    // Encrypt with AEAD
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        aad,
        null, // no secret nonce
        nonce,
        key
    );

    return { nonce, ciphertext };
}

/**
 * Decrypt data using XChaCha20-Poly1305
 * @param ciphertext - Encrypted data (includes auth tag)
 * @param nonce - Nonce used for encryption (24 bytes)
 * @param key - Decryption key (32 bytes)
 * @param aad - Associated authenticated data (must match encryption)
 * @returns Decrypted plaintext
 * @throws Error if authentication fails
 */
export function decryptAEAD(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
    aad: Uint8Array
): Uint8Array {
    const sodium = getCryptoEnv();

    try {
        const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null, // no secret nonce
            ciphertext,
            aad,
            nonce,
            key
        );

        return plaintext;
    } catch (error) {
        throw new Error('Decryption failed: invalid key or corrupted data');
    }
}

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(data: Uint8Array): string {
    const sodium = getCryptoEnv();
    return sodium.to_base64(data, sodium.base64_variants.ORIGINAL);
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
    const sodium = getCryptoEnv();
    return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

/**
 * Securely zero out sensitive data
 * @param data - Array of Uint8Arrays to wipe
 */
export function zeroize(...data: (Uint8Array | undefined)[]): void {
    for (const item of data) {
        if (item) {
            item.fill(0);
        }
    }
}
