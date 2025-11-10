import { DropdownMenu, IconButton, Text } from "@radix-ui/themes";
import { EllipsisVertical, LineSquiggle } from "lucide-react";

import Interactible from "../../ui/Interactible";
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
      <Interactible
        tone="light"
        isActive={active}
        className={`${styles.tag} ${active ? "" : styles.inactive}`}
        onClick={onClick}
      >
        <div className={styles.tagLabel}>
          {all && <LineSquiggle height={16} width={16} />}
          <Text size="2" weight="regular">
            {name}
          </Text>
        </div>
        <div className={`${styles.tagEnd} ${!all ? styles.countItem : ""}`}>
          <Text size="1" color="gray">
            {count}
          </Text>
        </div>
      </Interactible>

      {!all && (onEdit || onDelete) && (
        <div className={styles.dropdownMenu}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton
                variant="ghost"
                size="1"
                className={styles.menuButton}
              >
                <EllipsisVertical size={16} color="gray" strokeWidth={1} />
              </IconButton>
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
