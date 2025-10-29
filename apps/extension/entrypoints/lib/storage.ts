/**
 * Storage utilities for persisting file handle references
 * Uses chrome.storage.local to store non-sensitive data
 */

import { STORAGE_KEYS } from './constants';

/**
 * Store file handle reference
 * Note: We can't directly store FileSystemFileHandle, but we can store
 * it in IndexedDB via the browser's internal serialization
 */
export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void> {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    await promisifyRequest(store.put(handle, STORAGE_KEYS.FILE_HANDLE_REF));
}

/**
 * Retrieve stored file handle
 */
export async function getFileHandle(): Promise<FileSystemFileHandle | null> {
    try {
        const db = await openHandleDB();
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        const handle = await promisifyRequest(store.get(STORAGE_KEYS.FILE_HANDLE_REF));

        if (!handle) {
            return null;
        }

        // Verify we still have permission
        const permission = await (handle as FileSystemFileHandle).queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
            return handle as FileSystemFileHandle;
        }

        // Try to request permission again
        const requestPermission = await (handle as FileSystemFileHandle).requestPermission({ mode: 'readwrite' });
        if (requestPermission === 'granted') {
            return handle as FileSystemFileHandle;
        }

        // Permission denied, clear the handle
        await clearFileHandle();
        return null;
    } catch (error) {
        console.error('Error retrieving file handle:', error);
        return null;
    }
}

/**
 * Clear stored file handle
 */
export async function clearFileHandle(): Promise<void> {
    try {
        const db = await openHandleDB();
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        await promisifyRequest(store.delete(STORAGE_KEYS.FILE_HANDLE_REF));
    } catch (error) {
        console.error('Error clearing file handle:', error);
    }
}

/**
 * Store vault UUID (for quick reference)
 */
export async function storeVaultUuid(uuid: string): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT_UUID]: uuid });
}

/**
 * Get stored vault UUID
 */
export async function getVaultUuid(): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT_UUID);
    return result[STORAGE_KEYS.VAULT_UUID] || null;
}

/**
 * Clear stored vault UUID
 */
export async function clearVaultUuid(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.VAULT_UUID);
}

/**
 * Clear all stored data
 */
export async function clearAllStorage(): Promise<void> {
    await clearFileHandle();
    await clearVaultUuid();
}

/**
 * Check if vault is configured (has stored file handle)
 */
export async function isVaultConfigured(): Promise<boolean> {
    const handle = await getFileHandle();
    return handle !== null;
}

// IndexedDB helper for storing file handles
function openHandleDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VaultHandles', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
        };
    });
}

// Promisify IDBRequest
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

