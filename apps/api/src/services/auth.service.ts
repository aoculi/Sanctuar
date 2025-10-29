// Authentication service - handles user registration and login
import { nanoid } from 'nanoid';
import { generateKdfParams, hashPassword, verifyPassword } from '../libs/crypto';
import { generateToken, getExpirationTimestamp } from '../libs/jwt';
import * as sessionRepository from '../repositories/session.repository';
import * as userRepository from '../repositories/user.repository';

export interface RegisterUserInput {
    login: string;
    password: string;
}

export interface RegisterUserOutput {
    user_id: string;
    kdf: {
        algo: string;
        salt: string;
        m: number;
        t: number;
        p: number;
    };
}

export interface LoginUserInput {
    login: string;
    password: string;
}

export interface LoginUserOutput {
    user_id: string;
    token: string;
    expires_at: number;
    kdf: {
        algo: string;
        salt: string;
        m: number;
        t: number;
        p: number;
    };
    wrapped_mk: string | null;
}

/**
 * Register a new user
 * - Checks login availability
 * - Hashes password with Argon2id (AUTH parameters)
 * - Generates KDF parameters for client-side UEK derivation
 * - Stores user credentials securely
 * @throws Error if login already exists or registration fails
 */
export const registerUser = async (input: RegisterUserInput): Promise<RegisterUserOutput> => {
    const { login, password } = input;

    // Check if login already exists
    const exists = await userRepository.loginExists(login);
    if (exists) {
        const error = new Error('Login already exists');
        error.name = 'ConflictError';
        throw error;
    }

    // Generate user ID
    const userId = `u_${nanoid(21)}`;

    // Hash password with Argon2id (AUTH parameters) - generates its own salt
    const authHash = await hashPassword(password);

    // Generate KDF parameters for client-side UEK derivation
    const kdfParams = generateKdfParams();

    // Get current timestamp
    const now = Date.now();

    // Insert user into database
    try {
        await userRepository.createUser({
            userId,
            login,
            authHash,
            kdfAlgo: kdfParams.algo,
            kdfSalt: kdfParams.saltBuffer,
            kdfM: kdfParams.m,
            kdfT: kdfParams.t,
            kdfP: kdfParams.p,
            createdAt: now,
            updatedAt: now,
        });

        // Log success (no sensitive data)
        console.log(`User registered successfully: ${userId}`);

        // Return only what client needs for UEK derivation
        return {
            user_id: userId,
            kdf: {
                algo: kdfParams.algo,
                salt: kdfParams.salt,
                m: kdfParams.m,
                t: kdfParams.t,
                p: kdfParams.p,
            },
        };
    } catch (error) {
        // Log error without sensitive data
        console.error('User registration failed:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to register user');
    }
}

/**
 * Login user and create session
 * - Verifies password against stored hash
 * - Creates session and generates JWT token
 * - Returns user info, token, and KDF parameters
 * @throws Error if credentials are invalid
 */
export const loginUser = async (input: LoginUserInput): Promise<LoginUserOutput> => {
    const { login, password } = input;

    // Lookup user by login
    const user = await userRepository.findUserByLogin(login);
    if (!user) {
        const error = new Error('Invalid credentials');
        error.name = 'UnauthorizedError';
        throw error;
    }

    // Verify password (constant-time compare via Argon2id)
    const isValid = await verifyPassword(user.authHash, password);
    if (!isValid) {
        // Log failed attempt (no sensitive data)
        console.log(`Login failed for user: ${user.userId}`);

        const error = new Error('Invalid credentials');
        error.name = 'UnauthorizedError';
        throw error;
    }

    // Generate session ID and JWT ID
    const sessionId = `s_${nanoid(21)}`;
    const jwtId = `jti_${nanoid(21)}`;

    // Calculate expiration
    const expiresAt = getExpirationTimestamp();

    // Generate JWT token
    const token = await generateToken(user.userId, jwtId);

    // Create session record
    try {
        await sessionRepository.createSession({
            sessionId,
            userId: user.userId,
            jwtId,
            expiresAt,
            createdAt: Date.now(),
        });

        // Log successful login (no sensitive data)
        console.log(`User logged in successfully: ${user.userId}`);

        // Format wrapped master key (if exists)
        let wrappedMk: string | null = null;
        if (user.wmkCiphertext && user.wmkNonce) {
            // Combine nonce + ciphertext as base64
            const combined = Buffer.concat([user.wmkNonce, user.wmkCiphertext]);
            wrappedMk = combined.toString('base64');
        }

        // Return session info and KDF parameters
        return {
            user_id: user.userId,
            token,
            expires_at: expiresAt,
            kdf: {
                algo: user.kdfAlgo,
                salt: user.kdfSalt.toString('base64'),
                m: user.kdfM,
                t: user.kdfT,
                p: user.kdfP,
            },
            wrapped_mk: wrappedMk,
        };
    } catch (error) {
        // Log error without sensitive data
        console.error('Session creation failed:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to create session');
    }
}

/**
 * Logout user and revoke session
 * - Marks the session as revoked
 * @param jwtId - JWT ID from the verified token
 */
export const logoutUser = async (jwtId: string): Promise<void> => {
    try {
        // Revoke the session by JWT ID
        await sessionRepository.revokeSessionByJwtId(jwtId);

        // Log successful logout (no sensitive data)
        console.log(`Session revoked: ${jwtId}`);

    } catch (error) {
        // Log error without sensitive data
        console.error('Session revocation failed:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to revoke session');
    }
}
