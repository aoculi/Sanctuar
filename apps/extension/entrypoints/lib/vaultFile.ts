/**
 * Vault file operations
 * Handles creating, reading, and writing vault files
 */

import {
    AAD_LABELS,
    AEAD,
    CHAIN_SEED_LEN,
    FILE_SEPARATOR,
    FORMAT_VERSION,
    HKDF,
    KDF,
} from './constants';
import {
    constructAAD,
    decryptAEAD,
    deriveKeyFromPassword,
    deriveSubKeys,
    encryptAEAD,
    fromBase64,
    generateRandomBytes,
    generateUUID,
    toBase64,
    zeroize,
} from './crypto';
import type { VaultHeader, VaultManifest } from './types';

/**
 * Create a new vault file
 * @param fileHandle - File handle from showSaveFilePicker
 * @param password - User password
 */
export async function createVaultFile(
    fileHandle: FileSystemFileHandle,
    password: string
): Promise<VaultHeader> {
    try {
        // Step 1: Generate random values
        const vaultUuid = generateUUID();
        const kdfSalt = generateRandomBytes(KDF.saltLen);
        const hkdfSalt = generateRandomBytes(HKDF.saltLen);
        const chainSeed = generateRandomBytes(CHAIN_SEED_LEN);

        // Step 2: Derive master key from password
        const masterKey = deriveKeyFromPassword(password, kdfSalt);

        // Step 3: Derive subkeys (KEK and MAK)
        const { kek, mak } = deriveSubKeys(masterKey, hkdfSalt);

        // Step 4: Create manifest
        const manifest: VaultManifest = {
            version_counter: 1,
            book_index: [],
            chain_head: toBase64(chainSeed),
        };

        // Step 5: Serialize manifest to JSON
        const manifestJson = JSON.stringify(manifest);
        const manifestBytes = new TextEncoder().encode(manifestJson);

        // Step 6: Encrypt manifest with AEAD
        const aad = constructAAD(vaultUuid, AAD_LABELS.manifest);
        const { nonce, ciphertext } = encryptAEAD(manifestBytes, mak, aad);

        // Step 7: Create header
        const header: VaultHeader = {
            format_version: FORMAT_VERSION,
            vault_uuid: vaultUuid,
            created_at: new Date().toISOString(),
            kdf: {
                algo: KDF.algo,
                salt: toBase64(kdfSalt),
                opslimit: KDF.opslimit,
                memlimit: KDF.memlimit,
            },
            hkdf: {
                salt: toBase64(hkdfSalt),
            },
            aead: {
                algo: AEAD.algo,
                nonce_len: AEAD.nonceLen as 24,
            },
        };

        // Step 8: Serialize header to JSON
        const headerJson = JSON.stringify(header, null, 2);
        const headerBytes = new TextEncoder().encode(headerJson);

        // Step 9: Combine header + separator + nonce + ciphertext
        const fileContent = new Uint8Array(
            headerBytes.length +
            FILE_SEPARATOR.length +
            nonce.length +
            ciphertext.length
        );

        let offset = 0;
        fileContent.set(headerBytes, offset);
        offset += headerBytes.length;

        fileContent.set(new TextEncoder().encode(FILE_SEPARATOR), offset);
        offset += FILE_SEPARATOR.length;

        fileContent.set(nonce, offset);
        offset += nonce.length;

        fileContent.set(ciphertext, offset);

        // Step 10: Write to file atomically
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        // Step 11: Zeroize sensitive data
        zeroize(masterKey, kek, mak, kdfSalt, hkdfSalt, chainSeed, manifestBytes);

        return header;
    } catch (error) {
        throw error;
    }
}

/**
 * Read and parse vault file header
 * @param fileHandle - File handle from showOpenFilePicker
 * @returns Parsed header and encrypted manifest blob
 */
