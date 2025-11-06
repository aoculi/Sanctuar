/**
 * API client for secure extension
 */

import { keystoreManager } from "../store/keystore";
import { sessionManager } from "../store/session";
import { settingsStore } from "../store/settings";

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

async function getApiUrl(): Promise<string> {
  const settings = await settingsStore.getState();
  if (!settings.apiUrl || settings.apiUrl.trim() === "") {
    throw {
      status: -1,
      message:
        "API URL is not configured. Please set the API Base URL in Settings.",
      details:
        "The API URL must be defined in the extension settings before making API calls.",
    } as ApiError;
  }
  return settings.apiUrl.trim();
}

async function buildUrl(path: string): Promise<string> {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const apiUrl = await getApiUrl();
  return `${apiUrl}${path}`;
}

async function getAuthHeader(): Promise<string | undefined> {
  const session = await sessionManager.getSession();
  return session?.token ? `Bearer ${session.token}` : undefined;
}

export async function apiClient<T = unknown>(
  path: string,
  options: ApiClientOptions = {}
): Promise<ApiSuccess<T>> {
  const { method = "GET", headers = {}, body, signal } = options;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...headers,
  };

  // Add auth header if available
  const authHeader = await getAuthHeader();
  if (authHeader) {
    requestHeaders["Authorization"] = authHeader;
  }

  let requestBody: string | undefined;
  if (body !== undefined) {
    requestBody = JSON.stringify(body);
  }

  let response: Response;

  try {
    const url = await buildUrl(path);
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal,
      credentials: "omit",
      mode: "cors",
    });
  } catch (err: any) {
    // If it's already an ApiError (like missing API URL), re-throw it
    if (err?.status === -1 && err?.message?.includes("API URL")) {
      throw err as ApiError;
    }
    throw {
      status: -1,
      message: "Network error",
      details: err?.message,
    } as ApiError;
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

  // Handle 401 - clear session, keystore, and notify
  // Global 401 handler clears keys and redirects to /login
  if (response.status === 401) {
    await sessionManager.clearSession();
    await keystoreManager.zeroize();
    sessionManager.notifyListeners();
    throw {
      status: 401,
      message: data?.message || data?.error || "Unauthorized",
      details: data?.details,
    } as ApiError;
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: data?.message || data?.error || "Request failed",
      details: data?.details,
    } as ApiError;
  }

  return {
    data: data as T,
    status: response.status,
  };
}
