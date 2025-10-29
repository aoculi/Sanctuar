/**
 * Session management hook
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

const QUERY_KEYS = {
    session: () => ['auth', 'session'] as const,
};

export type SessionResponse = {
    user_id: string;
    valid: boolean;
    expires_at: number;
};

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
