import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'wxt'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  vite: () => ({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  }),
  autoIcons: {
    developmentIndicator: false
  },
  // Disable browser reload to avoid connection errors
  // The extension will still be built, but WXT won't try to reload it automatically
  webExt: {
    disabled: true
  },

  manifest: {
    name: 'LockMark',
    description: 'Secure Bookmarks Vault',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'tabs'],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';"
    },
    browser_specific_settings: {
      chrome: {
        id: '@lockmark'
      },
      gecko: {
        id: '@lockmark'
      },
      edge: {
        id: '@lockmark'
      }
    } as any
  }
})
