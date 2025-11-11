import { EllipsisVertical, LineSquiggle } from "lucide-react";

import Button from "@/entrypoints/components/ui/Button";
import { DropdownMenu } from "@/entrypoints/components/ui/DropdownMenu";
import Text from "@/entrypoints/components/ui/Text";

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
      <a
        className={`${styles.tag} ${active ? styles.active : styles.inactive}`}
        href="#"
        onClick={onClick}
      >
        <div className={styles.tagLabel}>
          {all && <LineSquiggle height={16} width={16} />}
          <Text size="2">{name}</Text>
        </div>
        <div className={`${styles.tagEnd} ${!all ? styles.countItem : ""}`}>
          <Text size="2" weight="medium" color="light">
            {count}
          </Text>
        </div>
      </a>

      {!all && (onEdit || onDelete) && (
        <div className={styles.dropdownMenu}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button asIcon={true} color="dark" variant="ghost" size="sm">
                <EllipsisVertical size={16} />
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
