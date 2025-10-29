import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { constructAadManifest } from '../../lib/constants';
import { decryptAEAD, encryptAEAD, fromBase64, toBase64, zeroize } from '../../lib/crypto';
import type { VaultManifest } from '../../lib/types';
import { apiClient, type ApiError } from '../api';
import { keystoreManager } from '../store';

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
 * Enabled only if keyStore.isUnlocked() === true
 *
 * Query (C1):
 * - GET /vault/manifest
 * - If 404 → treat as "no manifest yet" (return empty manifest)
 * - Else: decrypt using MAK from keystore
 * - Return { manifest, etag, serverVersion }
 *
 * Cache policy:
 * - staleTime: 0
 * - retry: 0
 * - refetchOnWindowFocus: false
 *
 * Mutation:
 * - Re-encrypt and PUT with optimistic concurrency
 * - Inputs: { manifest, etag, serverVersion }
 * - OnSuccess: Updates local copy and sync state
 * - OnError (409): Triggers conflict resolution flow
 *
 * Returns: { query, mutation }
 */
export function useManifest() {
    const queryClient = useQueryClient();
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isCheckingUnlock, setIsCheckingUnlock] = useState(true);
    const [aadContext, setAadContext] = useState<{ userId: string; vaultId: string } | null>(null);

    // Check keystore unlock status (shared by both query and mutation)
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

    // Query: Load and decrypt manifest
    const query = useQuery<ManifestQueryResponse | null>({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: async () => {
            if (!isUnlocked || !aadContext) {
                throw new Error('Keystore is locked');
            }

            try {
                // GET /vault/manifest
                const response = await apiClient<ManifestApiResponse>('/vault/manifest');

                // Decrypt manifest
                const nonce = fromBase64(response.data.nonce);
                const ciphertext = fromBase64(response.data.ciphertext);

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

                return {
                    manifest,
                    etag: response.data.etag,
                    serverVersion: response.data.version
                };
            } catch (error) {
                // Handle 404 → treat as "no manifest yet" (return empty manifest)
                const apiError = error as ApiError;
                if (apiError.status === 404) {
                    // 404 handling: produce an empty manifest (version 0 locally)
                    return {
                        manifest: {
                            version_counter: 0,
                            book_index: [],
                            chain_head: '' // Will be set on first save
                        } as VaultManifest,
                        etag: '',
                        serverVersion: 0
                    };
                }
                throw error;
            }
        },
        enabled: !isCheckingUnlock && isUnlocked && aadContext !== null,
        staleTime: 0,
        retry: 0,
        refetchOnWindowFocus: false,
    });

    // Mutation: Save manifest with optimistic concurrency
    const mutation = useMutation<ManifestSaveResponse, ApiError, SaveManifestInput>({
        mutationKey: ['vault', 'manifest', 'save'],
        mutationFn: async (input: SaveManifestInput) => {
            const { manifest, etag, serverVersion } = input;

            if (!aadContext) {
                throw new Error('AAD context not available');
            }

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

                // OnError (409 Conflict): Trigger conflict resolution flow (section E)
                if (apiError.status === 409) {
                    // TODO: Implement conflict resolution flow (section E)
                    throw {
                        status: apiError.status,
                        message: 'Conflict: Manifest has been modified by another client',
                        details: {
                            ...(apiError.details && typeof apiError.details === 'object' ? apiError.details : {}),
                            conflict: true
                        }
                    } as ApiError;
                }

                throw error;
            }
        },
        onSuccess: (data, variables) => {
            // Update local copy: manifest.version = returned.version
            const currentData = queryClient.getQueryData<ManifestQueryResponse | null>(
                QUERY_KEYS.manifest()
            );

            if (currentData) {
                // Update manifest version with returned version
                const updatedManifest = {
                    ...currentData.manifest,
                    version_counter: data.version
                };

                // Update query cache with new data
                queryClient.setQueryData<ManifestQueryResponse>(
                    QUERY_KEYS.manifest(),
                    {
                        manifest: updatedManifest,
                        etag: data.etag,
                        serverVersion: data.version
                    }
                );
            }

            // Store latest { etag, serverVersion: version } in sync state
            queryClient.setQueryData<{ etag: string; serverVersion: number }>(
                ['vault', 'manifest', 'sync'],
                {
                    etag: data.etag,
                    serverVersion: data.version
                }
            );
        },
    });

    return { query, mutation };
}
