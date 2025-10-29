
import { useEffect, useState } from 'react';
import { useLogout } from '../../hooks/auth';
import { useManifest } from '../../hooks/vault';
import { keystoreManager } from '../../store';
import styles from './styles.module.css';

export default function Vault() {
    const logoutMutation = useLogout();
    const { query, mutation, store } = useManifest();
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [message, setMessage] = useState<string | null>(null);

    // Check keystore status on mount
    useEffect(() => {
        const checkKeystoreStatus = async () => {
            try {
                const unlocked = await keystoreManager.isUnlocked();
                setIsUnlocked(unlocked);
            } catch (error) {
                console.error('Failed to check keystore status:', error);
                setIsUnlocked(false);
            } finally {
                setIsChecking(false);
            }
        };

        checkKeystoreStatus();
    }, []);

    // Show messages for manifest operations
    useEffect(() => {
        if (mutation.isSuccess) {
            setMessage('Changes saved successfully');
            setTimeout(() => setMessage(null), 3000);
        } else if (mutation.isError) {
            setMessage('Failed to save changes');
            setTimeout(() => setMessage(null), 3000);
        }
    }, [mutation.isSuccess, mutation.isError]);

    const handleLogout = async () => {
        try {
            await logoutMutation.mutateAsync();
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const handleSave = async () => {
        if (store.status === 'dirty') {
            try {
                await mutation.mutateAsync();
            } catch (error) {
                // Error handling done in useEffect
            }
        }
    };

    if (isChecking) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <p>Checking vault status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Vault</h2>
                <div className={styles.headerActions}>
                    {store.status === 'dirty' && (
                        <button
                            onClick={handleSave}
                            disabled={mutation.isPending}
                            className={styles.saveButton}
                        >
                            {mutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                        className={`${styles.logoutButton} ${logoutMutation.isPending ? styles.logoutButtonDisabled : ''}`}
                    >
                        {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={message.includes('error') || message.includes('Failed') ? styles.errorMessage : styles.successMessage}>
                    {message}
                </div>
            )}

            <div className={styles.card}>
                {isUnlocked ? (
                    <>
                        <p className={styles.successMessage}>🔓 Vault Unlocked</p>
                        <p>Your vault is unlocked and ready to use.</p>
                        <p>All sensitive data is stored in memory only.</p>
                        <p>Keys will be cleared when you close the extension or logout.</p>

                        {query.isLoading && <p>Loading manifest...</p>}
                        {query.isError && <p className={styles.errorMessage}>Failed to load manifest</p>}

                        {store.manifest && (
                            <div className={styles.manifestInfo}>
                                <h3>Manifest Status</h3>
                                <p>Status: <span className={styles.status}>{store.status}</span></p>
                                <p>Version: {store.serverVersion}</p>
                                <p>Bookmarks: {store.manifest.book_index?.length || 0}</p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <p className={styles.errorMessage}>🔒 Vault Locked</p>
                        <p>Your vault is locked. Please login again to unlock it.</p>
                        <p>This may happen if the extension was restarted or keys were cleared.</p>
                    </>
                )}
            </div>
        </div>
    );
}
