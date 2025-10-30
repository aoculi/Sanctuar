/**
 * Manifest operations hook - handles loading, saving, and state management
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { decryptManifest } from '../lib/manifestUtils';
import { keystoreManager } from '../store/keystore';
import { manifestStore, type ManifestStoreState } from '../store/manifest';
import { useManifestMutation } from './useManifestMutation';
import { useManifestQuery } from './useManifestQuery';

export function useManifestOperations() {
    const queryClient = useQueryClient();
    const query = useManifestQuery();
    const mutation = useManifestMutation();
    const [storeState, setStoreState] = useState<ManifestStoreState>(() => manifestStore.getState());
    const mutateRef = useRef<(() => void) | undefined>(undefined);
    const isSavingRef = useRef(false);

    // Subscribe to store changes
    useEffect(() => {
        const unsubscribe = manifestStore.subscribe(() => {
            setStoreState(manifestStore.getState());
        });
        return unsubscribe;
    }, []);

    // Autosave with debounce (800ms after last edit)
    useEffect(() => {
        if (storeState.status === 'dirty' && mutateRef.current) {
            const timeoutId = setTimeout(() => {
                // Only trigger mutate if not already saving
                if (manifestStore.getState().status === 'dirty' && mutateRef.current && !mutation.isPending && !isSavingRef.current) {
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
            if (isSavingRef.current) return;
            const saveData = manifestStore.getSaveData();
            if (saveData) {
                isSavingRef.current = true;
                manifestStore.setSaving();
                mutation.mutate(saveData, {
                    onSettled: () => {
                        isSavingRef.current = false;
                    },
                });
            }
        };
    }, [mutation]);

    // Bootstrap manifest on mount; retry briefly until keystore is unlocked
    useEffect(() => {
        let cancelled = false;
        let retryTimer: number | null = null;
        let attempts = 0;
        const maxAttempts = 15; // ~4.5s total with 300ms interval

        const tryBootstrap = async () => {
            if (cancelled) return;
            try {
                const isUnlocked = await keystoreManager.isUnlocked();
                const current = manifestStore.getState();
                if (!isUnlocked) {
                    if (!cancelled && attempts < maxAttempts) {
                        attempts += 1;
                        retryTimer = (setTimeout(tryBootstrap, 300) as unknown) as number;
                    }
                    return;
                }
                if (current.manifest) {
                    return;
                }

                // Check react-query cache first, else fetch
                const cached = queryClient.getQueryData<any>(['vault', 'manifest']);
                const data = cached ?? (await (async () => {
                    const result = await query.refetch();
                    return result.data as any;
                })());
                if (data) {
                    try {
                        const manifest = await decryptManifest(data);
                        manifestStore.load({ manifest, etag: data.etag, version: data.version });
                    } catch (decryptErr) {
                        if (!cancelled && attempts < maxAttempts) {
                            attempts += 1;
                            retryTimer = (setTimeout(tryBootstrap, 300) as unknown) as number;
                        }
                        return;
                    }
                } else {
                    manifestStore.load({ manifest: { version: 0, items: [], tags: [] }, etag: null as unknown as string, version: 0 });
                }
            } catch (e: any) {
                if (e?.status === 404) {
                    manifestStore.load({ manifest: { version: 0, items: [], tags: [] }, etag: null as unknown as string, version: 0 });
                } else if (!cancelled && attempts < maxAttempts) {
                    attempts += 1;
                    retryTimer = (setTimeout(tryBootstrap, 300) as unknown) as number;
                }
            }
        };

        tryBootstrap();
        return () => {
            cancelled = true;
            if (retryTimer != null) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
        };
        // We intentionally run this only once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { query, mutation, store: storeState };
}
