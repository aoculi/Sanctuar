/**
 * Settings Store - Persistent settings management using chrome.storage.local
 */
import { STORAGE_KEYS } from "@/entrypoints/lib/constants";

interface SettingsState {
  showHiddenTags: boolean;
}

class SettingsStore {
  private state: SettingsState = {
    showHiddenTags: false,
  };

  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      const savedSettings = result[STORAGE_KEYS.SETTINGS] as
        | Partial<SettingsState>
        | undefined;

      if (savedSettings) {
        this.state = {
          showHiddenTags: savedSettings.showHiddenTags ?? false,
        };
        this.notify();
      }
      this.initialized = true;
    } catch (error) {
      console.error("Error loading settings:", error);
      this.initialized = true;
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: this.state,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async getState(): Promise<SettingsState> {
    if (!this.initialized) {
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
}

export const settingsStore = new SettingsStore();
