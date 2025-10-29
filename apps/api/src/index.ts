import { Hono } from 'hono';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import bookmarkTagRoutes from './routes/bookmark-tag.routes';
import bookmarkRoutes from './routes/bookmark.routes';
import tagRoutes from './routes/tag.routes';
import userRoutes from './routes/user.routes';
import vaultRoutes from './routes/vault.routes';

const app = new Hono();

// Mount routes
app.route('/auth', authRoutes);
app.route('/user', userRoutes);
app.route('/vault', vaultRoutes);
app.route('/bookmarks', bookmarkRoutes);
app.route('/tags', tagRoutes);
app.route('/bookmark-tags', bookmarkTagRoutes);

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Bookmarks API - Secure authentication system',
  });
});

// Start server bound to loopback only (127.0.0.1)
export default {
  port: config.server.port,
  hostname: config.server.host,
  fetch: app.fetch,
};
