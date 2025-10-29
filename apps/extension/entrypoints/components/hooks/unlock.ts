import { useMutation } from '@tanstack/react-query';
import { constructAadWmk } from '../../lib/constants';
import { decryptAEAD, deriveKeyFromPassword, deriveSubKeys, encryptAEAD, fromBase64, toBase64, zeroize } from '../../lib/crypto';
import { whenCryptoReady } from '../../lib/cryptoEnv';
import { apiClient, type ApiError } from '../api';
import { authStore, keystoreManager, type AadContext } from '../store';

export type UnlockInput = {
    password: string;
    userId: string;
    vaultId: string;
};

export type UnlockResponse = {
    success: boolean;
    isFirstUnlock: boolean;
};

/**
 * Unlock hook that handles the complete unlock flow
 * C1-C6: Gather inputs, derive UEK, handle WMK cases, derive operational keys, commit to keystore
 */
export function useUnlock() {
    return useMutation<UnlockResponse, ApiError, UnlockInput>({
        mutationKey: ['auth', 'unlock'],
        mutationFn: async (input: UnlockInput) => {
            const { password, userId, vaultId } = input;

            // C1. Gather inputs for unlock
            const kdf = authStore.getKdf();
            const wrappedMk = authStore.getWrappedMk();

            if (!kdf) {
                throw new Error('KDF parameters not available. Please login first.');
            }

            // C2. Precondition: sodium ready
            await whenCryptoReady();

            // C2. Derive UEK (client)
            const kdfSalt = fromBase64(kdf.salt);
            const uek = deriveKeyFromPassword(password, kdfSalt);

            // Immediately clear password from memory (best effort)
            // Note: We can't clear the input parameter, but we clear our local reference
            let mk: Uint8Array;
            let isFirstUnlock = false;

            try {
                // C3. Handle WMK cases
                if (wrappedMk) {
                    // Case 1: wrapped_mk is present
                    try {
                        const wmkData = fromBase64(wrappedMk);
                        const nonce = wmkData.subarray(0, 24);
                        const ciphertext = wmkData.subarray(24);

                        const aadWmk = new TextEncoder().encode(constructAadWmk(userId, vaultId));
                        mk = decryptAEAD(ciphertext, nonce, uek, aadWmk);
                    } catch (error) {
                        // On failure → show generic error (do not reveal which part failed)
                        throw new Error('Unable to unlock');
                    }
                } else {
                    // Case 2: wrapped_mk is null (first unlock ever)
                    isFirstUnlock = true;

                    // Generate MK = RNG(32B)
                    const sodium = (await import('libsodium-wrappers-sumo')).default;
                    await sodium.ready;
                    mk = sodium.randombytes_buf(32);

                    // Wrap it: WMK = AEAD_UEK_ENC(MK, AAD_WMK, nonce=RNG(24B))
                    const aadWmk = new TextEncoder().encode(constructAadWmk(userId, vaultId));
                    const { nonce, ciphertext } = encryptAEAD(mk, uek, aadWmk);

                    // Create WMK format: nonce(24B) || ciphertext
                    const wmk = new Uint8Array(24 + ciphertext.length);
                    wmk.set(nonce, 0);
                    wmk.set(ciphertext, 24);
                    const wmkBase64 = toBase64(wmk);

                    // POST /user/wmk with the chosen WMK format
                    // Only called when WMK was initially missing
                    try {
                        const response = await apiClient<{ ok: boolean }>('/user/wmk', {
                            method: 'POST',
                            body: { wrapped_mk: wmkBase64 }
                        });

                        // Verify response format
                        if (!response.data?.ok) {
                            throw new Error('Could not initialize vault');
                        }
                    } catch (error: any) {
                        // If WMK upload fails (network, 4xx) → show error, keep session, allow retry
                        // Create a custom error that indicates WMK upload failure
                        const apiError = error as ApiError;
                        if (apiError.status === -1 || (apiError.status >= 400 && apiError.status < 500)) {
                            throw {
                                status: apiError.status,
                                message: 'Could not initialize vault',
                                details: { wmkUploadFailed: true, isFirstUnlock: true }
                            } as ApiError;
                        }
                        // For 5xx errors, still throw but mark as initialization failure
                        throw {
                            status: apiError.status || 500,
                            message: 'Could not initialize vault',
                            details: { wmkUploadFailed: true, isFirstUnlock: true }
                        } as ApiError;
                    }
                }

                // C4. Derive operational keys
                // Use the same KDF salt as HKDF salt for simplicity
                const { kek, mak } = deriveSubKeys(mk, kdfSalt);

                // C5. Commit keys into memory
                const aadContext: AadContext = {
                    userId,
                    vaultId,
                    wmkLabel: 'wmk_v1',
                    manifestLabel: 'manifest_v1'
                };

                await keystoreManager.setKeys({
                    MK: mk,
                    KEK: kek,
                    MAK: mak,
                    aadContext
                });

                // C5. Zeroize local temporaries
                zeroize(uek, mk, kek, mak);

                return {
                    success: true,
                    isFirstUnlock
                };

            } finally {
                // Always zeroize UEK
                zeroize(uek);
            }
        },
    });
}
