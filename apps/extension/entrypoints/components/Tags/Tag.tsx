import { Button, DropdownMenu, Text } from "@radix-ui/themes";
import { EllipsisVertical, LineSquiggle } from "lucide-react";

import styles from "./styles.module.css";

export default function Tag({
  name,
  count,
  all = false,
  active = false,
  onClick,
  onEdit,
  onDelete,
}: {
  name: string;
  count: number;
  all: boolean;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={styles.tagWrapper}>
      <Button
        className={`${styles.tag} ${active ? "" : styles.inactive}`}
        onClick={onClick}
      >
        <div className={styles.tagLabel}>
          {all && <LineSquiggle height={16} width={16} />}
          <Text>{name}</Text>
        </div>

        <div className={styles.tagEnd}>
          <Text>{count}</Text>
        </div>
      </Button>

      {!all && (onEdit || onDelete) && (
        <div className={styles.dropdownMenu}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button variant="soft" size="1" className={styles.menuButton}>
                <EllipsisVertical height={16} width={14} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {onEdit && (
                <DropdownMenu.Item onClick={onEdit}>Edit</DropdownMenu.Item>
              )}
              {onEdit && onDelete && <DropdownMenu.Separator />}
              {onDelete && (
                <DropdownMenu.Item onClick={onDelete} color="red">
                  Delete
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  );
}
