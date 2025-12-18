import { Hono } from 'hono'
import { config } from './config'
import authRoutes from './routes/auth.routes'
import bookmarkTagRoutes from './routes/bookmark-tag.routes'
import bookmarkRoutes from './routes/bookmark.routes'
import tagRoutes from './routes/tag.routes'
import userRoutes from './routes/user.routes'
import vaultRoutes from './routes/vault.routes'

const app = new Hono()

// Global CORS middleware (applies to all routes, including 404s)
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || ''
  const isAllowedOrigin =
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://')

  // Only allow specific origins - no wildcard fallback for security
  if (!isAllowedOrigin && origin !== '') {
    return c.json({ error: 'Origin not allowed' }, 403)
  }

  const allowOrigin = isAllowedOrigin ? origin : '*'
  const allowMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  const requestHeaders = c.req.header('Access-Control-Request-Headers')
  const allowHeaders = requestHeaders || 'Content-Type, Authorization'

  // Pre-set headers so even early returns include CORS
  c.res.headers.set('Access-Control-Allow-Origin', allowOrigin)
  c.res.headers.set('Access-Control-Allow-Methods', allowMethods)
  c.res.headers.set('Access-Control-Allow-Headers', allowHeaders)
  c.res.headers.set('Access-Control-Expose-Headers', 'ETag, Content-Type')
  c.res.headers.set('Vary', 'Origin')
  if (isAllowedOrigin) {
    // Only advertise credentials when a specific origin is reflected
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: c.res.headers // reuse the headers we just set
    })
  }

  await next()

  // Ensure CORS headers are present on all responses
  c.res.headers.set('Access-Control-Allow-Origin', allowOrigin)
  c.res.headers.set('Access-Control-Allow-Methods', allowMethods)
  c.res.headers.set('Access-Control-Allow-Headers', allowHeaders)
  c.res.headers.set('Access-Control-Expose-Headers', 'ETag, Content-Type')
  c.res.headers.set('Vary', 'Origin')
  if (isAllowedOrigin) {
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  } else {
    c.res.headers.delete('Access-Control-Allow-Credentials')
  }
})

// Mount routes
app.route('/auth', authRoutes)
app.route('/user', userRoutes)
app.route('/vault', vaultRoutes)
app.route('/bookmarks', bookmarkRoutes)
app.route('/tags', tagRoutes)
app.route('/bookmark-tags', bookmarkTagRoutes)

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Bookmarks API - Secure authentication system'
  })
})

// Start server bound to loopback only (127.0.0.1)
// @ts-ignore - Bun is available at runtime
const server = Bun.serve({
  port: config.server.port,
  hostname: config.server.host,
  fetch: app.fetch
})
