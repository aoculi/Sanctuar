import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    host_permissions: ["http://127.0.0.1:3000/*", "http://localhost:3000/*"],
    permissions: ["storage"],
    content_security_policy: {
      // Allow WebAssembly in dev (needed for hash-wasm and libsodium wrappers)
      // Include WXT dev server origin (usually 3001) in script-src
      extension_pages: "script-src 'self' http://localhost:3001 'wasm-unsafe-eval'; object-src 'self'"
    }
  }
});
