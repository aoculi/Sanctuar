/**
 * Logout hook
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { authStore } from '../store/auth';
import { keystoreManager } from '../store/keystore';
import { sessionManager } from '../store/session';

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
            // Clear keystore (keys are already zeroized in background.ts)
            await keystoreManager.zeroize();
            queryClient.clear();
        },
    });
}
