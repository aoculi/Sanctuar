import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    developmentIndicator: false,
  },
  // Disable browser reload to avoid connection errors
  // The extension will still be built, but WXT won't try to reload it automatically
  webExt: {
    disabled: true,
  },

  manifest: {
    name: "LockMark",
    description: "Secure Bookmarks Vault",
    host_permissions: ["http://127.0.0.1:3500/*", "http://localhost:3500/*"],
    permissions: ["storage", "tabs"],
    content_security_policy: {
      // Allow WebAssembly in dev (needed for hash-wasm and libsodium wrappers)
      // Include WXT dev server origins (3000 for main server, 3001 for HMR)
      // Allow blob: URLs for worker scripts (needed for WebAssembly workers)
      extension_pages:
        "script-src 'self' http://localhost:3000 http://localhost:3001 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self' blob:;",
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
