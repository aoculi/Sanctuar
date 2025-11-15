/**
 * Broadcast utilities for background script
 * Sends messages to all extension contexts (popup, content scripts, etc.)
 */

/**
 * Message types for broadcasting
 */
export type BroadcastMessage =
  | { type: "keystore:locked" }
  | { type: "auth:unauthorized" }
  | { type: "session:updated"; payload: { userId: string; expiresAt: number } }
  | { type: "session:cleared" };

/**
 * Broadcast a message to all extension contexts
 * Fails silently if no listeners are available
 * @param message - Message to broadcast
 */
export function broadcast(message: BroadcastMessage): void {
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {
    // Silently ignore errors (e.g., no listeners)
    // This is expected when popup is closed
  }
}

/**
 * Broadcast keystore locked event
 */
export function broadcastKeystoreLocked(): void {
  broadcast({ type: "keystore:locked" });
}

/**
 * Broadcast unauthorized event
 */
export function broadcastUnauthorized(): void {
  broadcast({ type: "auth:unauthorized" });
}

/**
 * Broadcast session updated event
 * @param userId - User ID
 * @param expiresAt - Token expiration timestamp
 */
export function broadcastSessionUpdated(
  userId: string,
  expiresAt: number
): void {
  broadcast({ type: "session:updated", payload: { userId, expiresAt } });
}

/**
 * Broadcast session cleared event
 */
export function broadcastSessionCleared(): void {
  broadcast({ type: "session:cleared" });
}
