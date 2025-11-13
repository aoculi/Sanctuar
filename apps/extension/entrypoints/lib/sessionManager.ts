/**
 * Session management for background script
 */

import { broadcast } from "./broadcast";

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export class SessionManager {
  private session: Session | null = null;
  private onSessionSetCallback?: (session: Session) => void;

  /**
   * Set callback to be called when session is set
   * Used for auto-lock timer reset
   */
  setOnSessionSetCallback(callback: (session: Session) => void): void {
    this.onSessionSetCallback = callback;
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    return this.session;
  }

  /**
   * Set session
   */
  setSession(session: Session): void {
    this.session = session;
    broadcast({
      type: "session:updated",
      payload: { userId: session.userId, expiresAt: session.expiresAt },
    });
    // Notify callback if set (for auto-lock timer reset)
    if (this.onSessionSetCallback) {
      this.onSessionSetCallback(session);
    }
  }

  /**
   * Clear session
   */
  clearSession(): void {
    this.session = null;
    broadcast({ type: "session:cleared" });
  }

  /**
   * Check if session exists
   */
  hasSession(): boolean {
    return this.session !== null;
  }
}
