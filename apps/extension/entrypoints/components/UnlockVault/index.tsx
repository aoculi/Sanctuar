/**
 * UnlockVault component - Password entry for existing vault
 * Used when the user has already created/opened a vault before
 */

import React, { useState } from 'react';
import styles from './styles.module.css';

interface UnlockVaultProps {
    vaultName: string;
    onUnlock: (password: string) => Promise<void>;
    onForget: () => void;
}

export default function UnlockVault({ vaultName, onUnlock, onForget }: UnlockVaultProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!password) {
            setError('Password cannot be empty.');
            return;
        }

        try {
            setIsUnlocking(true);
            await onUnlock(password);
            // Success - parent component will handle navigation
        } catch (err) {
            setError((err as Error).message || 'Failed to unlock vault. Please check your password.');
            setIsUnlocking(false);
            setPassword(''); // Clear password on failure
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Unlock Vault</h1>
                <p className={styles.vaultName}>{vaultName}</p>
            </div>

            <form className={styles.form} onSubmit={handleUnlock}>
                <div className={styles.inputGroup}>
                    <label htmlFor="password" className={styles.label}>
                        Master Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isUnlocking}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        autoFocus
                    />
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                    type="submit"
                    className={styles.unlockButton}
                    disabled={!password || isUnlocking}
                >
                    {isUnlocking ? 'Unlocking...' : 'Unlock'}
                </button>
            </form>

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.forgetButton}
                    onClick={onForget}
                    disabled={isUnlocking}
                >
                    Use Different Vault
                </button>
            </div>
        </div>
    );
}

