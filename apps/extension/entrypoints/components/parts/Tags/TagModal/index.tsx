import { Button, Checkbox, Flex, Text, TextField } from "@radix-ui/themes";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Tag } from "@/entrypoints/lib/types";
import { validateTagName } from "@/entrypoints/lib/validation";

import { Drawer } from "@/entrypoints/components/ui/Drawer";
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
  onSave: (data: { name: string; hidden: boolean }) => void;
}) => {
  const [name, setName] = useState(tag?.name || "");
  const [hidden, setHidden] = useState(tag?.hidden ?? false);
  const nameField = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Update form fields when tag prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(tag?.name || "");
      setHidden(tag?.hidden ?? false);
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
          hidden: hidden,
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

    // For existing tags, check if name or hidden changed
    return name.trim() !== tag.name || hidden !== (tag.hidden ?? false);
  }, [name, hidden, tag]);

  if (!isOpen) return null;

  return (
    <Drawer
      title={tag ? "Edit Tag" : "Add Tag"}
      description={tag ? "Manage tag details" : "Create a new tag"}
      open={isOpen}
      onClose={onClose}
    >
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

        <Text as="label" size="2">
          <Flex gap="2">
            <Checkbox
              checked={hidden}
              onCheckedChange={(checked: boolean | "indeterminate") =>
                setHidden(checked === true)
              }
            />
            Hide tag from list
          </Flex>
        </Text>
      </Flex>

      <div className={styles.actions}>
        <Button
          onClick={handleSubmit}
          disabled={!hasChanges || isLoading}
          className={styles.saveButton}
        >
          {isLoading && <Loader2 className={styles.spinner} />}
          {tag ? "Save" : "Create"}
        </Button>
      </div>
    </Drawer>
  );
};
