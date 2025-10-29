export default defineBackground(() => {
  let session: { token: string; userId: string; expiresAt: number } | null = null;
  let expiryTimer: number | null = null;

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
    broadcast({ type: 'session:cleared' });
    broadcast({ type: 'auth:unauthorized' });
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
      default:
        break;
    }

    // Indicates we will send a response synchronously
    return true;
  });
});
