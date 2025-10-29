import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    host_permissions: ["http://127.0.0.1:3000/*", "http://localhost:3000/*"],
    permissions: ["storage"]
  }
});
