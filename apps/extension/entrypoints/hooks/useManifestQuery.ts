/**
 * Manifest query hook - handles loading and caching
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../lib/api';

const QUERY_KEYS = {
    manifest: () => ['vault', 'manifest'] as const,
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

export function useManifestQuery() {
    return useQuery<ManifestApiResponse, ApiError>({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: async () => {
            const response = await apiClient<ManifestApiResponse>('/vault/manifest');
            return response.data;
        },
        enabled: false, // Only run when explicitly called
        staleTime: 0,
    });
}
