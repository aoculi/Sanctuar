import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    developmentIndicator: false,
  },

  manifest: {
    name: "LockMark",
    description: "Secure Bookmarks Vault",
    host_permissions: ["http://127.0.0.1:3500/*", "http://localhost:3500/*"],
    permissions: ["storage", "tabs"],
    content_security_policy: {
      // Allow WebAssembly in dev (needed for hash-wasm and libsodium wrappers)
      // Include WXT dev server origin (usually 3001) in script-src
      extension_pages:
        "script-src 'self' http://localhost:3001 'wasm-unsafe-eval'; object-src 'self'",
    },
    browser_specific_settings: {
      chrome: {
        id: "@lockmark",
      },
      gecko: {
        id: "@lockmark",
      },
      edge: {
        id: "@lockmark",
      },
    } as any,
  },
});
