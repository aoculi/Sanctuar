/**
 * Message banner component
 */
import { useManifestSize } from "@/entrypoints/hooks/validation";
import { useManifest } from "../../../hooks/vault";
import { ManifestSizeWarning } from "../../ManifestSizeWarning";
import styles from "./styles.module.css";

type Props = {
  message: string | null;
  onRetry?: () => void;
};

export function MessageBanner({ message, onRetry }: Props) {
  const { store, query } = useManifest();

  const { showWarning: showSizeWarning } = useManifestSize(store.manifest);

  if (!message) return null;

  const isError = message.includes("error") || message.includes("Failed");
  const showRetry = store.status === "offline" && onRetry;

  return (
    <div className={isError ? styles.error : styles.success}>
      {message}
      {query.isLoading && <p>Loading manifest...</p>}
      {query.isError && (
        <p className={styles.errorMessage}>Failed to load manifest</p>
      )}

      {showSizeWarning && <ManifestSizeWarning manifest={store.manifest} />}
      {showRetry && (
        <button onClick={onRetry} className={styles.retryButton}>
          Retry
        </button>
      )}
    </div>
  );
}
