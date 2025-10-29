// API client for secure extension
import { sessionManager } from '../store';

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:3000';

// Simplified API client
export type ApiClientOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
};

export type ApiSuccess<T = unknown> = {
    data: T;
    status: number;
};

export type ApiError = {
    status: number;
    message: string;
    details?: unknown;
};

function buildUrl(path: string): string {
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    return `${API_URL}${path}`;
}

async function getAuthHeader(): Promise<string | undefined> {
    const session = await sessionManager.getSession();
    return session?.token ? `Bearer ${session.token}` : undefined;
}

export async function apiClient<T = unknown>(path: string, options: ApiClientOptions = {}): Promise<ApiSuccess<T>> {
    const { method = 'GET', headers = {}, body, signal } = options;

    const requestHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers,
    };

    // Add auth header if available
    const authHeader = await getAuthHeader();
    if (authHeader) {
        requestHeaders['Authorization'] = authHeader;
    }

    let requestBody: string | undefined;
    if (body !== undefined) {
        requestBody = JSON.stringify(body);
    }

    let response: Response;

    try {
        response = await fetch(buildUrl(path), {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal,
            credentials: 'omit',
            mode: 'cors',
        });
    } catch (err: any) {
        throw { status: -1, message: 'Network error', details: err?.message } as ApiError;
    }

    let data: any = null;
    const text = await response.text();
    if (text.length > 0) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    // Handle 401 - clear session and notify
    if (response.status === 401) {
        await sessionManager.clearSession();
        sessionManager.notifyListeners();
        throw {
            status: 401,
            message: data?.message || data?.error || 'Unauthorized',
            details: data?.details,
        } as ApiError;
    }

    if (!response.ok) {
        throw {
            status: response.status,
            message: data?.message || data?.error || 'Request failed',
            details: data?.details,
        } as ApiError;
    }

    return {
        data: data as T,
        status: response.status,
    };
}
