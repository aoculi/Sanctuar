/**
 * Background service orchestrator
 * Manages all background script components and their interactions
 */

import { AutoLockTimer } from './autoLockTimer'
import { KeyStore } from './keystore'
import { MessageHandlers } from './messageHandlers'
import { SessionManager } from './session'
import { TokenRefresh } from './tokenRefresh'

export class BackgroundService {
  private keystore: KeyStore
  private sessionManager: SessionManager
  private tokenRefresh: TokenRefresh
  private autoLockTimer: AutoLockTimer
  private messageHandlers: MessageHandlers

  constructor() {
    this.keystore = new KeyStore()
    this.sessionManager = new SessionManager()
    this.tokenRefresh = new TokenRefresh()
    this.autoLockTimer = new AutoLockTimer()
    this.messageHandlers = new MessageHandlers(
      this.keystore,
      this.sessionManager,
      this.autoLockTimer,
      this.tokenRefresh
    )

    // Set up session callback for auto-lock timer reset
    this.sessionManager.setOnSessionSetCallback((session) => {
      this.autoLockTimer.resetTimer(
        this.keystore,
        this.sessionManager.getSession(),
        this.tokenRefresh,
        (s) => this.sessionManager.setSession(s),
        true // Skip refresh since session was just updated
      )
    })
  }

  /**
   * Initialize the background service
   */
  initialize(): void {
    // Set up message listener
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.messageHandlers
        .handleMessage(message as any)
        .then((response) => {
          if (response !== null) {
            sendResponse(response)
          }
        })
        .catch((error) => {
          sendResponse({ ok: false, error: String(error) })
        })

      // Indicates we will send a response asynchronously
      return true
    })
  }
}
