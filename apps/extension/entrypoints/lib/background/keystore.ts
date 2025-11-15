/**
 * In-memory keystore (single source of truth in service worker)
 * Keys are never persisted and are lost on popup close or SW suspend
 */

import type { AadContext } from "../types";

export class KeyStore {
  private MK: Uint8Array | null = null;
  private KEK: Uint8Array | null = null;
  private MAK: Uint8Array | null = null;
  private aadContext: AadContext | null = null;

  /**
   * Set keys in the keystore
   * @param keys - Object containing MK, KEK, MAK, and aadContext
   */
  setKeys(keys: {
    MK: Uint8Array;
    KEK: Uint8Array;
    MAK: Uint8Array;
    aadContext: AadContext;
  }): void {
    // Zeroize existing keys before setting new ones
    this.zeroize();

    this.MK = keys.MK;
    this.KEK = keys.KEK;
    this.MAK = keys.MAK;
    this.aadContext = keys.aadContext;
  }

  /**
   * Check if keystore is unlocked
   */
  isUnlocked(): boolean {
    return this.MK !== null && this.KEK !== null && this.MAK !== null;
  }

  /**
   * Securely zeroize all keys and clear references
   */
  zeroize(): void {
    if (this.MK) {
      this.MK.fill(0);
      this.MK = null;
    }
    if (this.KEK) {
      this.KEK.fill(0);
      this.KEK = null;
    }
    if (this.MAK) {
      this.MAK.fill(0);
      this.MAK = null;
    }
    this.aadContext = null;
  }

  /**
   * Get MAK (Manifest Auth Key)
   * @throws Error if keystore is locked
   */
  getMAK(): Uint8Array {
    if (this.MAK === null) {
      throw new Error("Keystore is locked");
    }
    return this.MAK;
  }

  /**
   * Get KEK (Key Encryption Key)
   * @throws Error if keystore is locked
   */
  getKEK(): Uint8Array {
    if (this.KEK === null) {
      throw new Error("Keystore is locked");
    }
    return this.KEK;
  }

  /**
   * Get AAD context
   */
  getAadContext(): AadContext | null {
    return this.aadContext;
  }
}


