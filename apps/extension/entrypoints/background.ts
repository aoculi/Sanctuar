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
    if (!chrome.storage?.local) {
      console.log("chrome.storage.local is not available");
      resolve(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
      return;
    }

    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.log("chrome.runtime.lastError", chrome.runtime.lastError);
        resolve(DEFAULT_AUTO_LOCK_TIMEOUT_MS);
        return;
      }

      const settings = result[STORAGE_KEYS.SETTINGS] || getDefaultSettings();
      const timeout = parseAutoLockTimeout(
        settings.autoLockTimeout || DEFAULT_AUTO_LOCK_TIMEOUT,
      );
      resolve(timeout);
    });
  });
}

export default defineBackground(() => {
  let session: { token: string; userId: string; expiresAt: number } | null =
    null;
  let autoLockTimer: number | null = null;
  let lastRefreshAttempt: number = 0; // Track last refresh attempt
  let refreshInProgress: Promise<void> | null = null; // Track ongoing refresh
  let timerResetInProgress: boolean = false; // Track if timer reset is in progress
  const MIN_REFRESH_INTERVAL = 60 * 1000; // Minimum 1 minute between refresh attempts
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
    if (autoLockTimer != null) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }
  }

  /**
   * Attempt to refresh JWT token if needed
   * - Throttles refresh attempts (max once per minute)
   * - Updates session if refresh succeeds
   * - Returns existing promise if refresh is already in progress
   */
  async function attemptTokenRefresh(): Promise<void> {
    if (!session || !keystore.isUnlocked()) {
      return;
    }

    const now = Date.now();

    // Throttle refresh attempts
    if (now - lastRefreshAttempt < MIN_REFRESH_INTERVAL) {
      // If a refresh is already in progress, wait for it
      if (refreshInProgress) {
        return refreshInProgress;
      }
      return;
    }

    // If a refresh is already in progress, wait for it instead of starting a new one
    if (refreshInProgress) {
      return refreshInProgress;
    }

    lastRefreshAttempt = now;

    // Create a promise for this refresh attempt
    refreshInProgress = (async () => {
      try {
        // Get API URL from settings
        const settingsResult = await new Promise<any>((resolve) => {
          if (!chrome.storage?.local) {
            resolve(null);
            return;
          }
          chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(result[STORAGE_KEYS.SETTINGS] || getDefaultSettings());
          });
        });

        if (!settingsResult?.apiUrl || settingsResult.apiUrl.trim() === "") {
          // API URL not configured, skip refresh
          return;
        }

        const apiUrl = settingsResult.apiUrl.trim();
        const refreshUrl = `${apiUrl}/auth/refresh`;

        // Make refresh request
        const response = await fetch(refreshUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
          mode: "cors",
        });

        if (!response.ok) {
          // Refresh failed, but don't interrupt user experience
          // The token will eventually expire and user will need to re-login
          return;
        }

        const data = await response.json();

        if (data.token && typeof data.expires_at === "number") {
          // Update session with new token and expiration
          setSession({
            token: data.token,
            userId: session.userId,
            expiresAt: data.expires_at,
          });
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
        // The token will eventually expire and user will need to re-login
        console.log("Token refresh failed:", error);
      } finally {
        // Clear the in-progress flag
        refreshInProgress = null;
      }
    })();

    return refreshInProgress;
  }

  /**
   * Reset the auto-lock timer based on current settings
   * This is called when:
   * - Session is set
   * - Settings change
   * - User activity (keystore operations)
   * - Popup opens (keystore:isUnlocked check)
   * @param skipRefresh - If true, skip token refresh (used when session was just updated)
   */
  function resetAutoLockTimer(skipRefresh: boolean = false) {
    clearAutoLockTimer();

    // Only set timer if keystore is unlocked and session exists
    if (!keystore.isUnlocked() || !session) {
      timerResetInProgress = false;
      return;
    }

    // Helper function to set the timer with current session
    const setTimer = () => {
      getAutoLockTimeout().then((timeout) => {
        // Session might have been cleared while we were waiting
        if (!session) {
          timerResetInProgress = false;
          return;
        }

        // Calculate time remaining until JWT expiration
        const now = Date.now();
        const timeUntilJwtExpiration = session.expiresAt - now;

        // Use the minimum of configured timeout and JWT expiration time
        // This ensures the timer never exceeds the JWT expiration
        const actualTimeout = Math.min(
          timeout,
          Math.max(0, timeUntilJwtExpiration),
        );

        // Only set timer if there's time remaining
        if (actualTimeout > 0) {
          autoLockTimer = setTimeout(() => {
            autoLockTimer = null;
            lockKeystore();
          }, actualTimeout) as unknown as number;
        } else {
          // JWT is expired or about to expire, lock immediately
          lockKeystore();
        }
        timerResetInProgress = false;
      });
    };

    if (skipRefresh) {
      // Session was just updated, no need to refresh again
      // This is called from setSession() after a refresh
      // Set the timer with the new session expiration
      timerResetInProgress = false; // Mark that we're handling the reset now
      setTimer();
    } else {
      // Attempt to refresh token if needed, then set timer after refresh completes
      // This ensures the timer is set with the updated session expiration
      if (timerResetInProgress) {
        return;
      }
      timerResetInProgress = true;
      attemptTokenRefresh()
        .then(() => {
          // After token refresh (whether it succeeded or not), set the timer
          // Session might have been updated during refresh via setSession()
          // If setSession() already reset the timer, don't reset again
          if (!timerResetInProgress) {
            // Timer was already reset by setSession(), don't reset again
            return;
          }
          setTimer();
        })
        .catch(() => {
          // If refresh fails, still set timer with current session
          if (!timerResetInProgress) {
            // Timer was already reset, don't reset again
            return;
          }
          setTimer();
        });
    }
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
    // Reset auto-lock timer when session is set
    // Skip refresh since we just updated the session (likely from a refresh)
    // This will set the timer with the new expiration time
    resetAutoLockTimer(true);
    broadcast({
      type: "session:updated",
      payload: { userId: next.userId, expiresAt: next.expiresAt },
    });
  }

  function clearSession() {
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
        const unlocked = keystore.isUnlocked();
        // Reset auto-lock timer when popup opens and keystore is unlocked
        // This gives the user the full timeout period when they use the extension
        if (unlocked) {
          resetAutoLockTimer();
        }
        sendResponse({ ok: true, unlocked });
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
                      picture: tab.favIconUrl,
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
                  chrome.runtime.lastError,
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
                    picture: tab.favIconUrl,
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
