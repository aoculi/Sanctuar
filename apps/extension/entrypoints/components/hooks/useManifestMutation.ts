import { useMutation } from "@tanstack/react-query";

import { apiClient, type ApiError } from "@/entrypoints/lib/api";
import {
  threeWayMerge,
  type ThreeWayMergeInput,
} from "@/entrypoints/lib/conflictResolution";
import { constructAadManifest } from "@/entrypoints/lib/constants";
import { encryptAEAD, uint8ArrayToBase64, zeroize } from "@/entrypoints/lib/crypto";
import { decryptManifest } from "@/entrypoints/lib/api";
import type { ManifestV1 } from "@/entrypoints/lib/types";
import { keystoreManager } from "@/entrypoints/store/keystore";
import { manifestStore } from "@/entrypoints/store/manifest";
import type { ManifestApiResponse } from "./useManifestQuery";

export type SaveManifestInput = {
  manifest: ManifestV1;
  etag: string | null;
  serverVersion: number;
};

export type ManifestSaveResponse = {
  vault_id: string;
  version: number;
  etag: string;
  updated_at: number;
};

export function useManifestMutation() {
  // Conflict resolution handler - auto-merge and retry
  const handleConflict = async (context: {
    userId: string;
    vaultId: string;
  }) => {
    // Fetch latest server version
    const response = await apiClient<ManifestApiResponse>("/vault/manifest");
    const { etag, version } = response.data;

    // Decrypt latest server manifest
    const latestManifest = await decryptManifest(response.data);

    // Get current state
    const currentState = manifestStore.getState();
    if (!currentState.manifest || !currentState.lastKnownServerSnapshot) {
      throw new Error("Invalid state for conflict resolution");
    }

    // Perform 3-way merge
    const mergeInput: ThreeWayMergeInput = {
      base: currentState.lastKnownServerSnapshot,
      local: currentState.manifest,
      remote: latestManifest,
    };
    const resolution = threeWayMerge(mergeInput);

    // Auto-merge and update manifest
    manifestStore.load(
      {
        manifest: resolution.merged,
        etag,
        version,
      },
      latestManifest
    );
  };

  return useMutation<ManifestSaveResponse, ApiError, SaveManifestInput>({
    mutationKey: ["vault", "manifest", "save"],
    mutationFn: async (input) => {
      const mak = await keystoreManager.getMAK();
      const aadContext = await keystoreManager.getAadContext();
      if (!mak || !aadContext) {
        throw new Error("Keys not available");
      }

      const attemptSave = async (manifestInput: {
        manifest: ManifestV1;
        etag: string | null;
        serverVersion: number;
      }) => {
        const aadManifest = new TextEncoder().encode(
          constructAadManifest(aadContext.userId, aadContext.vaultId)
        );
        const { nonce, ciphertext } = encryptAEAD(
          new TextEncoder().encode(JSON.stringify(manifestInput.manifest)),
          mak,
          aadManifest
        );

        const isFirstWrite = manifestInput.serverVersion === 0;
        const headers: Record<string, string> = {};
        if (!isFirstWrite && manifestInput.etag) {
          headers["If-Match"] = manifestInput.etag;
        }

        try {
          const response = await apiClient<ManifestSaveResponse>(
            "/vault/manifest",
            {
              method: "PUT",
              headers,
              body: {
                version: manifestInput.serverVersion + 1,
                nonce: uint8ArrayToBase64(nonce),
                ciphertext: uint8ArrayToBase64(ciphertext),
              },
            }
          );
          zeroize(nonce, ciphertext);
          return response.data;
        } catch (err: any) {
          zeroize(nonce, ciphertext);
          throw err;
        }
      };

      try {
        return await attemptSave(input);
      } catch (error: any) {
        if (error?.status === 409) {
          await handleConflict(aadContext);
          const retryData = manifestStore.getSaveData();
          if (!retryData) {
            throw new Error("No data to retry");
          }
          return await attemptSave(retryData);
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      manifestStore.ackSaved({ etag: data.etag, version: data.version });
    },
  });
}
