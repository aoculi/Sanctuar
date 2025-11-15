/**
 * Message type definitions for background script communication
 */

import type { AadContext } from "../types";
import type { Session } from "./session";
import type { Settings } from "../storage";
import type { TabInfo } from "../tabUtils";

// Base message structure
export interface BaseMessage {
  type: string;
  payload?: any;
}

// Session messages
export interface SessionGetMessage extends BaseMessage {
  type: "session:get";
}

export interface SessionGetResponse {
  ok: boolean;
  session: Session | null;
}

export interface SessionSetMessage extends BaseMessage {
  type: "session:set";
  payload: {
    token: string;
    userId: string;
    expiresAt: number;
  };
}

export interface SessionSetResponse {
  ok: boolean;
  error?: string;
}

export interface SessionClearMessage extends BaseMessage {
  type: "session:clear";
}

export interface SessionClearResponse {
  ok: boolean;
}

// Keystore messages
export interface KeystoreSetKeysMessage extends BaseMessage {
  type: "keystore:setKeys";
  payload: {
    MK: string; // base64
    KEK: string; // base64
    MAK: string; // base64
    aadContext: AadContext;
  };
}

export interface KeystoreSetKeysResponse {
  ok: boolean;
  error?: string;
}

export interface KeystoreIsUnlockedMessage extends BaseMessage {
  type: "keystore:isUnlocked";
}

export interface KeystoreIsUnlockedResponse {
  ok: boolean;
  unlocked: boolean;
}

export interface KeystoreZeroizeMessage extends BaseMessage {
  type: "keystore:zeroize";
}

export interface KeystoreZeroizeResponse {
  ok: boolean;
}

export interface KeystoreGetMAKMessage extends BaseMessage {
  type: "keystore:getMAK";
}

export interface KeystoreGetMAKResponse {
  ok: boolean;
  key?: string; // base64
  error?: string;
}

export interface KeystoreGetKEKMessage extends BaseMessage {
  type: "keystore:getKEK";
}

export interface KeystoreGetKEKResponse {
  ok: boolean;
  key?: string; // base64
  error?: string;
}

export interface KeystoreGetAadContextMessage extends BaseMessage {
  type: "keystore:getAadContext";
}

export interface KeystoreGetAadContextResponse {
  ok: boolean;
  context: AadContext | null;
}

// Settings messages
export interface SettingsGetMessage extends BaseMessage {
  type: "settings:get";
}

export interface SettingsGetResponse {
  ok: boolean;
  settings?: Settings;
  error?: string;
}

export interface SettingsSetMessage extends BaseMessage {
  type: "settings:set";
  payload: Settings;
}

export interface SettingsSetResponse {
  ok: boolean;
  error?: string;
}

// Tab messages
export interface TabsGetCurrentMessage extends BaseMessage {
  type: "tabs:getCurrent";
}

export interface TabsGetCurrentResponse {
  ok: boolean;
  tab?: TabInfo;
  error?: string;
}

// Union type for all messages
export type BackgroundMessage =
  | SessionGetMessage
  | SessionSetMessage
  | SessionClearMessage
  | KeystoreSetKeysMessage
  | KeystoreIsUnlockedMessage
  | KeystoreZeroizeMessage
  | KeystoreGetMAKMessage
  | KeystoreGetKEKMessage
  | KeystoreGetAadContextMessage
  | SettingsGetMessage
  | SettingsSetMessage
  | TabsGetCurrentMessage;

// Union type for all responses
export type BackgroundResponse =
  | SessionGetResponse
  | SessionSetResponse
  | SessionClearResponse
  | KeystoreSetKeysResponse
  | KeystoreIsUnlockedResponse
  | KeystoreZeroizeResponse
  | KeystoreGetMAKResponse
  | KeystoreGetKEKResponse
  | KeystoreGetAadContextResponse
  | SettingsGetResponse
  | SettingsSetResponse
  | TabsGetCurrentResponse;


