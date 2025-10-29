/**
 * Login hook
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../lib/api';
import { authStore, sessionManager } from '../store';
import { useUnlock } from './unlock';

const QUERY_KEYS = {
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

export type LoginInput = {
    login: string;
    password: string;
};

export type LoginResponse = {
    user_id: string;
    token: string;
    expires_at: number;
    kdf: any;
    wrapped_mk: string | null;
};

export function useLogin() {
    const queryClient = useQueryClient();
    const unlockMutation = useUnlock();

    return useMutation<LoginResponse, ApiError, LoginInput>({
        mutationKey: ['auth', 'login'],
        mutationFn: async (input: LoginInput) => {
            const response = await apiClient<LoginResponse>('/auth/login', {
                method: 'POST',
                body: input,
            });
            return response.data;
        },
        onSuccess: async (data) => {
            // Store session in background service worker
            await sessionManager.setSession({
                token: data.token,
                userId: data.user_id,
                expiresAt: data.expires_at,
            });

            // Store sensitive auth data in memory
            authStore.setKdf(data.kdf);
            authStore.setWrappedMk(data.wrapped_mk);

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
        },
    });
}
