/**
 * VaultView component - Empty bookmarks page (unlocked vault)
 */

import type { UnlockedVault } from '../../lib/types';
import styles from './styles.module.css';

interface VaultViewProps {
    vault: UnlockedVault;
    onLock: () => void;
}

export default function VaultView({ vault, onLock }: VaultViewProps) {
    const { header, manifest } = vault;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Secure Bookmarks</h1>
                    <div className={styles.vaultInfo}>
                        <span className={styles.vaultLabel}>Vault:</span>
                        <span className={styles.vaultId}>{header.vault_uuid.slice(0, 8)}...</span>
                    </div>
                </div>
                <button className={styles.lockButton} onClick={onLock}>
                    🔒 Lock
                </button>
            </div>

            <div className={styles.content}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📚</div>
                    <h2 className={styles.emptyTitle}>No Bookmarks Yet</h2>
                    <p className={styles.emptyText}>
                        Your vault is ready. Bookmark management features will be added in the next milestone.
                    </p>
                </div>

                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{manifest.book_index.length}</span>
                        <span className={styles.statLabel}>Bookmarks</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>{manifest.version_counter}</span>
                        <span className={styles.statLabel}>Version</span>
                    </div>
                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.securityInfo}>
                    <p className={styles.securityText}>
                        🔐 End-to-end encrypted with {header.kdf.algo.toUpperCase()} and {header.aead.algo}
                    </p>
                    <p className={styles.securityDetail}>
                        Created: {new Date(header.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}

