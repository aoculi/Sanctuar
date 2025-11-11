import { useManifestOperations } from "@/entrypoints/components/hooks/useManifestOperations";
import Text from "@/entrypoints/components/ui/Text";

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
    <Text size="1" color="light">
      {getStatusText()}
    </Text>
  );
}
