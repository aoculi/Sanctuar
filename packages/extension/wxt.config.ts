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
    name: 'Sanctuar',
    description: 'A secure, privacy-focused local vault for managing and organizing your browser bookmarks.',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'tabs'],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';"
    },
    browser_specific_settings: {
      chrome: {
        id: '@sanctuar'
      },
      gecko: {
        id: '@sanctuar'
      },
      edge: {
        id: '@sanctuar'
      }
    } as any
  }
})
