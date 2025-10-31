/**
 * Status indicator component
 */
import { Text } from "@radix-ui/themes";
import { useManifest } from "../../hooks/vault";

export function StatusIndicator() {
  const { store } = useManifest();

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
    <Text size="2" color="gray">
      {getStatusText()}
    </Text>
  );
}
