/**
 * Login hook
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiError } from '../lib/api';
import { prefetchVaultData } from '../lib/vaultPrefetch';
import { authStore } from '../store/auth';
import { sessionManager } from '../store/session';

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
            await prefetchVaultData(queryClient);
        },
    });
}
