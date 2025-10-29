/**
 * Manifest size warning component
 */
import { useManifestSize } from '../../hooks/bookmarks';
import type { ManifestV1 } from '../../lib/types';
import styles from './styles.module.css';

type Props = {
    manifest: ManifestV1 | null;
};

export function ManifestSizeWarning({ manifest }: Props) {
    const { size, showWarning } = useManifestSize(manifest);

    if (!showWarning) return null;

    return (
        <div className={styles.warning}>
            ⚠️ Manifest size: {(size / 1024 / 1024).toFixed(2)} MB. Consider cleaning up or we will migrate to item blobs.
        </div>
    );
}
