/**
 * Vault prefetch utilities
 */
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from './api';

const QUERY_KEYS = {
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

/**
 * Prefetches vault and manifest data after successful authentication
 * Handles the case where manifest might not exist yet (404)
 */
export async function prefetchVaultData(queryClient: QueryClient) {
    // Prefetch vault data
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.vault(),
        queryFn: () => apiClient('/vault').then(r => r.data),
    });

    // Check if manifest exists before prefetching (to avoid 404 for new users)
    const vaultData = queryClient.getQueryData<{ has_manifest?: boolean }>(QUERY_KEYS.vault());
    if (vaultData?.has_manifest) {
        await queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.manifest(),
            queryFn: async () => {
                try {
                    const response = await apiClient('/vault/manifest');
                    return response.data;
                } catch (error: any) {
                    // Handle 404 gracefully - manifest doesn't exist yet
                    if (error?.status === 404) {
                        return null;
                    }
                    throw error;
                }
            },
        });
    }
}
