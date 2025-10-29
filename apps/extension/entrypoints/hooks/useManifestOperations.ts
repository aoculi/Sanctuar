/**
 * Manifest operations hook - handles loading, saving, and state management
 */
import { useEffect, useRef, useState } from 'react';
import { constructAadManifest } from '../lib/constants';
import { decryptAEAD, fromBase64, zeroize } from '../lib/crypto';
import type { ManifestV1 } from '../lib/types';
import { keystoreManager } from '../store';
import { manifestStore, type ManifestStoreState } from '../store/manifest';
import { useManifestMutation } from './useManifestMutation';
import { useManifestQuery } from './useManifestQuery';

export function useManifestOperations() {
    const query = useManifestQuery();
    const mutation = useManifestMutation();
    const [storeState, setStoreState] = useState<ManifestStoreState>(() => manifestStore.getState());
    const mutateRef = useRef<(() => void) | undefined>(undefined);

    // Subscribe to store changes
    useEffect(() => {
        const unsubscribe = manifestStore.subscribe(() => {
            setStoreState(manifestStore.getState());
        });
        return unsubscribe;
    }, []);

    // Handle successful query
    const handleQuerySuccess = async (data: any) => {
        const mak = await keystoreManager.getMAK();
        const aadContext = await keystoreManager.getAadContext();
        if (!mak || !aadContext) {
            throw new Error('Keys not available for decryption');
        }

        const aadManifest = new TextEncoder().encode(constructAadManifest(aadContext.userId, aadContext.vaultId));
        const plaintext = decryptAEAD(fromBase64(data.ciphertext), fromBase64(data.nonce), mak, aadManifest);
        const manifestText = new TextDecoder().decode(plaintext);

        let manifest: ManifestV1;
        try {
            manifest = JSON.parse(manifestText);
            if (!manifest.items || !Array.isArray(manifest.items)) {
                manifest.items = [];
            }
            if (!manifest.tags || !Array.isArray(manifest.tags)) {
                manifest.tags = [];
            }
            if (!manifest.version) {
                manifest.version = data.version;
            }
        } catch (err) {
            manifest = { version: data.version, items: [], tags: [] };
        }
        zeroize(plaintext);

        manifestStore.load({
            manifest,
            etag: data.etag,
            version: data.version,
        });
    };

    // Autosave with debounce (800ms after last edit)
    useEffect(() => {
        if (storeState.status === 'dirty' && mutateRef.current) {
            const timeoutId = setTimeout(() => {
                // Only trigger mutate if not already saving
                if (manifestStore.getState().status === 'dirty' && mutateRef.current && !mutation.isPending) {
                    mutateRef.current();
                }
            }, 800);

            return () => clearTimeout(timeoutId);
        }
    }, [storeState.status, storeState.manifest, mutation.isPending]);

    // Before unload: try best-effort save
    useEffect(() => {
        const handleBeforeUnload = () => {
            const state = manifestStore.getState();
            if (state.status === 'dirty' && mutateRef.current) {
                mutateRef.current(); // Best-effort sync save (don't await)
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Set up mutation ref
    useEffect(() => {
        mutateRef.current = () => {
            const saveData = manifestStore.getSaveData();
            if (saveData) {
                mutation.mutate(saveData);
            }
        };
    }, [mutation]);

    return { query, mutation, store: storeState };
}
