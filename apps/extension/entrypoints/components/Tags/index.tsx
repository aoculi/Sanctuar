import { Button, Text } from "@radix-ui/themes";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useTags } from "@/entrypoints/hooks/useTags";
import type { Bookmark, Tag as EntityTag } from "@/entrypoints/lib/types";
import Tag from "./Tag";

import { StatusIndicator } from "../StatusIndicator";
import styles from "./styles.module.css";

export default function Tags({
  bookmarks,
  currentTagId,
  onSelectTag,
}: {
  bookmarks: Bookmark[];
  currentTagId: string | null;
  onSelectTag: (id: string) => void;
}) {
  const { tags, createTag, renameTag, deleteTag } = useTags();
  const [message, setMessage] = useState<string | null>(null);

  const onAddTag = () => {
    const name = prompt("Enter tag name:");
    if (name && name.trim()) {
      try {
        createTag({ name: name.trim() });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create tag";
        setMessage(errorMessage);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  const onEditTag = (tag: EntityTag) => {
    const newName = prompt("Enter new tag name:", tag.name);
    if (newName && newName.trim() && newName !== tag.name) {
      try {
        renameTag(tag.id, newName.trim());
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to rename tag";
        setMessage(errorMessage);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  const onDeleteTag = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this tag? It will be removed from all bookmarks."
      )
    ) {
      try {
        deleteTag(id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete tag";
        setMessage(errorMessage);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Text size="4" color="violet">
            Tags
          </Text>

          <Button onClick={onAddTag} variant="ghost">
            <Plus strokeWidth={1} />
          </Button>
        </div>

        {/* Sort tags button? by name, by length*/}

        <div className={styles.list}>
          <Tag
            name="All tags"
            count={bookmarks.length}
            all={true}
            active={currentTagId === "all"}
            onClick={() => onSelectTag("all")}
          />

          {tags.length === 0 && (
            <p className={styles.emptyState}>No tags yet</p>
          )}

          {tags.length > 0 &&
            tags.map((tag) => (
              <Tag
                key={tag.id}
                onClick={() => onSelectTag(tag.id)}
                name={tag.name}
                count={
                  bookmarks.filter((bookmark) => bookmark.tags.includes(tag.id))
                    .length
                }
                all={false}
                active={currentTagId === tag.id}
              />
            ))}
        </div>
      </div>
      <StatusIndicator />
    </div>
  );
}
