/**
 * Settings utilities for background script
 */

import {
  DEFAULT_AUTO_LOCK_TIMEOUT,
  DEFAULT_AUTO_LOCK_TIMEOUT_MS,
} from "./constants";
import { getSettings } from "./storageUtils";

export interface Settings {
  showHiddenTags: boolean;
  apiUrl: string;
  autoLockTimeout: string;
}

/**
 * Get default settings object
 */
export function getDefaultSettings(): Settings {
  return {
    showHiddenTags: false,
    apiUrl: "",
    autoLockTimeout: DEFAULT_AUTO_LOCK_TIMEOUT,
  };
}

/**
 * Parse auto-lock timeout string to milliseconds
 */
export function parseAutoLockTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(min|h)$/);
  if (!match) {
    return DEFAULT_AUTO_LOCK_TIMEOUT_MS;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "h") {
    return value * 60 * 60 * 1000;
  } else {
    return value * 60 * 1000;
  }
}

/**
 * Get auto-lock timeout from settings
 */
export async function getAutoLockTimeout(): Promise<number> {
  const settings = (await getSettings()) || getDefaultSettings();
  const timeout = parseAutoLockTimeout(
    settings.autoLockTimeout || DEFAULT_AUTO_LOCK_TIMEOUT,
  );
  return timeout;
}
