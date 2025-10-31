import { Button, Dialog, Flex, TextField } from "@radix-ui/themes";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { validateTagName } from "@/entrypoints/lib/validation";
import type { Tag } from "../../../lib/types";

import styles from "./styles.module.css";

export const TagModal = ({
  isOpen,
  tag,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  tag: Tag | null;
  onClose: () => void;
  onSave: (data: { name: string }) => void;
}) => {
  const [name, setName] = useState(tag?.name || "");
  const nameField = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Update form fields when tag prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(tag?.name || "");
      setErrors({});
      setIsLoading(false);
      setTimeout(() => {
        nameField?.current?.focus();
      }, 0);
    }
  }, [isOpen, tag]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    const validationError = validateTagName(name);
    if (validationError) {
      newErrors.name = validationError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      // Call onSave - wrap in Promise.resolve to handle both sync and async cases
      await Promise.resolve(
        onSave({
          name: name.trim(),
        })
      );

      onClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are changes and name is set
  const hasChanges = useMemo(() => {
    if (!name.trim()) {
      return false;
    }

    if (!tag) {
      // For new tags, there's a change if name is set
      return true;
    }

    // For existing tags, check if name changed
    return name.trim() !== tag.name;
  }, [name, tag]);

  if (!isOpen) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content maxWidth="450px">
        <div className={styles.header}>
          <Button
            variant="solid"
            onClick={onClose}
            className={styles.closeButton}
          >
            <X strokeWidth={1} />
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isLoading}
            className={styles.saveButton}
          >
            {isLoading && <Loader2 className={styles.spinner} />}
            {tag ? "Save" : "Create"}
          </Button>
        </div>

        <Dialog.Description size="2" mb="4">
          {tag ? "Update tag name" : "Create a new tag"}
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <TextField.Root
            ref={nameField}
            size="3"
            type="text"
            placeholder="Tag name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: "" });
            }}
          />

          {errors.name && (
            <span className={styles.fieldError}>{errors.name}</span>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
