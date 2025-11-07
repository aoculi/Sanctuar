/**
 * In-memory keystore (single source of truth in service worker)
 * Keys are never persisted and are lost on popup close or SW suspend
 */

import { STORAGE_KEYS } from "@/entrypoints/lib/constants";

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

// Constants
const DEFAULT_AUTO_LOCK_TIMEOUT = "20min";
const DEFAULT_AUTO_LOCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

/**
 * Get default settings object
 */
function getDefaultSettings() {
  return {
    showHiddenTags: false,
    apiUrl: "",
    autoLockTimeout: DEFAULT_AUTO_LOCK_TIMEOUT,
  };
}

/**
 * Parse auto-lock timeout string to milliseconds
 */
function parseAutoLockTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(min|h)$/);
  if (!match) {
    return DEFAULT_AUTO_LOCK_TIMEOUT_MS;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "h") {
    return value * 60 * 60 * 1000;
  } else {
    return value * 60 * 1000;
  }
}

/**
 * Get auto-lock timeout from settings
 */
async function getAutoLockTimeout(): Promise<number> {
  return new Promise((resolve) => {
    console.log("getAutoLockTimeout");
    if (!chrome.storage?.local) {
      console.log("chrome.storage.local is not available");
      resolve(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
      return;
    }

    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      console.log("chrome.storage.local.get", result);
      if (chrome.runtime.lastError) {
        console.log("chrome.runtime.lastError", chrome.runtime.lastError);
        resolve(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
        return;
      }

      console.log(
        "result[STORAGE_KEYS.SETTINGS]",
        result[STORAGE_KEYS.SETTINGS]
      );
      const settings = result[STORAGE_KEYS.SETTINGS] || getDefaultSettings();
      console.log("settings", settings);
      const timeout = parseAutoLockTimeout(
        settings.autoLockTimeout || DEFAULT_AUTO_LOCK_TIMEOUT
      );
      console.log("timeout", timeout);
      resolve(timeout);
    });
  });
}

