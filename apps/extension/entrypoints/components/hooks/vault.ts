import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { threeWayMerge, type ThreeWayMergeInput } from '../../lib/conflictResolution';
import { constructAadManifest } from '../../lib/constants';
import { decryptAEAD, encryptAEAD, fromBase64, toBase64, zeroize } from '../../lib/crypto';
import type { VaultManifest } from '../../lib/types';
import { apiClient, type ApiError } from '../api';
import { keystoreManager } from '../store';
import { manifestStore, type ManifestStoreState } from '../store/manifest';

const QUERY_KEYS = {
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

export type VaultMetadata = {
    vault_id: string;
    version: number;
    bytes_total: number;
    has_manifest: boolean;
    updated_at: number;
};

export type ManifestQueryResponse = {
    manifest: VaultManifest;
    etag: string;
    serverVersion: number;
};

export type ManifestApiResponse = {
    vault_id: string;
    version: number;
    etag: string;
    nonce: string;
    ciphertext: string;
    size?: number;
    updated_at: number;
};

export type ManifestSaveResponse = {
    vault_id: string;
    version: number;
    etag: string;
    updated_at: number;
};

export type SaveManifestInput = {
    manifest: VaultManifest;
    etag: string;
    serverVersion: number;
};

export function useVaultMeta() {
    return useQuery<VaultMetadata>({
        queryKey: QUERY_KEYS.vault(),
        queryFn: async () => {
            const response = await apiClient<VaultMetadata>('/vault');
            return response.data;
        },
        staleTime: 30_000,
    });
}

/**
 * useManifest - Load, decrypt, and keep an in-memory manifest
 * Returns both query and mutation hooks for manifest operations
 *
 * Uses manifestStore to keep decrypted manifest out of React Query cache.
 * Only encrypted payloads are cached at the network layer.
 *
 * Query (C1):
 * - GET /vault/manifest
 * - If 404 → treat as "no manifest yet" (return empty manifest)
 * - Else: decrypt using MAK from keystore
 * - Load into manifestStore
 *
 * Mutation:
 * - Re-encrypt and PUT with optimistic concurrency
 * - OnError (409): Triggers conflict resolution flow with 3-way merge
 *
 * Returns: { query, mutation, store }
 */
export function useManifest() {
    const queryClient = useQueryClient();
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isCheckingUnlock, setIsCheckingUnlock] = useState(true);
    const [aadContext, setAadContext] = useState<{ userId: string; vaultId: string } | null>(null);
    const [storeState, setStoreState] = useState<ManifestStoreState>(manifestStore.getState());

    // Check keystore unlock status
    useEffect(() => {
        const checkUnlock = async () => {
            try {
                const unlocked = await keystoreManager.isUnlocked();
                setIsUnlocked(unlocked);

                if (unlocked) {
                    const context = await keystoreManager.getAadContext();
                    if (context) {
                        setAadContext({
                            userId: context.userId,
                            vaultId: context.vaultId
                        });
                    }
                }
            } catch (error) {
                setIsUnlocked(false);
            } finally {
                setIsCheckingUnlock(false);
            }
        };

        checkUnlock();
    }, []);

    // Subscribe to manifest store changes
    useEffect(() => {
        const unsubscribe = manifestStore.subscribe(() => {
            setStoreState(manifestStore.getState());
        });
        return unsubscribe;
    }, []);

    // Query: Load and decrypt manifest (only for network layer)
    const query = useQuery<ManifestApiResponse | null>({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: async () => {
            if (!isUnlocked || !aadContext) {
                throw new Error('Keystore is locked');
            }

            try {
                // GET /vault/manifest
                const response = await apiClient<ManifestApiResponse>('/vault/manifest');
                return response.data;
            } catch (error) {
                // Handle 404 → treat as "no manifest yet"
                const apiError = error as ApiError;
                if (apiError.status === 404) {
                    return null; // No manifest yet
                }
                throw error;
            }
        },
        enabled: !isCheckingUnlock && isUnlocked && aadContext !== null,
        staleTime: 0,
        retry: 0,
        refetchOnWindowFocus: false,
    });

    // Handle query success - decrypt and load into store
    useEffect(() => {
        const handleQuerySuccess = async () => {
            if (!query.data || !aadContext) return;

            const data = query.data;

            if (data) {
                // Decrypt manifest and load into store
                const nonce = fromBase64(data.nonce);
                const ciphertext = fromBase64(data.ciphertext);

                // Get MAK from keystore
                const mak = await keystoreManager.getMAK();

                // Construct AAD for manifest
                const aadManifest = new TextEncoder().encode(
                    constructAadManifest(aadContext.userId, aadContext.vaultId)
                );

                // Decrypt: plaintext = AEAD_DEC(ciphertext, AAD_MANIFEST, nonce, MAK)
                const plaintext = decryptAEAD(ciphertext, nonce, mak, aadManifest);

                // Parse manifest JSON
                const manifestText = new TextDecoder().decode(plaintext);
                const manifest: VaultManifest = JSON.parse(manifestText);

                // Load into manifest store
                manifestStore.load({
                    manifest,
                    etag: data.etag,
                    version: data.version
                });
            } else {
                // No manifest yet - load empty manifest
                manifestStore.load({
                    manifest: {
                        version_counter: 0,
                        book_index: [],
                        chain_head: ''
                    } as VaultManifest,
                    etag: '',
                    version: 0
                });
            }
        };

        if (query.isSuccess) {
            handleQuerySuccess();
        }
    }, [query.isSuccess, query.data, aadContext]);

    // Mutation: Save manifest with conflict resolution
    const mutation = useMutation<ManifestSaveResponse, ApiError, void>({
        mutationKey: ['vault', 'manifest', 'save'],
        mutationFn: async () => {
            const saveData = manifestStore.getSaveData();
            if (!saveData || !aadContext) {
                throw new Error('No manifest data to save or AAD context not available');
            }

            const { manifest, etag, serverVersion } = saveData;

            // Get MAK from keystore
            const mak = await keystoreManager.getMAK();

            // Construct AAD for manifest
            const aadManifest = new TextEncoder().encode(
                constructAadManifest(aadContext.userId, aadContext.vaultId)
            );

            // Serialize manifest to JSON
            const manifestJson = JSON.stringify(manifest);
            const plaintext = new TextEncoder().encode(manifestJson);

            // Encrypt: nonce = RNG(24B), ciphertext = AEAD_ENC(plaintext, AAD_MANIFEST, nonce, MAK)
            const { nonce, ciphertext } = encryptAEAD(plaintext, mak, aadManifest);

            // Zeroize plaintext immediately after encryption
            zeroize(plaintext);

            // Compute nextVersion = serverVersion + 1 (or 1 if first save)
            const nextVersion = serverVersion === 0 ? 1 : serverVersion + 1;

            // Convert to base64
            const nonceBase64 = toBase64(nonce);
            const ciphertextBase64 = toBase64(ciphertext);

            // Zeroize nonce and ciphertext arrays (they're encoded now)
            zeroize(nonce, ciphertext);

            // Prepare headers
            const headers: Record<string, string> = {};

            // If not the first write, add If-Match: <etag>
            if (nextVersion > 1 && etag) {
                headers['If-Match'] = etag;
            }

            try {
                // PUT /vault/manifest
                const response = await apiClient<ManifestSaveResponse>('/vault/manifest', {
                    method: 'PUT',
                    headers,
                    body: {
                        version: nextVersion,
                        nonce: nonceBase64,
                        ciphertext: ciphertextBase64,
                    }
                });

                return response.data;
            } catch (error) {
                const apiError = error as ApiError;

                // OnError (409 Conflict): Auto-merge and retry
                if (apiError.status === 409) {
                    await handleConflict(aadContext);
                    // Retry save with merged manifest
                    const retryData = manifestStore.getSaveData();
                    if (retryData) {
                        // Re-encrypt merged manifest
                        const retryMak = await keystoreManager.getMAK();
                        const retryAadManifest = new TextEncoder().encode(
                            constructAadManifest(aadContext.userId, aadContext.vaultId)
                        );
                        const retryJson = JSON.stringify(retryData.manifest);
                        const retryPlaintext = new TextEncoder().encode(retryJson);
                        const { nonce: retryNonce, ciphertext: retryCiphertext } = encryptAEAD(retryPlaintext, retryMak, retryAadManifest);
                        zeroize(retryPlaintext);

                        const retryNextVersion = retryData.serverVersion + 1;
                        const retryResponse = await apiClient<ManifestSaveResponse>('/vault/manifest', {
                            method: 'PUT',
                            headers: { 'If-Match': retryData.etag },
                            body: {
                                version: retryNextVersion,
                                nonce: toBase64(retryNonce),
                                ciphertext: toBase64(retryCiphertext),
                            }
                        });
                        zeroize(retryNonce, retryCiphertext);
                        return retryResponse.data;
                    }
                }

                throw error;
            }
        },
        onSuccess: (data) => {
            manifestStore.ackSaved({
                etag: data.etag,
                version: data.version
            });
        },
    });

    // Conflict resolution handler - auto-merge and retry
    const handleConflict = async (context: { userId: string; vaultId: string }) => {
        // Fetch latest server version
        const response = await apiClient<ManifestApiResponse>('/vault/manifest');
        const { nonce, ciphertext, etag, version } = response.data;

        // Decrypt latest server manifest
        const nonceBytes = fromBase64(nonce);
        const ciphertextBytes = fromBase64(ciphertext);
        const mak = await keystoreManager.getMAK();
        const aadManifest = new TextEncoder().encode(
            constructAadManifest(context.userId, context.vaultId)
        );
        const plaintext = decryptAEAD(ciphertextBytes, nonceBytes, mak, aadManifest);
        const latestManifest: VaultManifest = JSON.parse(new TextDecoder().decode(plaintext));

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

        // Auto-merge and update manifest (prefer remote for conflicts)
        manifestStore.load({
            manifest: resolution.merged,
            etag,
            version,
        });
    };

    return {
        query,
        mutation,
        store: storeState,
    };
}
