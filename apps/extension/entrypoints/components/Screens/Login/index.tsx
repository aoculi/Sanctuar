
import { useEffect, useState } from 'react';
import { useLoginAndUnlock } from '../../../hooks/auth';
import { whenCryptoReady } from '../../../lib/cryptoEnv';
import styles from './styles.module.css';

interface LoginProps {
    onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [formData, setFormData] = useState({
        login: '',
        password: ''
    });
    const [error, setError] = useState<string | string[] | null>(null);
    const [cryptoReady, setCryptoReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    const loginMutation = useLoginAndUnlock();

    // Check sodium ready state
    useEffect(() => {
        const checkCryptoReady = async () => {
            try {
                await whenCryptoReady();
                setCryptoReady(true);
            } catch (error) {
                console.error('Failed to initialize crypto:', error);
                setError('Failed to initialize encryption. Please refresh the extension.');
            } finally {
                setIsInitializing(false);
            }
        };

        checkCryptoReady();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!cryptoReady) {
            setError('Encryption not ready. Please wait...');
            return;
        }

        if (!formData.login.trim() || !formData.password.trim()) {
            setError('Please fill in all fields');
            return;
        }

        try {
            const result = await loginMutation.mutateAsync({
                login: formData.login.trim(),
                password: formData.password
            });

            // Success - both login and unlock completed
            // Security: Never log sensitive data (keys, tokens, etc.)
            onLoginSuccess();
        } catch (err: any) {
            // Handle WMK upload failure differently - keep session, allow retry
            const apiError = err as { status?: number; message?: string; details?: Record<string, any> };

            if (apiError.details?.wmkUploadFailed) {
                // WMK upload failed - show error but keep session
                setError('Could not initialize vault. Please try again.');
                return;
            }

            // Handle other errors
            const baseMessage = apiError.message || 'Login failed';
            const details = apiError.details as Record<string, string[]> | undefined;

            if (details && typeof details === 'object' && !details.wmkUploadFailed) {
                const lines: string[] = [];
                for (const [field, messages] of Object.entries(details)) {
                    if (Array.isArray(messages) && messages.length > 0) {
                        lines.push(`${field}: ${messages.join(', ')}`);
                    }
                }
                setError(lines.length > 0 ? [baseMessage, ...lines] : baseMessage);
            } else {
                setError(baseMessage);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <div className={styles.container}>
            <h2>Login</h2>

            {error && (
                <div className={styles.error}>
                    {Array.isArray(error) ? (
                        <ul>
                            {error.map((line, idx) => (
                                <li key={idx}>{line}</li>
                            ))}
                        </ul>
                    ) : (
                        error
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                    <label htmlFor="login" className={styles.label}>
                        Username or Email
                    </label>
                    <input
                        type="text"
                        id="login"
                        name="login"
                        value={formData.login}
                        onChange={handleChange}
                        disabled={loginMutation.isPending}
                        className={styles.input}
                        placeholder="Enter username or email"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="password" className={styles.label}>
                        Password
                    </label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={loginMutation.isPending}
                        className={styles.input}
                        placeholder="Enter password"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loginMutation.isPending || !cryptoReady || isInitializing}
                    className={`${styles.button} ${(loginMutation.isPending || !cryptoReady || isInitializing) ? styles.buttonDisabled : ''}`}
                >
                    {isInitializing ? 'Initializing...' : loginMutation.isPending ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}
