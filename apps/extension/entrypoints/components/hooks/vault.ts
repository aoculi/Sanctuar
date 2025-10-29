import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

const QUERY_KEYS = {
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

export function useVaultMeta() {
    return useQuery({
        queryKey: QUERY_KEYS.vault(),
        queryFn: async () => {
            const response = await apiClient('/vault');
            return response.data;
        },
        staleTime: 30_000,
    });
}

export function useManifest() {
    return useQuery({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: async () => {
            const response = await apiClient('/vault/manifest');
            return response.data;
        },
        staleTime: 30_000,
    });
}
