import { useCallback } from "react";

import {
  estimateManifestSize,
  isManifestSizeWarning,
  validateBookmarkInput,
  validateTagName,
} from "@/entrypoints/lib/validation";

/**
 * Hook for bookmark validation
 */
export function useBookmarkValidation() {
  const validateBookmark = useCallback(
    (data: { url: string; title: string; picture: string; tags: string[] }) => {
      return validateBookmarkInput(data);
    },
    [],
  );

  return { validateBookmark };
}

/**
 * Hook for tag validation
 */
export function useTagValidation() {
  const validateTag = useCallback((name: string) => {
    return validateTagName(name);
  }, []);

  return { validateTag };
}

/**
 * Hook for manifest size monitoring
 */
export function useManifestSize(
  manifest: {
    version: number;
    items: unknown[];
    tags?: unknown[];
    chain_head?: string;
  } | null,
) {
  const size = manifest ? estimateManifestSize(manifest) : 0;
  const showWarning = isManifestSizeWarning(size);

  return { size, showWarning };
}
