import {
  Button,
  CheckboxGroup,
  Dialog,
  DropdownMenu,
  Flex,
  TextField,
} from "@radix-ui/themes";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MAX_TAGS_PER_ITEM } from "@/entrypoints/lib/validation";
import type { Bookmark, Tag } from "../../../lib/types";

import styles from "./styles.module.css";

export const BookmarkModal = ({
  isOpen,
  bookmark,
  onClose,
  onSave,
  tags,
  tmp,
}: {
  isOpen: boolean;
  bookmark: Bookmark | null;
  onClose: () => void;
  onSave: (data: { url: string; title: string; tags: string[] }) => void;
  tags: Tag[];
  tmp: Bookmark | null;
}) => {
  const [url, setUrl] = useState(bookmark?.url || "");
  const [title, setTitle] = useState(bookmark?.title || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    bookmark?.tags || []
  );

  const urlField = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Update form fields when bookmark prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (tmp) {
        setUrl(tmp.url);
        setTitle(tmp.title);
        setSelectedTags([]);
      } else {
        setUrl(bookmark?.url || "");
        setTitle(bookmark?.title || "");
        setSelectedTags(bookmark?.tags || []);
      }
      setErrors({});
      setIsLoading(false);
      setTimeout(() => {
        urlField?.current?.focus();
      }, 0);
    }
  }, [isOpen, bookmark]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // URL validation
    if (!url.trim()) {
      newErrors.url = "URL is required";
    } else {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          newErrors.url = "URL must start with http:// or https://";
        }
      } catch {
        newErrors.url = "Please enter a valid URL";
      }
    }

    // Title validation
    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    // Tags validation
    if (selectedTags.length > MAX_TAGS_PER_ITEM) {
      newErrors.tags = `Maximum ${MAX_TAGS_PER_ITEM} tags per bookmark`;
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
          url: url.trim(),
          title: title.trim(),
          tags: selectedTags,
        })
      );

      onClose();
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are changes and URL is set
  const hasChanges = useMemo(() => {
    if (!url.trim()) {
      return false;
    }

    if (!bookmark) {
      // For new bookmarks, there's a change if URL is set
      return true;
    }

    // For existing bookmarks, check if any field changed
    const urlChanged = url.trim() !== bookmark.url;
    const titleChanged = title.trim() !== bookmark.title;

    // Check if tags changed (compare arrays)
    const tagsChanged =
      selectedTags.length !== bookmark.tags.length ||
      selectedTags.some((tag) => !bookmark.tags.includes(tag)) ||
      bookmark.tags.some((tag) => !selectedTags.includes(tag));

    return urlChanged || titleChanged || tagsChanged;
  }, [url, title, selectedTags, bookmark]);

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

          <div className={styles.actions}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="soft">
                  Tags
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <CheckboxGroup.Root
                  value={selectedTags}
                  name="Tags"
                  onValueChange={setSelectedTags}
                >
                  {tags.map((tag) => (
                    <CheckboxGroup.Item key={tag.id} value={tag.id}>
                      {tag.name}
                    </CheckboxGroup.Item>
                  ))}
                </CheckboxGroup.Root>
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button
              onClick={handleSubmit}
              disabled={!hasChanges || isLoading}
              className={styles.saveButton}
            >
              {isLoading && <Loader2 className={styles.spinner} />}
              {bookmark ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        <Dialog.Title>
          {bookmark ? "Edit Bookmark" : "Add Bookmark"}
        </Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Make changes to your profile.
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <TextField.Root
            ref={urlField}
            size="3"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errors.url) setErrors({ ...errors, url: "" });
            }}
          />

          {errors.url && (
            <span className={styles.fieldError}>{errors.url}</span>
          )}

          <TextField.Root
            size="3"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors({ ...errors, title: "" });
            }}
            placeholder="Bookmark title"
          />

          {errors.title && (
            <span className={styles.fieldError}>{errors.title}</span>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
