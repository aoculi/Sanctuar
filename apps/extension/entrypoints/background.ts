/**
 * In-memory keystore (single source of truth in service worker)
 * Keys are never persisted and are lost on popup close or SW suspend
 */

type AadContext = {
  userId: string;
  vaultId: string;
  wmkLabel: string;
  manifestLabel: string;
};

class KeyStore {
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
      throw new Error('Keystore is locked');
    }
    return this.MAK;
  }

  /**
   * Get KEK (Key Encryption Key)
   * @throws Error if keystore is locked
   */
  getKEK(): Uint8Array {
    if (this.KEK === null) {
      throw new Error('Keystore is locked');
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

export default defineBackground(() => {
  let session: { token: string; userId: string; expiresAt: number } | null = null;
  let expiryTimer: number | null = null;
  const keystore = new KeyStore();

  function clearExpiryTimer() {
    if (expiryTimer != null) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function broadcast(message: any) {
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // ignore
    }
  }

  function setSession(next: { token: string; userId: string; expiresAt: number }) {
    session = next;
    clearExpiryTimer();
    const delay = Math.max(0, next.expiresAt - Date.now());
    expiryTimer = (setTimeout(() => {
      // Expired
      session = null;
      expiryTimer = null;
      broadcast({ type: 'session:expired' });
    }, delay) as unknown) as number;
    broadcast({ type: 'session:updated', payload: { userId: next.userId, expiresAt: next.expiresAt } });
  }

  function clearSession() {
    session = null;
    clearExpiryTimer();
    // Zeroize keys when session is cleared
    keystore.zeroize();
    broadcast({ type: 'session:cleared' });
    broadcast({ type: 'auth:unauthorized' });
  }

  /**
   * Helper to convert base64 string to Uint8Array
   */
  function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Helper to convert Uint8Array to base64 string
   */
  function uint8ArrayToBase64(arr: Uint8Array): string {
    // Handle large arrays by chunking to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;

    switch (message.type) {
      case 'session:get': {
        sendResponse({ ok: true, session });
        break;
      }
      case 'session:set': {
        const { token, userId, expiresAt } = message.payload || {};
        if (typeof token === 'string' && typeof userId === 'string' && typeof expiresAt === 'number') {
          setSession({ token, userId, expiresAt });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: 'invalid_payload' });
        }
        break;
      }
      case 'session:clear': {
        clearSession();
        sendResponse({ ok: true });
        break;
      }
      case 'keystore:setKeys': {
        const { MK, KEK, MAK, aadContext } = message.payload || {};
        if (
          typeof MK === 'string' &&
          typeof KEK === 'string' &&
          typeof MAK === 'string' &&
          aadContext &&
          typeof aadContext.userId === 'string' &&
          typeof aadContext.vaultId === 'string' &&
          typeof aadContext.wmkLabel === 'string' &&
          typeof aadContext.manifestLabel === 'string'
        ) {
          try {
            keystore.setKeys({
              MK: base64ToUint8Array(MK),
              KEK: base64ToUint8Array(KEK),
              MAK: base64ToUint8Array(MAK),
              aadContext,
            });
            sendResponse({ ok: true });
          } catch (error) {
            sendResponse({ ok: false, error: String(error) });
          }
        } else {
          sendResponse({ ok: false, error: 'invalid_payload' });
        }
        break;
      }
      case 'keystore:isUnlocked': {
        sendResponse({ ok: true, unlocked: keystore.isUnlocked() });
        break;
      }
      case 'keystore:zeroize': {
        keystore.zeroize();
        sendResponse({ ok: true });
        break;
      }
      case 'keystore:getMAK': {
        try {
          const mak = keystore.getMAK();
          sendResponse({ ok: true, key: uint8ArrayToBase64(mak) });
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
        break;
      }
      case 'keystore:getKEK': {
        try {
          const kek = keystore.getKEK();
          sendResponse({ ok: true, key: uint8ArrayToBase64(kek) });
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
        break;
      }
      case 'keystore:getAadContext': {
        const context = keystore.getAadContext();
        sendResponse({ ok: true, context });
        break;
      }
      default:
        break;
    }

    // Indicates we will send a response synchronously
    return true;
  });
});
