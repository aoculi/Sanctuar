import * as Dialog from "@radix-ui/react-dialog";
import { Button, Text } from "@radix-ui/themes";
import { X } from "lucide-react";

import styles from "./styles.module.css";

export function Drawer({
  title,
  description,
  children,
  trigger,
  open,
  onClose,
  width = 530,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
  width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content style={{ width }} className={styles.content}>
        <div className={styles.header}>
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description && (
              <Text size="2" weight="medium" mb="4">
                {description}
              </Text>
            )}
          </div>
          <Button
            variant="solid"
            size="1"
            onClick={onClose}
            className={styles.closeButton}
          >
            <X strokeWidth={1} size={14} />
          </Button>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
