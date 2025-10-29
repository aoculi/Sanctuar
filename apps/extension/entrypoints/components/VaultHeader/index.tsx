/**
 * Header component for Vault screen
 */
import { useLogout } from '../../hooks/auth';
import { useManifest } from '../../hooks/vault';
import { StatusIndicator } from '../StatusIndicator';
import styles from './styles.module.css';

type Props = {
    onSave: () => void;
};

export function VaultHeader({ onSave }: Props) {
    const logoutMutation = useLogout();
    const { mutation, store } = useManifest();

    const handleLogout = async () => {
        try {
            await logoutMutation.mutateAsync();
        } catch (err) {
            // Error handling done via logoutMutation.error in UI
        }
    };

    return (
        <div className={styles.header}>
            <h2 className={styles.title}>Vault</h2>
            <div className={styles.actions}>
                <StatusIndicator />
                {(store.status === 'dirty' || store.status === 'offline') && (
                    <button
                        onClick={onSave}
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
    );
}
