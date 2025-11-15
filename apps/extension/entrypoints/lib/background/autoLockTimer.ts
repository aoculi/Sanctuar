/**
 * Auto-lock timer management for background script
 */

import { getAutoLockTimeout } from "../storage";
import { broadcastKeystoreLocked, broadcastUnauthorized } from "./broadcast";
import type { Session } from "./session";
import type { KeyStore } from "./keystore";
import type { TokenRefresh } from "./tokenRefresh";

export class AutoLockTimer {
  private autoLockTimer: number | null = null;
  private timerResetInProgress: boolean = false;

  /**
   * Clear the auto-lock timer
   */
  clearTimer(): void {
    if (this.autoLockTimer != null) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  /**
   * Lock the keystore (zeroize keys and notify)
   */
  private lockKeystore(keystore: KeyStore): void {
    keystore.zeroize();
    broadcastKeystoreLocked();
    broadcastUnauthorized();
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
  resetTimer(
    keystore: KeyStore,
    session: Session | null,
    tokenRefresh: TokenRefresh,
    setSession: (session: Session) => void,
    skipRefresh: boolean = false,
  ): void {
    this.clearTimer();

    // Only set timer if keystore is unlocked and session exists
    if (!keystore.isUnlocked() || !session) {
      this.timerResetInProgress = false;
      return;
    }

    // Helper function to set the timer with current session
    const setTimer = () => {
      getAutoLockTimeout().then((timeout) => {
        // Session might have been cleared while we were waiting
        if (!session) {
          this.timerResetInProgress = false;
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
          this.autoLockTimer = setTimeout(() => {
            this.autoLockTimer = null;
            this.lockKeystore(keystore);
          }, actualTimeout) as unknown as number;
        } else {
          // JWT is expired or about to expire, lock immediately
          this.lockKeystore(keystore);
        }
        this.timerResetInProgress = false;
      });
    };

    if (skipRefresh) {
      // Session was just updated, no need to refresh again
      // This is called from setSession() after a refresh
      // Set the timer with the new session expiration
      this.timerResetInProgress = false; // Mark that we're handling the reset now
      setTimer();
    } else {
      // Attempt to refresh token if needed, then set timer after refresh completes
      // This ensures the timer is set with the updated session expiration
      if (this.timerResetInProgress) {
        return;
      }
      this.timerResetInProgress = true;
      tokenRefresh
        .attemptTokenRefresh(session, setSession)
        .then(() => {
          // After token refresh (whether it succeeded or not), set the timer
          // Session might have been updated during refresh via setSession()
          // If setSession() already reset the timer, don't reset again
          if (!this.timerResetInProgress) {
            // Timer was already reset by setSession(), don't reset again
            return;
          }
          setTimer();
        })
        .catch(() => {
          // If refresh fails, still set timer with current session
          if (!this.timerResetInProgress) {
            // Timer was already reset, don't reset again
            return;
          }
          setTimer();
        });
    }
  }
}
