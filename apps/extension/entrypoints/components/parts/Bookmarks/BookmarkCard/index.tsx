import { DropdownMenu } from "@radix-ui/themes";
import { EllipsisVertical } from "lucide-react";

import Button from "@/entrypoints/components/ui/Button";
import Text from "@/entrypoints/components/ui/Text";
import { getTagName } from "@/entrypoints/lib/bookmarkUtils";
import { formatDate, getHostname } from "@/entrypoints/lib/formatUtils";
import type { Bookmark, Tag } from "@/entrypoints/lib/types";

import styles from "./styles.module.css";

type Props = {
  bookmark: Bookmark;
  tags: Tag[];
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
};

export function BookmarkCard({ bookmark, tags, onEdit, onDelete }: Props) {
  const picture = null;
  return (
    <a
      className={styles.card}
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {picture && (
        <div className={styles.picture}>
          <img src={picture} alt={bookmark?.title} />
        </div>
      )}

      <div className={styles.content}>
        <Text size="3" weight="regular">
          {bookmark.title || "(Untitled)"}
        </Text>
        <Text size="2" color="light">
          {getHostname(bookmark.url)}
        </Text>

        <div className={styles.tagsContainer}>
          {bookmark.tags.length > 0 && (
            <div className={styles.tags}>
              {bookmark.tags.map((tagId: string) => (
                <span key={tagId} className={styles.tag}>
                  {getTagName(tagId, tags)}
                </span>
              ))}
            </div>
          )}

          <Text size="1" color="light" style={{ textAlign: "right" }}>
            Updated: {formatDate(bookmark.updated_at)}
          </Text>
        </div>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button asIcon={true} color="dark">
            <EllipsisVertical size={16} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={() => onEdit(bookmark)}>
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={() => onDelete(bookmark.id)} color="red">
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </a>
  );
}
