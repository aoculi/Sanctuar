/**
 * Manifest size monitoring hook
 */
import { useManifestSize } from './validation';

export function useManifestSizeWarning(manifest: {
    version: number;
    items: unknown[];
    tags?: unknown[];
    chain_head?: string
} | null) {
    return useManifestSize(manifest);
}
