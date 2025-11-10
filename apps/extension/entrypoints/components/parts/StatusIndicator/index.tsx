/**
 * Status indicator component
 */
import { Text } from "@radix-ui/themes";

import { useManifestOperations } from "@/entrypoints/components/hooks/useManifestOperations";

export function StatusIndicator() {
  const { store } = useManifestOperations();

  const getStatusText = () => {
    switch (store.status) {
      case "loaded":
        return "Synced";
      case "dirty":
        return "Editing…";
      case "saving":
        return "Saving…";
      case "offline":
        return "Offline";
      default:
        return "";
    }
  };

  return (
    <Text size="1" color="gray">
      {getStatusText()}
    </Text>
  );
}
