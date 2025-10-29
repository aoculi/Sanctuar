/**
 * Main vault hook - coordinates all vault operations
 */
import { useManifestOperations } from './useManifestOperations';

export function useManifest() {
    return useManifestOperations();
}