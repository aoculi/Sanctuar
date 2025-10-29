/**
 * Manifest mutation hook - handles saving and conflict resolution
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../lib/api';
import { threeWayMerge, type ThreeWayMergeInput } from '../lib/conflictResolution';
import { constructAadManifest } from '../lib/constants';
import { decryptAEAD, encryptAEAD, fromBase64, toBase64, zeroize } from '../lib/crypto';
import type { ManifestV1 } from '../lib/types';
import { keystoreManager } from '../store/keystore';
import { manifestStore } from '../store/manifest';
import { useManifestQuery, type ManifestApiResponse } from './useManifestQuery';

export type SaveManifestInput = {
    manifest: ManifestV1;
    etag: string;
    serverVersion: number;
};

export type ManifestSaveResponse = {
    vault_id: string;
    version: number;
    etag: string;
    updated_at: number;
};

export function useManifestMutation() {
    const queryClient = useQueryClient();
    const manifestQuery = useManifestQuery();

    // Conflict resolution handler - auto-merge and retry
    const handleConflict = async (context: { userId: string; vaultId: string }) => {
        // Fetch latest server version
        const response = await apiClient<ManifestApiResponse>('/vault/manifest');
        const { nonce, ciphertext, etag, version } = response.data;

        // Decrypt latest server manifest
        const mak = await keystoreManager.getMAK();
        const aadContext = await keystoreManager.getAadContext();
        if (!mak || !aadContext) {
            throw new Error('Keys not available for conflict resolution');
        }

        const aadManifest = new TextEncoder().encode(constructAadManifest(aadContext.userId, aadContext.vaultId));
        const plaintext = decryptAEAD(fromBase64(ciphertext), fromBase64(nonce), mak, aadManifest);
        const manifestText = new TextDecoder().decode(plaintext);

        let latestManifest: ManifestV1;
        try {
            latestManifest = JSON.parse(manifestText);
            if (!latestManifest.items || !Array.isArray(latestManifest.items)) {
                latestManifest.items = [];
            }
            if (!latestManifest.version) {
                latestManifest.version = version;
            }
        } catch (err) {
            latestManifest = { version, items: [], tags: [] };
        }
        zeroize(plaintext);

        // Get current state
        const currentState = manifestStore.getState();
        if (!currentState.manifest || !currentState.lastKnownServerSnapshot) {
            throw new Error('Invalid state for conflict resolution');
        }

        // Perform 3-way merge
        const mergeInput: ThreeWayMergeInput = {
            base: currentState.lastKnownServerSnapshot,
            local: currentState.manifest,
            remote: latestManifest,
        };
        const resolution = threeWayMerge(mergeInput);

        // Auto-merge and update manifest
        manifestStore.load({
            manifest: resolution.merged,
            etag,
            version,
        }, latestManifest);
    };

    return useMutation<ManifestSaveResponse, ApiError, SaveManifestInput>({
        mutationKey: ['vault', 'manifest', 'save'],
        mutationFn: async (input) => {
            const mak = await keystoreManager.getMAK();
            const aadContext = await keystoreManager.getAadContext();
            if (!mak || !aadContext) {
                throw new Error('Keys not available');
            }

            const aadManifest = new TextEncoder().encode(constructAadManifest(aadContext.userId, aadContext.vaultId));
            const { nonce, ciphertext } = encryptAEAD(
                new TextEncoder().encode(JSON.stringify(input.manifest)),
                mak,
                aadManifest
            );

            const response = await apiClient<ManifestSaveResponse>('/vault/manifest', {
                method: 'PUT',
                headers: { 'If-Match': input.etag },
                body: {
                    version: input.serverVersion,
                    nonce: toBase64(nonce),
                    ciphertext: toBase64(ciphertext),
                }
            });

            zeroize(nonce, ciphertext);
            return response.data;
        },
        onError: async (error, input, context) => {
            if (error.status === 409) {
                // Conflict - try to resolve and retry
                const mak = await keystoreManager.getMAK();
                const aadContext = await keystoreManager.getAadContext();
                if (mak && aadContext) {
                    await handleConflict(aadContext);

                    // Retry with updated data
                    const retryData = manifestStore.getSaveData();
                    if (!retryData) {
                        throw new Error('No data to retry');
                    }

                    // Re-encrypt with updated manifest
                    const aadManifest = new TextEncoder().encode(constructAadManifest(aadContext.userId, aadContext.vaultId));
                    const { nonce, ciphertext } = encryptAEAD(
                        new TextEncoder().encode(JSON.stringify(retryData.manifest)),
                        mak,
                        aadManifest
                    );

                    const retryNextVersion = retryData.serverVersion + 1;
                    const retryResponse = await apiClient<ManifestSaveResponse>('/vault/manifest', {
                        method: 'PUT',
                        headers: { 'If-Match': retryData.etag },
                        body: {
                            version: retryNextVersion,
                            nonce: toBase64(nonce),
                            ciphertext: toBase64(ciphertext),
                        }
                    });
                    zeroize(nonce, ciphertext);
                    return retryResponse.data;
                }
            }
            throw error;
        },
        onSuccess: (data) => {
            manifestStore.ackSaved({ etag: data.etag, version: data.version });
        },
    });
}
