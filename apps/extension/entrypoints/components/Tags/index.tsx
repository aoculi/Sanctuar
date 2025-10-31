import { Button, DropdownMenu, Text } from "@radix-ui/themes";
import { ArrowUpDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useTags } from "@/entrypoints/hooks/useTags";
import type { Bookmark, Tag as EntityTag } from "@/entrypoints/lib/types";
import Tag from "./Tag";
import { TagModal } from "./TagModal";

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
  const [sortMode, setSortMode] = useState<"name" | "count">("name");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTag, setCurrentTag] = useState<EntityTag | null>(null);

  const onAddTag = () => {
    setCurrentTag(null);
    setIsModalOpen(true);
  };

  const onEditTag = (tag: EntityTag) => {
    setCurrentTag(tag);
    setIsModalOpen(true);
  };

  const handleSaveTag = async (data: { name: string }) => {
    try {
      if (currentTag) {
        // Editing existing tag
        await renameTag(currentTag.id, data.name);
      } else {
        // Creating new tag
        await createTag({ name: data.name });
      }
      setIsModalOpen(false);
      setCurrentTag(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save tag";
      setMessage(errorMessage);
      setTimeout(() => setMessage(null), 5000);
      throw error; // Re-throw to let modal handle loading state
    }
  };

  const onDeleteTag = (id: string) => {
    // TODO: remove the tag from all bookmarks
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

  const sortedTags = useMemo(() => {
    const tagsWithCounts = tags.map((tag) => ({
      tag,
      count: bookmarks.filter((bookmark) => bookmark.tags.includes(tag.id))
        .length,
    }));

    if (sortMode === "name") {
      return tagsWithCounts.sort((a, b) =>
        a.tag.name.localeCompare(b.tag.name)
      );
    } else {
      return tagsWithCounts.sort((a, b) => b.count - a.count);
    }
  }, [tags, bookmarks, sortMode]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Text size="4" color="violet">
            Tags
          </Text>

          <div className={styles.headerActions}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="ghost">
                  <ArrowUpDown strokeWidth={1} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onClick={() => setSortMode("name")}
                  disabled={sortMode === "name"}
                >
                  Sort by name
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => setSortMode("count")}
                  disabled={sortMode === "count"}
                >
                  Sort by bookmark count
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button onClick={onAddTag} variant="ghost">
              <Plus strokeWidth={1} />
            </Button>
          </div>
        </div>

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

          {sortedTags.length > 0 &&
            sortedTags.map(({ tag, count }) => (
              <Tag
                key={tag.id}
                onClick={() => onSelectTag(tag.id)}
                name={tag.name}
                count={count}
                all={false}
                active={currentTagId === tag.id}
                onEdit={() => onEditTag(tag)}
                onDelete={() => onDeleteTag(tag.id)}
              />
            ))}
        </div>
      </div>
      <StatusIndicator />
      <TagModal
        isOpen={isModalOpen}
        tag={currentTag}
        onClose={() => {
          setIsModalOpen(false);
          setCurrentTag(null);
        }}
        onSave={handleSaveTag}
      />
    </div>
  );
}
