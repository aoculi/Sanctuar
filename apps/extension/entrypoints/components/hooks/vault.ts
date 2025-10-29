import { useQuery } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../api';

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

export function useManifest() {
    const vaultMeta = useVaultMeta();

    return useQuery({
        queryKey: QUERY_KEYS.manifest(),
        queryFn: async () => {
            try {
                const response = await apiClient('/vault/manifest');
                return response.data;
            } catch (error) {
                // Handle 404 gracefully - manifest doesn't exist yet for new users
                const apiError = error as ApiError;
                if (apiError.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        enabled: vaultMeta.isSuccess && vaultMeta.data?.has_manifest === true,
        staleTime: 30_000,
    });
}
