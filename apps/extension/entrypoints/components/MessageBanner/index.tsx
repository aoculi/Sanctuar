/**
 * Message banner component
 */
import { useManifest } from '../../hooks/vault';
import styles from './styles.module.css';

type Props = {
    message: string | null;
    onRetry?: () => void;
};

export function MessageBanner({ message, onRetry }: Props) {
    const { store } = useManifest();

    if (!message) return null;

    const isError = message.includes('error') || message.includes('Failed');
    const showRetry = store.status === 'offline' && onRetry;

    return (
        <div className={isError ? styles.error : styles.success}>
            {message}
            {showRetry && (
                <button onClick={onRetry} className={styles.retryButton}>
                    Retry
                </button>
            )}
        </div>
    );
}
