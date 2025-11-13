/**
 * Broadcast messaging utilities
 */

/**
 * Broadcast a message to all extension contexts
 */
export function broadcast(message: any): void {
  try {
    chrome.runtime.sendMessage(message);
  } catch {
    // ignore
  }
}