export async function readVaultFile(
    fileHandle: FileSystemFileHandle
): Promise<{ header: VaultHeader; encryptedManifest: Uint8Array }> {
    // Read entire file
    const file = await fileHandle.getFile();
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Find separator (double newline)
    const separatorBytes = new TextEncoder().encode(FILE_SEPARATOR);
    let separatorIndex = -1;

    for (let i = 0; i <= fileBytes.length - separatorBytes.length; i++) {
        let match = true;
        for (let j = 0; j < separatorBytes.length; j++) {
            if (fileBytes[i + j] !== separatorBytes[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            separatorIndex = i;
            break;
        }
    }

    if (separatorIndex === -1) {
        throw new Error('Invalid vault file format: separator not found');
    }

    // Parse header (before separator)
    const headerBytes = fileBytes.slice(0, separatorIndex);
    const headerText = new TextDecoder().decode(headerBytes);

    let header: VaultHeader;
    try {
        header = JSON.parse(headerText);
    } catch (error) {
        throw new Error('Invalid vault file format: malformed header JSON');
    }

    // Validate header structure
    if (!header.format_version || !header.vault_uuid || !header.kdf || !header.hkdf || !header.aead) {
        throw new Error('Invalid vault file format: missing required header fields');
    }

    // Extract encrypted manifest (after separator)
    const encryptedManifest = fileBytes.slice(separatorIndex + separatorBytes.length);

    if (encryptedManifest.length < AEAD.nonceLen) {
        throw new Error('Invalid vault file format: encrypted manifest too short');
    }

    return { header, encryptedManifest };
}

/**
 * Unlock vault by decrypting manifest
 * @param header - Vault header
 * @param encryptedManifest - Encrypted manifest blob (nonce + ciphertext)
 * @param password - User password
 * @returns Decrypted manifest and session keys
 */
export async function unlockVault(
    header: VaultHeader,
    encryptedManifest: Uint8Array,
    password: string
): Promise<{ manifest: VaultManifest; kek: Uint8Array; mak: Uint8Array }> {
    // Step 1: Derive keys from password
    const kdfSalt = fromBase64(header.kdf.salt);
    const hkdfSalt = fromBase64(header.hkdf.salt);

    const masterKey = deriveKeyFromPassword(password, kdfSalt);
    const { kek, mak } = deriveSubKeys(masterKey, hkdfSalt);

    // Step 2: Extract nonce and ciphertext
    const nonce = encryptedManifest.slice(0, AEAD.nonceLen);
    const ciphertext = encryptedManifest.slice(AEAD.nonceLen);

    // Step 3: Decrypt manifest
    const aad = constructAAD(header.vault_uuid, AAD_LABELS.manifest);

    let manifestBytes: Uint8Array;
    try {
        manifestBytes = decryptAEAD(ciphertext, nonce, mak, aad);
    } catch (error) {
        // Zeroize keys on failure
        zeroize(masterKey, kek, mak);
        throw new Error('Unable to unlock vault: incorrect password or corrupted file');
    }

    // Step 4: Parse manifest JSON
    const manifestText = new TextDecoder().decode(manifestBytes);
    let manifest: VaultManifest;

    try {
        manifest = JSON.parse(manifestText);
    } catch (error) {
        zeroize(masterKey, kek, mak, manifestBytes);
        throw new Error('Unable to unlock vault: malformed manifest data');
    }

    // Validate manifest structure
    if (typeof manifest.version_counter !== 'number' || !Array.isArray(manifest.book_index)) {
        zeroize(masterKey, kek, mak, manifestBytes);
        throw new Error('Unable to unlock vault: invalid manifest structure');
    }

    // Step 5: Clean up
    zeroize(masterKey, manifestBytes);

    // Return manifest and session keys (KEK and MAK kept in memory)
    return { manifest, kek, mak };
}

/**
 * Update vault manifest (future use)
 * @param fileHandle - File handle
 * @param header - Vault header
 * @param manifest - Updated manifest
 * @param mak - Manifest Auth/Enc Key (from session)
 */
export async function updateVaultManifest(
    fileHandle: FileSystemFileHandle,
    header: VaultHeader,
    manifest: VaultManifest,
    mak: Uint8Array
): Promise<void> {
    // Serialize manifest
    const manifestJson = JSON.stringify(manifest);
    const manifestBytes = new TextEncoder().encode(manifestJson);

    // Encrypt manifest
    const aad = constructAAD(header.vault_uuid, AAD_LABELS.manifest);
    const { nonce, ciphertext } = encryptAEAD(manifestBytes, mak, aad);

    // Serialize header
    const headerJson = JSON.stringify(header, null, 2);
    const headerBytes = new TextEncoder().encode(headerJson);

    // Combine
    const fileContent = new Uint8Array(
        headerBytes.length +
        FILE_SEPARATOR.length +
        nonce.length +
        ciphertext.length
    );

    let offset = 0;
    fileContent.set(headerBytes, offset);
    offset += headerBytes.length;

    fileContent.set(new TextEncoder().encode(FILE_SEPARATOR), offset);
    offset += FILE_SEPARATOR.length;

    fileContent.set(nonce, offset);
    offset += nonce.length;

    fileContent.set(ciphertext, offset);

    // Write atomically
    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();

    // Clean up
    zeroize(manifestBytes);
}

