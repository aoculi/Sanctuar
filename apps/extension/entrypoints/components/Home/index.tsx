/**
 * Home component - First-run screen with Create/Open vault buttons
 */

import styles from './styles.module.css';

interface HomeProps {
    onCreateVault: () => void;
    onOpenVault: () => void;
    cryptoReady: boolean;
}

export default function Home({ onCreateVault, onOpenVault, cryptoReady }: HomeProps) {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Secure Bookmarks Vault</h1>
                <p className={styles.subtitle}>
                    End-to-end encrypted bookmark management
                </p>
            </div>

            <div className={styles.actions}>
                <button
                    className={styles.button}
                    onClick={onCreateVault}
                    disabled={!cryptoReady}
                >
                    Create Vault
                </button>

                <button
                    className={styles.button}
                    onClick={onOpenVault}
                    disabled={!cryptoReady}
                >
                    Open Vault
                </button>
            </div>

            {!cryptoReady && (
                <p className={styles.loading}>Initializing cryptography...</p>
            )}

            <div className={styles.info}>
                <p className={styles.infoText}>
                    Your bookmarks are encrypted with Argon2id and XChaCha20-Poly1305.
                    Only you can access them with your password.
                </p>
            </div>
        </div>
    );
}

