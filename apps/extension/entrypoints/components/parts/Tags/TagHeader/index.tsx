import { Plus } from "lucide-react";

import Button from "../../../ui/Button";
import Text from "../../../ui/Text";
import Menu from "../../Menu";

import styles from "./styles.module.css";

export default function TagHeader({ onAddTag }: { onAddTag: () => void }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <Menu isConnected={true} />

        <Text size="2" color="light" weight="medium">
          Lockmark
        </Text>
      </div>

      <Button
        onClick={onAddTag}
        asIcon={true}
        size="sm"
        color="primary"
        variant="solid"
      >
        <Plus strokeWidth={1} size={18} />
      </Button>
    </div>
  );
}
