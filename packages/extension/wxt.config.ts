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

  manifest: ({ manifestVersion }) => ({
    name: 'Sanctuar',
    description: 'A secure, privacy-focused local vault for managing and organizing your browser bookmarks.',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'tabs'],
    // Keyboard shortcut that opens the popup (users can remap it in
    // about:addons → Manage Extension Shortcuts / chrome://extensions/shortcuts)
    commands: {
      [manifestVersion === 2 ? '_execute_browser_action' : '_execute_action']: {
        suggested_key: { default: 'Alt+Shift+B', mac: 'Alt+Shift+B' },
        description: 'Save the current page to Sanctuar'
      }
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';"
    },
    browser_specific_settings: {
      chrome: {
        id: '@sanctuar'
      },
      gecko: {
        id: '@sanctuar',
        data_collection_permissions: {
          required: ['none']
        }
      },
      edge: {
        id: '@sanctuar'
      }
    } as any
  })
})
