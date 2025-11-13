/**
 * Token refresh logic for background script
 */

import { MIN_REFRESH_INTERVAL } from "./constants";
import type { Session } from "./sessionManager";
import type { Settings } from "./settingsUtils";
import { getDefaultSettings } from "./settingsUtils";
import { getSettings } from "./storageUtils";

export class TokenRefresh {
  private lastRefreshAttempt: number = 0;
  private refreshInProgress: Promise<void> | null = null;

  /**
   * Attempt to refresh JWT token if needed
   * - Throttles refresh attempts (max once per minute)
   * - Returns existing promise if refresh is already in progress
   */
  async attemptTokenRefresh(
    session: Session | null,
    setSession: (session: Session) => void
  ): Promise<void> {
    if (!session) {
      return;
    }

    const now = Date.now();

    // Throttle refresh attempts
    if (now - this.lastRefreshAttempt < MIN_REFRESH_INTERVAL) {
      // If a refresh is already in progress, wait for it
      if (this.refreshInProgress) {
        return this.refreshInProgress;
      }
      return;
    }

    // If a refresh is already in progress, wait for it instead of starting a new one
    if (this.refreshInProgress) {
      return this.refreshInProgress;
    }

    this.lastRefreshAttempt = now;

    // Create a promise for this refresh attempt
    this.refreshInProgress = (async () => {
      try {
        // Get API URL from settings
        const settingsResult: Settings =
          (await getSettings()) || getDefaultSettings();

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
        this.refreshInProgress = null;
      }
    })();

    return this.refreshInProgress;
  }
}
