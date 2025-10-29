/**
 * Manifest utility functions for decryption and parsing
 */
import type { ManifestApiResponse } from '../hooks/useManifestQuery';
import { keystoreManager } from '../store/keystore';
import { constructAadManifest } from './constants';
import { decryptAEAD, fromBase64, zeroize } from './crypto';
import type { ManifestV1 } from './types';

/**
 * Decrypts and parses a manifest from API response
 * Returns the parsed manifest and handles key cleanup
 */
export async function decryptManifest(
    data: ManifestApiResponse
): Promise<ManifestV1> {
    const mak = await keystoreManager.getMAK();
    const aadContext = await keystoreManager.getAadContext();

    if (!mak || !aadContext) {
        throw new Error('Keys not available for decryption');
    }

    const aadManifest = new TextEncoder().encode(
        constructAadManifest(aadContext.userId, aadContext.vaultId)
    );
    const plaintext = decryptAEAD(
        fromBase64(data.ciphertext),
        fromBase64(data.nonce),
        mak,
        aadManifest
    );
    const manifestText = new TextDecoder().decode(plaintext);

    let manifest: ManifestV1;
    try {
        manifest = JSON.parse(manifestText);
        if (!manifest.items || !Array.isArray(manifest.items)) {
            manifest.items = [];
        }
        if (!manifest.tags || !Array.isArray(manifest.tags)) {
            manifest.tags = [];
        }
        if (!manifest.version) {
            manifest.version = data.version;
        }
    } catch (err) {
        manifest = { version: data.version, items: [], tags: [] };
    }

    zeroize(plaintext);
    return manifest;
}
