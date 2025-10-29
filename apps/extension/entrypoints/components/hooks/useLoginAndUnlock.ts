/**
 * Combined login + unlock hook
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../api';
import { useUnlock } from './unlock';
import { useLogin } from './useLogin';

const QUERY_KEYS = {
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

export type LoginInput = {
    login: string;
    password: string;
};

export function useLoginAndUnlock() {
    const queryClient = useQueryClient();
    const loginMutation = useLogin();
    const unlockMutation = useUnlock();

    return useMutation<{ loginData: any; unlockData: { success: boolean; isFirstUnlock: boolean } }, ApiError, LoginInput>({
        mutationKey: ['auth', 'loginAndUnlock'],
        mutationFn: async (input: LoginInput) => {
            // First perform login
            const loginData = await loginMutation.mutateAsync(input);

            // Then perform unlock
            const unlockData = await unlockMutation.mutateAsync({
                password: input.password,
                userId: loginData.user_id,
                vaultId: loginData.user_id // Using user_id as vault_id for simplicity
            });

            return { loginData, unlockData };
        },
        onSuccess: async (data) => {
            // Prefetch vault data after successful unlock
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
