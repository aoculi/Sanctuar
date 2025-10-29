
import { useState } from 'react';
import { useLogin } from '../../hooks/auth';
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

    const loginMutation = useLogin();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.login.trim() || !formData.password.trim()) {
            setError('Please fill in all fields');
            return;
        }

        try {
            await loginMutation.mutateAsync({
                login: formData.login.trim(),
                password: formData.password
            });
            // Success - redirect to vault
            onLoginSuccess();
        } catch (err: any) {
            const baseMessage = err?.message || 'Login failed';
            const details = err?.details as Record<string, string[]> | undefined;
            if (details && typeof details === 'object') {
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
                    disabled={loginMutation.isPending}
                    className={`${styles.button} ${loginMutation.isPending ? styles.buttonDisabled : ''}`}
                >
                    {loginMutation.isPending ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}
