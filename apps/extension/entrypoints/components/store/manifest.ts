import type { ManifestV1 } from '../../lib/types';

export type ManifestStatus = 'idle' | 'loaded' | 'dirty' | 'saving' | 'offline';

export type ManifestStoreState = {
    manifest: ManifestV1 | null;
    etag: string | null;
    serverVersion: number;
    status: ManifestStatus;
    lastKnownServerSnapshot: ManifestV1 | null; // For 3-way merge
};

export type ManifestUpdater = (manifest: ManifestV1) => ManifestV1;

export type LoadManifestData = {
    manifest: ManifestV1;
    etag: string;
    version: number;
};

export type AckSavedData = {
    etag: string;
    version: number;
};

/**
 * ManifestStore - In-memory manifest state management
 *
 * Keeps decrypted manifest out of React Query cache to avoid accidental persistence.
 * Only encrypted payloads should be cached at the network layer.
 */
class ManifestStore {
    private state: ManifestStoreState = {
        manifest: null,
        etag: null,
        serverVersion: 0,
        status: 'idle',
        lastKnownServerSnapshot: null,
    };

    private listeners: Set<() => void> = new Set();

    getState(): ManifestStoreState {
        return { ...this.state };
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    load(data: LoadManifestData, baseSnapshot?: ManifestV1): void {
        this.state = {
            manifest: data.manifest,
            etag: data.etag,
            serverVersion: data.version,
            status: 'loaded',
            lastKnownServerSnapshot: baseSnapshot ? { ...baseSnapshot } : { ...data.manifest },
        };
        this.notify();
    }

    markDirty(): void {
        if (this.state.status === 'loaded' || this.state.status === 'offline') {
            this.state.status = 'dirty';
            this.notify();
        }
    }

    apply(updater: ManifestUpdater): void {
        if (this.state.manifest) {
            this.state.manifest = updater(this.state.manifest);
            this.markDirty();
        }
    }

    setSaving(): void {
        if (this.state.status === 'dirty' || this.state.status === 'offline') {
            this.state.status = 'saving';
            this.notify();
        }
    }

    setOffline(): void {
        if (this.state.status === 'dirty' || this.state.status === 'saving') {
            this.state.status = 'offline';
            this.notify();
        }
    }

    ackSaved(data: AckSavedData): void {
        this.state.etag = data.etag;
        this.state.serverVersion = data.version;
        this.state.status = 'loaded';
        if (this.state.manifest) {
            this.state.lastKnownServerSnapshot = { ...this.state.manifest };
        }
        this.notify();
    }

    reset(): void {
        this.state = {
            manifest: null,
            etag: null,
            serverVersion: 0,
            status: 'idle',
            lastKnownServerSnapshot: null,
        };
        this.notify();
    }

    getSaveData(): { manifest: ManifestV1; etag: string; serverVersion: number } | null {
        if (!this.state.manifest || !this.state.etag) {
            return null;
        }
        return {
            manifest: this.state.manifest,
            etag: this.state.etag,
            serverVersion: this.state.serverVersion,
        };
    }
}

export const manifestStore = new ManifestStore();