export default defineBackground(() => {
  let session: { token: string; userId: string; expiresAt: number } | null =
    null;
  let autoLockTimer: number | null = null;
  const keystore = new KeyStore();

  /**
   * Lock the keystore (zeroize keys and notify)
   */
  function lockKeystore() {
    keystore.zeroize();
    broadcast({ type: "keystore:locked" });
    broadcast({ type: "auth:unauthorized" });
  }

  function clearAutoLockTimer() {
    console.log("clearAutoLockTimer");
    if (autoLockTimer != null) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }
  }

  /**
   * Reset the auto-lock timer based on current settings
   * This is called when:
   * - Session is set
   * - Settings change
   * - User activity (keystore operations)
   */
  function resetAutoLockTimer() {
    console.log("resetAutoLockTimer");
    clearAutoLockTimer();

    // Only set timer if keystore is unlocked and session exists
    if (!keystore.isUnlocked() || !session) {
      console.log("keystore is not unlocked or session does not exist");
      return;
    }

    // Get timeout asynchronously and set timer
    getAutoLockTimeout().then((timeout) => {
      console.log("getAutoLockTimeout", timeout);
      autoLockTimer = setTimeout(() => {
        autoLockTimer = null;
        lockKeystore();
      }, timeout) as unknown as number;
    });
  }

  function broadcast(message: any) {
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // ignore
    }
  }

  function setSession(next: {
    token: string;
    userId: string;
    expiresAt: number;
  }) {
    session = next;
    console.log("setSession", next);
    // Reset auto-lock timer when session is set
    resetAutoLockTimer();
    broadcast({
      type: "session:updated",
      payload: { userId: next.userId, expiresAt: next.expiresAt },
    });
  }

  function clearSession() {
    console.log("clearSession");
    session = null;
    clearAutoLockTimer();
    lockKeystore();
    broadcast({ type: "session:cleared" });
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
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message)) return;

    switch (message.type) {
      case "session:get": {
        sendResponse({ ok: true, session });
        break;
      }
      case "session:set": {
        const { token, userId, expiresAt } = message.payload || {};
        if (
          typeof token === "string" &&
          typeof userId === "string" &&
          typeof expiresAt === "number"
        ) {
          setSession({ token, userId, expiresAt });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "invalid_payload" });
        }
        break;
      }
      case "session:clear": {
        clearSession();
        sendResponse({ ok: true });
        break;
      }
      case "keystore:setKeys": {
        const { MK, KEK, MAK, aadContext } = message.payload || {};
        if (
          typeof MK === "string" &&
          typeof KEK === "string" &&
          typeof MAK === "string" &&
          aadContext &&
          typeof aadContext.userId === "string" &&
          typeof aadContext.vaultId === "string" &&
          typeof aadContext.wmkLabel === "string" &&
          typeof aadContext.manifestLabel === "string"
        ) {
          try {
            keystore.setKeys({
              MK: base64ToUint8Array(MK),
              KEK: base64ToUint8Array(KEK),
              MAK: base64ToUint8Array(MAK),
              aadContext,
            });
            // Reset auto-lock timer on activity (keys set = user unlocked)
            resetAutoLockTimer();
            sendResponse({ ok: true });
          } catch (error) {
            sendResponse({ ok: false, error: String(error) });
          }
        } else {
          sendResponse({ ok: false, error: "invalid_payload" });
        }
        break;
      }
      case "keystore:isUnlocked": {
        sendResponse({ ok: true, unlocked: keystore.isUnlocked() });
        break;
      }
      case "keystore:zeroize": {
        keystore.zeroize();
        sendResponse({ ok: true });
        break;
      }
      case "keystore:getMAK": {
        try {
          const mak = keystore.getMAK();
          // Reset auto-lock timer on activity (keystore access)
          resetAutoLockTimer();
          sendResponse({ ok: true, key: uint8ArrayToBase64(mak) });
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
        break;
      }
      case "keystore:getKEK": {
        try {
          const kek = keystore.getKEK();
          // Reset auto-lock timer on activity (keystore access)
          resetAutoLockTimer();
          sendResponse({ ok: true, key: uint8ArrayToBase64(kek) });
        } catch (error) {
          sendResponse({ ok: false, error: String(error) });
        }
        break;
      }
      case "keystore:getAadContext": {
        const context = keystore.getAadContext();
        sendResponse({ ok: true, context });
        break;
      }
      case "settings:get": {
        // Get settings from chrome.storage.local
        if (!chrome.storage || !chrome.storage.local) {
          sendResponse({
            ok: false,
            error: "chrome.storage.local is not available",
          });
          break;
        }

        chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message || "Unknown error",
            });
            return;
          }

          const settings =
            result[STORAGE_KEYS.SETTINGS] || getDefaultSettings();
          sendResponse({ ok: true, settings });
        });

        return true; // Indicates we'll send a response asynchronously
      }
      case "settings:set": {
        // Save settings to chrome.storage.local
        if (!chrome.storage || !chrome.storage.local) {
          sendResponse({
            ok: false,
            error: "chrome.storage.local is not available",
          });
          break;
        }

        const settings = message.payload;
        if (!settings || typeof settings !== "object") {
          sendResponse({ ok: false, error: "invalid_payload" });
          break;
        }

        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message || "Unknown error",
            });
            return;
          }
          // Reset auto-lock timer when settings change (in case timeout changed)
          resetAutoLockTimer();
          sendResponse({ ok: true });
        });

        return true; // Indicates we'll send a response asynchronously
      }
      case "tabs:getCurrent": {
        // Get current active tab - background script has reliable access
        if (!chrome.tabs) {
          console.error("chrome.tabs is not available");
          sendResponse({
            ok: false,
            error: "chrome.tabs is not available",
          });
          break;
        }

        if (typeof chrome.tabs.query !== "function") {
          console.error("chrome.tabs.query is not a function", chrome.tabs);
          sendResponse({
            ok: false,
            error: "chrome.tabs.query is not a function",
          });
          break;
        }

        // Try Promise-based API first, fallback to callback
        try {
          const queryOptions = { active: true, currentWindow: true };

          // Try Promise-based approach (Manifest V3)
          const queryResult = chrome.tabs.query(queryOptions);

          if (queryResult && typeof queryResult.then === "function") {
            // Promise-based API available
            queryResult
              .then((tabs) => {
                if (tabs && tabs.length > 0) {
                  const tab = tabs[0];
                  sendResponse({
                    ok: true,
                    tab: {
                      url: tab.url,
                      title: tab.title,
                      id: tab.id,
                    },
                  });
                } else {
                  sendResponse({ ok: false, error: "No active tab found" });
                }
              })
              .catch((error) => {
                console.error("Error in tabs:getCurrent (Promise):", error);
                sendResponse({ ok: false, error: String(error) });
              });
          } else {
            // Fallback to callback-based API
            chrome.tabs.query(queryOptions, (tabs) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "chrome.runtime.lastError:",
                  chrome.runtime.lastError
                );
                sendResponse({
                  ok: false,
                  error: chrome.runtime.lastError.message || "Unknown error",
                });
                return;
              }

              if (tabs && tabs.length > 0) {
                const tab = tabs[0];
                sendResponse({
                  ok: true,
                  tab: {
                    url: tab.url,
                    title: tab.title,
                    id: tab.id,
                  },
                });
              } else {
                sendResponse({ ok: false, error: "No active tab found" });
              }
            });
          }
        } catch (error) {
          console.error("Error in tabs:getCurrent:", error);
          sendResponse({ ok: false, error: String(error) });
        }

        // Return true to indicate we'll send a response asynchronously
        return true;
      }
      default:
        break;
    }

    // Indicates we will send a response synchronously (for non-async handlers)
    return true;
  });
});
