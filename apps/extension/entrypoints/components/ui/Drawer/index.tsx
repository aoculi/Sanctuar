import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import Button from "@/entrypoints/components/ui/Button";

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
              <Dialog.Description style={{ fontSize: "14px" }}>
                {description}
              </Dialog.Description>
            )}
          </div>
          <Button
            asIcon={true}
            color="light"
            variant="solid"
            size="sm"
            onClick={onClose}
          >
            <X strokeWidth={1} size={18} />
          </Button>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
