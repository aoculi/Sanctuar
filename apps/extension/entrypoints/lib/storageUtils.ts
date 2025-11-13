/**
 * Chrome Storage utilities
 */

import { STORAGE_KEYS } from "./constants";
import type { Settings } from "./settingsUtils";

/**
 * Get value from chrome.storage.local
 */
export function getStorageItem<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    if (!chrome.storage?.local) {
      console.log("chrome.storage.local is not available");
      resolve(null);
      return;
    }

    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.log("chrome.runtime.lastError", chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(result[key] || null);
    });
  });
}

/**
 * Set value in chrome.storage.local
 */
export function setStorageItem(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome.storage?.local) {
      reject(new Error("chrome.storage.local is not available"));
      return;
    }

    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Unknown error"));
        return;
      }
      resolve();
    });
  });
}

/**
 * Get settings from chrome.storage.local
 */
export function getSettings(): Promise<Settings | null> {
  return getStorageItem<Settings>(STORAGE_KEYS.SETTINGS);
}

/**
 * Set settings in chrome.storage.local
 */
export function setSettings(settings: Settings): Promise<void> {
  return setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}
