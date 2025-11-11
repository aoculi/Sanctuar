import type { ManifestApiResponse } from "@/entrypoints/components/hooks/useManifestQuery";
import { constructAadManifest } from "@/entrypoints/lib/constants";
import { decryptAEAD, fromBase64, zeroize } from "@/entrypoints/lib/crypto";
import { whenCryptoReady } from "@/entrypoints/lib/cryptoEnv";
import type { ManifestV1 } from "@/entrypoints/lib/types";
import { keystoreManager } from "@/entrypoints/store/keystore";

/**
 * Decrypts and parses a manifest from API response
 * Returns the parsed manifest and handles key cleanup
 */
export async function decryptManifest(
  data: ManifestApiResponse
): Promise<ManifestV1> {
  // Ensure crypto environment (libsodium) is initialized
  await whenCryptoReady();

  const mak = await keystoreManager.getMAK();
  const aadContext = await keystoreManager.getAadContext();

  if (!mak || !aadContext) {
    throw new Error("Keys not available for decryption");
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
