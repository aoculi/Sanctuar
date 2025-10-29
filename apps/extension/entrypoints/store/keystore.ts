/**
 * Keystore manager for secure extension
 * Handles communication with background service worker keystore
 */

export type AadContext = {
    userId: string;
    vaultId: string;
    wmkLabel: string;
    manifestLabel: string;
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

/**
 * Keystore manager - single source of truth in background service worker
 *
 * Security guarantees:
 * - Keys are NEVER persisted (never stored in chrome.storage/IDB/OPFS)
 * - Keys are NEVER stored in React Query cache
 * - Keys are ONLY stored in memory in the background service worker
 * - Keys are lost on popup close or SW suspend (by design)
 * - Keys are zeroized when session is cleared or on logout
 */
export class KeyStoreManager {
    /**
     * Set keys in the keystore
     * @param keys - Object containing MK, KEK, MAK, and aadContext
     */
    async setKeys(keys: {
        MK: Uint8Array;
        KEK: Uint8Array;
        MAK: Uint8Array;
        aadContext: AadContext;
    }): Promise<boolean> {
        // Convert Uint8Arrays to base64 strings for message passing
        const response = await sendToBackground({
            type: 'keystore:setKeys',
            payload: {
                MK: this.uint8ArrayToBase64(keys.MK),
                KEK: this.uint8ArrayToBase64(keys.KEK),
                MAK: this.uint8ArrayToBase64(keys.MAK),
                aadContext: keys.aadContext,
            },
        });
        return Boolean(response?.ok);
    }

    /**
     * Check if keystore is unlocked
     */
    async isUnlocked(): Promise<boolean> {
        const response = await sendToBackground({
            type: 'keystore:isUnlocked',
        });
        return Boolean(response?.unlocked);
    }

    /**
     * Securely zeroize all keys
     */
    async zeroize(): Promise<boolean> {
        const response = await sendToBackground({
            type: 'keystore:zeroize',
        });
        return Boolean(response?.ok);
    }

    /**
     * Get MAK (Manifest Auth Key)
     * @returns MAK as Uint8Array
     * @throws Error if keystore is locked
     */
    async getMAK(): Promise<Uint8Array> {
        const response = await sendToBackground({
            type: 'keystore:getMAK',
        });
        if (!response?.ok || !response.key) {
            throw new Error(response?.error || 'Failed to get MAK');
        }
        return this.base64ToUint8Array(response.key);
    }

    /**
     * Get KEK (Key Encryption Key)
     * @returns KEK as Uint8Array
     * @throws Error if keystore is locked
     */
    async getKEK(): Promise<Uint8Array> {
        const response = await sendToBackground({
            type: 'keystore:getKEK',
        });
        if (!response?.ok || !response.key) {
            throw new Error(response?.error || 'Failed to get KEK');
        }
        return this.base64ToUint8Array(response.key);
    }

    /**
     * Get AAD context
     */
    async getAadContext(): Promise<AadContext | null> {
        const response = await sendToBackground({
            type: 'keystore:getAadContext',
        });
        return response?.context || null;
    }

    /**
     * Helper to convert base64 string to Uint8Array
     */
    private base64ToUint8Array(base64: string): Uint8Array {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Helper to convert Uint8Array to base64 string
     */
    private uint8ArrayToBase64(arr: Uint8Array): string {
        // Handle large arrays by chunking to avoid stack overflow
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }
}

export const keystoreManager = new KeyStoreManager();
