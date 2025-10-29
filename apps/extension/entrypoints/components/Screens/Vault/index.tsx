
import { useLogout } from '../../hooks/auth';
import styles from './styles.module.css';

export default function Vault() {
    const logoutMutation = useLogout();

    const handleLogout = async () => {
        try {
            await logoutMutation.mutateAsync();
            // The mutation will handle clearing session and redirect via App component
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Vault</h2>
                <button
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className={`${styles.logoutButton} ${logoutMutation.isPending ? styles.logoutButtonDisabled : ''}`}
                >
                    {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                </button>
            </div>

            <div className={styles.card}>
                <p>Welcome to your secure vault!</p>
                <p>Your session is active and secure.</p>
                <p>All sensitive data is stored in memory only.</p>
            </div>
        </div>
    );
}
