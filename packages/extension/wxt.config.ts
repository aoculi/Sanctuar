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

  manifest: (env) => {
    const basePermissions: string[] = ['storage', 'tabs']

    // Add contextMenus permission for sidebar context menu item
    basePermissions.push('contextMenus')

    const manifest: any = {
      name: 'LockMark',
      description: 'Secure Bookmarks Vault',
      host_permissions: ['http://127.0.0.1:3500/*', 'http://localhost:3500/*'],
      permissions: basePermissions,
      content_security_policy: {
        extension_pages:
          "script-src 'self' http://localhost:3000 http://localhost:3001 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';"
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

    return manifest
  }
})
