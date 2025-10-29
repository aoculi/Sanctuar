/**
 * Status indicator component
 */
import { useManifest } from '../hooks/vault';
import styles from './styles.module.css';

export function StatusIndicator() {
    const { store } = useManifest();

    const getStatusText = () => {
        switch (store.status) {
            case 'loaded':
                return 'Synced';
            case 'dirty':
                return 'Editing…';
            case 'saving':
                return 'Saving…';
            case 'offline':
                return 'Offline';
            default:
                return '';
        }
    };

    return <span className={styles.indicator}>{getStatusText()}</span>;
}
