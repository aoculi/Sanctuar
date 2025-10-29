// Session management for secure extension
// Handles communication with background service worker

export type SessionData = {
    userId: string;
    expiresAt: number;
    token: string;
};

// Background service worker communication
async function sendToBackground<T = any>(message: any): Promise<T> {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response);
            });
        } catch {
            resolve(null as T);
        }
    });
}

// Session management - single source of truth in background
export class SessionManager {
    private listeners = new Set<() => void>();
    private initialized = false;

    private initListeners(): void {
        if (this.initialized) return;
        this.initialized = true;

        chrome.runtime.onMessage.addListener((message) => {
            if (message?.type === 'auth:unauthorized' || message?.type === 'session:expired') {
                this.notifyListeners();
            }
        });
    }

    async getSession(): Promise<SessionData | null> {
        this.initListeners();
        const response = await sendToBackground({ type: 'session:get' });
        return response?.session || null;
    }

    async setSession(session: SessionData): Promise<boolean> {
        const response = await sendToBackground({
            type: 'session:set',
            payload: session
        });
        return Boolean(response?.ok);
    }

    async clearSession(): Promise<boolean> {
        const response = await sendToBackground({ type: 'session:clear' });
        return Boolean(response?.ok);
    }

    onUnauthorized(callback: () => void): () => void {
        this.initListeners();
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(): void {
        this.listeners.forEach(callback => {
            try { callback(); } catch { /* ignore */ }
        });
    }
}

export const sessionManager = new SessionManager();
