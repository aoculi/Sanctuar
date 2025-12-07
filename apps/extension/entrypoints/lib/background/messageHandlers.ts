/**
 * Message handlers for background script
 */

import { base64ToUint8Array, uint8ArrayToBase64 } from '../crypto'
import { getDefaultSettings, getSettings, setSettings } from '../storage'
import { getCurrentTab } from '../tabUtils'
import type { AutoLockTimer } from './autoLockTimer'
import type { KeyStore } from './keystore'
import type { BackgroundMessage, BackgroundResponse } from './messageTypes'
import type { SessionManager } from './session'
import type { TokenRefresh } from './tokenRefresh'

export class MessageHandlers {
  constructor(
    private keystore: KeyStore,
    private sessionManager: SessionManager,
    private autoLockTimer: AutoLockTimer,
    private tokenRefresh: TokenRefresh
  ) {}

  private resetAutoLockTimer(skipRefresh: boolean = false): void {
    this.autoLockTimer.resetTimer(
      this.keystore,
      this.sessionManager.getSession(),
      this.tokenRefresh,
      (session) => this.sessionManager.setSession(session),
      skipRefresh
    )
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(
    message: BackgroundMessage
  ): Promise<BackgroundResponse | null> {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return null
    }

    switch (message.type) {
      case 'session:get': {
        return {
          ok: true,
          session: this.sessionManager.getSession()
        }
      }

      case 'session:set': {
        const { token, userId, expiresAt } = message.payload || {}
        if (
          typeof token === 'string' &&
          typeof userId === 'string' &&
          typeof expiresAt === 'number'
        ) {
          // setSession will trigger the callback in backgroundService to reset the timer
          this.sessionManager.setSession({ token, userId, expiresAt })
          return { ok: true }
        } else {
          return { ok: false, error: 'invalid_payload' }
        }
      }

      case 'session:clear': {
        this.sessionManager.clearSession()
        this.autoLockTimer.clearTimer()
        this.keystore.zeroize()
        return { ok: true }
      }

      case 'keystore:setKeys': {
        const { MK, KEK, MAK, aadContext } = message.payload || {}
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
            this.keystore.setKeys({
              MK: base64ToUint8Array(MK),
              KEK: base64ToUint8Array(KEK),
              MAK: base64ToUint8Array(MAK),
              aadContext
            })
            // Reset auto-lock timer on activity (keys set = user unlocked)
            this.resetAutoLockTimer()
            return { ok: true }
          } catch (error) {
            return { ok: false, error: String(error) }
          }
        } else {
          return { ok: false, error: 'invalid_payload' }
        }
      }

      case 'keystore:isUnlocked': {
        const unlocked = this.keystore.isUnlocked()
        // Reset auto-lock timer when popup opens and keystore is unlocked
        // This gives the user the full timeout period when they use the extension
        if (unlocked) {
          this.resetAutoLockTimer()
        }
        return { ok: true, unlocked }
      }

      case 'keystore:zeroize': {
        this.keystore.zeroize()
        return { ok: true }
      }

      case 'keystore:getMAK': {
        try {
          const mak = this.keystore.getMAK()
          // Reset auto-lock timer on activity (keystore access)
          this.resetAutoLockTimer()
          return { ok: true, key: uint8ArrayToBase64(mak) }
        } catch (error) {
          return { ok: false, error: String(error) }
        }
      }

      case 'keystore:getKEK': {
        try {
          const kek = this.keystore.getKEK()
          // Reset auto-lock timer on activity (keystore access)
          this.resetAutoLockTimer()
          return { ok: true, key: uint8ArrayToBase64(kek) }
        } catch (error) {
          return { ok: false, error: String(error) }
        }
      }

      case 'keystore:getAadContext': {
        const context = this.keystore.getAadContext()
        return { ok: true, context }
      }

      case 'settings:get': {
        // Get settings from chrome.storage.local
        if (!chrome.storage || !chrome.storage.local) {
          return {
            ok: false,
            error: 'chrome.storage.local is not available'
          }
        }

        try {
          const settings = (await getSettings()) || getDefaultSettings()
          return { ok: true, settings }
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || 'Unknown error'
          }
        }
      }

      case 'settings:set': {
        // Save settings to chrome.storage.local
        if (!chrome.storage || !chrome.storage.local) {
          return {
            ok: false,
            error: 'chrome.storage.local is not available'
          }
        }

        const settings = message.payload
        if (!settings || typeof settings !== 'object') {
          return { ok: false, error: 'invalid_payload' }
        }

        try {
          await setSettings(settings)
          // Reset auto-lock timer when settings change (in case timeout changed)
          this.resetAutoLockTimer()
          return { ok: true }
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || 'Unknown error'
          }
        }
      }

      case 'tabs:getCurrent': {
        try {
          const tab = await getCurrentTab()
          return { ok: true, tab: tab || undefined }
        } catch (error: any) {
          return {
            ok: false,
            error: error?.message || 'Unknown error'
          }
        }
      }

      default:
        return null
    }
  }
}
