/**
 * Combined login + unlock hook
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../lib/api';
import { prefetchVaultData } from '../lib/vaultPrefetch';
import { useUnlock } from './unlock';
import { useLogin } from './useLogin';

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
            await prefetchVaultData(queryClient);
        },
    });
}
