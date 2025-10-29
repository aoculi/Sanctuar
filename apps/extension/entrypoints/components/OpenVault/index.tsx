/**
 * OpenVault component - File selection and unlock
 */

import React, { useState } from 'react';
import styles from './styles.module.css';

interface OpenVaultProps {
    onBack: () => void;
    onUnlock: (fileHandle: FileSystemFileHandle, password: string) => Promise<void>;
}

export default function OpenVault({ onBack, onUnlock }: OpenVaultProps) {
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);

    const handleSelectFile = async () => {
        try {
            // Show file picker for opening vault
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'Vault File',
                        accept: { 'application/octet-stream': ['.bin'] },
                    },
                ],
                multiple: false,
            });

            setFileHandle(handle);
            setError('');
        } catch (err) {
            // User cancelled or error occurred
            if ((err as Error).name !== 'AbortError') {
                setError('Failed to open file. Please try again.');
            }
        }
    };

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!password) {
            setError('Password cannot be empty.');
            return;
        }

        if (!fileHandle) {
            setError('Please select a vault file.');
            return;
        }

        try {
            setIsUnlocking(true);
            await onUnlock(fileHandle, password);
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
                <button className={styles.backButton} onClick={onBack} disabled={isUnlocking}>
                    ← Back
                </button>
                <h1 className={styles.title}>Open Vault</h1>
            </div>

            <form className={styles.form} onSubmit={handleUnlock}>
                {/* Step 1: Select File */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Select Vault File</h2>
                    <button
                        type="button"
                        className={styles.selectButton}
                        onClick={handleSelectFile}
                        disabled={isUnlocking}
                    >
                        {fileHandle ? `Selected: ${fileHandle.name}` : 'Select File...'}
                    </button>
                    {fileHandle && (
                        <p className={styles.helperText}>
                            Ready to unlock: {fileHandle.name}
                        </p>
                    )}
                </div>

                {/* Step 2: Enter Password */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Enter Password</h2>
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
                            autoFocus={!!fileHandle}
                        />
                    </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                    type="submit"
                    className={styles.unlockButton}
                    disabled={!fileHandle || !password || isUnlocking}
                >
                    {isUnlocking ? 'Unlocking...' : 'Unlock Vault'}
                </button>
            </form>
        </div>
    );
}

