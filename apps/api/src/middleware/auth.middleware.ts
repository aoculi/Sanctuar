// Authentication middleware - verifies JWT tokens and attaches user info to context
import { Context, Next } from 'hono';
import { verifyToken } from '../libs/jwt';
import * as sessionRepository from '../repositories/session.repository';

/**
 * Extended context with authenticated user information
 */
export interface AuthContext {
    user: {
        userId: string;
        jwtId: string;
    };
}

/**
 * Middleware to verify JWT Bearer token
 * Attaches user info to context if valid
 * Returns 401 if token is missing, invalid, or session is revoked
 */
export async function requireAuth(c: Context, next: Next) {
    // Extract Bearer token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json(
            {
                error: 'Missing or invalid Authorization header',
            },
            401
        );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
        // Verify and decode JWT token
        const payload = await verifyToken(token);

        // Check if session exists and is not revoked
        const session = await sessionRepository.findSessionByJwtId(payload.jti);

        if (!session) {
            return c.json(
                {
                    error: 'Invalid session',
                },
                401
            );
        }

        if (session.revokedAt !== null) {
            return c.json(
                {
                    error: 'Session has been revoked',
                },
                401
            );
        }

        // Check if session has expired
        if (session.expiresAt < Date.now()) {
            return c.json(
                {
                    error: 'Session has expired',
                },
                401
            );
        }

        // Attach user info to request object for downstream handlers
        (c.req.raw as any).jwtId = payload.jti;
        (c.req.raw as any).userId = payload.sub;

        await next();
    } catch (error) {
        // Log error without sensitive data
        console.error('Token verification failed:', error instanceof Error ? error.message : 'Unknown error');

        return c.json(
            {
                error: 'Invalid or expired token',
            },
            401
        );
    }
}

