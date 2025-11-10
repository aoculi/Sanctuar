import { DropdownMenu, IconButton, Text } from "@radix-ui/themes";
import { ListFilter, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTags } from "@/entrypoints/components/hooks/useTags";
import Menu from "@/entrypoints/components/parts/Menu";
import { StatusIndicator } from "@/entrypoints/components/parts/StatusIndicator";
import Background from "@/entrypoints/components/ui/Background";
import type { Bookmark, Tag as EntityTag, Tag } from "@/entrypoints/lib/types";
import { settingsStore } from "@/entrypoints/store/settings";
import TagComponent from "./Tag";
import { TagModal } from "./TagModal";

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
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  // Subscribe to settings changes
  useEffect(() => {
    const loadSettings = async () => {
      const currentState = await settingsStore.getState();
      setShowHiddenTags(currentState.showHiddenTags);
    };

    loadSettings();

    const unsubscribe = settingsStore.subscribe(async () => {
      const state = await settingsStore.getState();
      setShowHiddenTags(state.showHiddenTags);
    });

    return unsubscribe;
  }, []);

  const onAddTag = () => {
    setCurrentTag(null);
    setIsModalOpen(true);
  };

  const onEditTag = (tag: EntityTag) => {
    setCurrentTag(tag);
    setIsModalOpen(true);
  };

  const handleSaveTag = async (data: { name: string; hidden: boolean }) => {
    try {
      if (currentTag) {
        // Editing existing tag
        await renameTag(currentTag.id, data.name, data.hidden);
      } else {
        // Creating new tag
        await createTag({ name: data.name, hidden: data.hidden ?? false });
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
    let tagsWithCounts = tags.map((tag: Tag) => ({
      tag,
      count: bookmarks.filter((bookmark) => bookmark.tags.includes(tag.id))
        .length,
    }));

    // Filter hidden tags based on settings
    if (!showHiddenTags) {
      tagsWithCounts = tagsWithCounts.filter(
        (tag: { tag: Tag }) => !tag.tag.hidden
      );
    }

    if (sortMode === "name") {
      return tagsWithCounts.sort((a: { tag: Tag }, b: { tag: Tag }) =>
        a.tag.name.localeCompare(b.tag.name)
      );
    } else {
      return tagsWithCounts.sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );
    }
  }, [tags, bookmarks, sortMode, showHiddenTags]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Menu isConnected={true} />

          <Text size="2" color="gray">
            Lockmark
          </Text>
        </div>

        <IconButton onClick={onAddTag} size="1">
          <Plus strokeWidth={1} size={16} />
        </IconButton>
        <Background tone="light" isActive={true} />
      </div>

      <div className={styles.content}>
        <TagComponent
          name="All tags"
          count={bookmarks.length}
          all={true}
          active={currentTagId === "all"}
          onClick={() => onSelectTag("all")}
        />

        <div className={styles.contentActions}>
          <Text size="1" weight="medium" color="gray">
            Tags
          </Text>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="soft" size="1" color="gray">
                <ListFilter strokeWidth={1} size={16} />
              </IconButton>
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
        </div>

        <div className={styles.list}>
          {tags.length === 0 && (
            <p className={styles.emptyState}>No tags yet</p>
          )}

          {sortedTags.length > 0 &&
            sortedTags.map(({ tag, count }: { tag: Tag; count: number }) => (
              <TagComponent
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

      <TagModal
        isOpen={isModalOpen}
        tag={currentTag}
        onClose={() => {
          setIsModalOpen(false);
          setCurrentTag(null);
        }}
        onSave={handleSaveTag}
      />
      <div className={styles.status}>
        <StatusIndicator />
      </div>
    </div>
  );
}
