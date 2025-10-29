/**
 * CreateVault component - Storage selection and password entry
 */

import React, { useState } from 'react';
import styles from './styles.module.css';

interface CreateVaultProps {
    onBack: () => void;
    onCreate: (fileHandle: FileSystemFileHandle, password: string) => Promise<void>;
}

export default function CreateVault({ onBack, onCreate }: CreateVaultProps) {
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleSelectLocation = async () => {
        setError('');

        // Check if File System Access API is supported
        if (!('showSaveFilePicker' in window)) {
            const errorMsg = 'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.';
            setError(errorMsg);
            return;
        }

        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'vault.bin',
                types: [
                    {
                        description: 'Vault File',
                        accept: { 'application/octet-stream': ['.bin'] },
                    },
                ],
            });

            setFileHandle(handle);
            setError('');
        } catch (err) {
            // Handle different types of errors
            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    // User cancelled - don't show error
                    return;
                } else if (err.name === 'NotAllowedError') {
                    setError('Permission denied. Please allow file access and try again.');
                } else if (err.name === 'SecurityError') {
                    setError('Security error. Please ensure you\'re using HTTPS and try again.');
                } else {
                    setError(`Failed to select location: ${err.message || 'Unknown error'}`);
                }
            } else {
                // Handle non-Error objects
                const errorStr = typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err);
                setError(`Failed to select location. Error: ${errorStr}`);
            }
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!password) {
            setError('Password cannot be empty.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (!fileHandle) {
            setError('Please select a location for your vault.');
            return;
        }

        try {
            setIsCreating(true);
            await onCreate(fileHandle, password);
            // Success - parent component will handle navigation
        } catch (err) {
            let errorMessage = 'Failed to create vault. Please try again.';

            if (err instanceof Error) {
                if (err.message) {
                    errorMessage = err.message;
                } else if (err.name) {
                    errorMessage = `Error: ${err.name}`;
                }
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else if (typeof err === 'object' && err !== null) {
                errorMessage = `Error: ${JSON.stringify(err, null, 2)}`;
            }

            setError(errorMessage);
            setIsCreating(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className={styles.backButton} onClick={onBack} disabled={isCreating}>
                    ← Back
                </button>
                <h1 className={styles.title}>Create New Vault</h1>
            </div>

            <form className={styles.form} onSubmit={handleCreate}>
                {/* Step 1: Select Location */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Choose Storage Location</h2>
                    <button
                        type="button"
                        className={styles.selectButton}
                        onClick={handleSelectLocation}
                        disabled={isCreating}
                    >
                        {fileHandle ? `Selected: ${fileHandle.name}` : 'Select Location...'}
                    </button>
                    {fileHandle && (
                        <p className={styles.helperText}>
                            Vault will be saved as: {fileHandle.name}
                        </p>
                    )}
                </div>

                {/* Step 2: Set Password */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Set Master Password</h2>
                    <div className={styles.inputGroup}>
                        <label htmlFor="password" className={styles.label}>
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isCreating}
                            placeholder="Enter password"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="confirmPassword" className={styles.label}>
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className={styles.input}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isCreating}
                            placeholder="Confirm password"
                            autoComplete="new-password"
                        />
                    </div>

                    <p className={styles.warning}>
                        ⚠️ There is no password recovery. Keep your password safe.
                    </p>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                    type="submit"
                    className={styles.createButton}
                    disabled={!fileHandle || !password || !confirmPassword || isCreating}
                >
                    {isCreating ? 'Creating Vault...' : 'Create Vault'}
                </button>
            </form>
        </div>
    );
}

