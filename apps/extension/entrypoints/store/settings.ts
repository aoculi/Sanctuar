/**
 * Settings Store - Persistent settings management via background script
 */

interface SettingsState {
  showHiddenTags: boolean;
  apiUrl: string;
}

// Background service worker communication
async function sendToBackground<T = any>(message: any): Promise<T> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    } catch {
      resolve(null as T);
    }
  });
}

class SettingsStore {
  private state: SettingsState = {
    showHiddenTags: false,
    apiUrl: "",
  };

  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const response = await sendToBackground<{
        ok: boolean;
        settings?: SettingsState;
      }>({
        type: "settings:get",
      });
      if (response?.ok && response.settings) {
        this.state = response.settings;
        this.notify();
      }
      this.initialized = true;
    } catch (error) {
      console.error("Error loading settings:", error);
      this.initialized = true;
    }
  }

  async getState(): Promise<SettingsState> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    } else if (!this.initialized) {
      await this.loadSettings();
    }
    return { ...this.state };
  }

  // Synchronous getter for immediate access (returns default if not loaded yet)
  getStateSync(): SettingsState {
    return { ...this.state };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore
      }
    });
  }

  async setShowHiddenTags(value: boolean) {
    this.state.showHiddenTags = value;
    this.notify();
    await this.saveSettings();
  }

  async setApiUrl(value: string) {
    this.state.apiUrl = value;
    this.notify();
    await this.saveSettings();
  }

  async setSettings(settings: Partial<SettingsState>) {
    // Update state with provided settings
    if (settings.showHiddenTags !== undefined) {
      this.state.showHiddenTags = settings.showHiddenTags;
    }
    if (settings.apiUrl !== undefined) {
      this.state.apiUrl = settings.apiUrl;
    }
    this.notify();
    // Save the complete state
    await this.saveSettings();
  }

  private async saveSettings(): Promise<void> {
    try {
      const response = await sendToBackground<{ ok: boolean }>({
        type: "settings:set",
        payload: this.state,
      });
      if (!response?.ok) {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  }
}

export const settingsStore = new SettingsStore();
