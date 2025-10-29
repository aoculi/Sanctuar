import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';
import { authStore, sessionManager, type KdfParams } from '../store';

// Query keys
const QUERY_KEYS = {
    session: () => ['auth', 'session'] as const,
    vault: () => ['vault'] as const,
    manifest: () => ['vault', 'manifest'] as const,
};

// Types
export type LoginInput = {
    login: string;
    password: string;
};

export type LoginResponse = {
    user_id: string;
    token: string;
    expires_at: number;
    kdf: KdfParams;
    wrapped_mk: string | null;
};

export type SessionResponse = {
    user_id: string;
    valid: boolean;
    expires_at: number;
};

// Auth hooks
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation<LoginResponse, Error, LoginInput>({
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
            await Promise.allSettled([
                queryClient.prefetchQuery({
                    queryKey: QUERY_KEYS.vault(),
                    queryFn: () => apiClient('/vault').then(r => r.data),
                }),
                queryClient.prefetchQuery({
                    queryKey: QUERY_KEYS.manifest(),
                    queryFn: () => apiClient('/vault/manifest').then(r => r.data),
                }),
            ]);
        },
    });
}

export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, void>({
        mutationKey: ['auth', 'logout'],
        mutationFn: async () => {
            try {
                await apiClient('/auth/logout', { method: 'POST' });
            } catch (err: any) {
                // Ignore 401 errors during logout
                if (err?.status !== 401) {
                    throw err;
                }
            }
        },
        onSettled: async () => {
            // Clear all auth data
            await sessionManager.clearSession();
            authStore.clear();
            queryClient.clear();
        },
    });
}

export function useSession() {
    return useQuery<SessionResponse>({
        queryKey: QUERY_KEYS.session(),
        queryFn: async () => {
            const response = await apiClient<SessionResponse>('/auth/session');
            return response.data;
        },
        enabled: false, // Only run when explicitly called
        staleTime: 0,
    });
}
