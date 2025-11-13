/**
 * Base64 encoding/decoding utilities for binary data
 */

/**
 * Helper to convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to base64 string
 * Handles large arrays by chunking to avoid stack overflow
 */
export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
