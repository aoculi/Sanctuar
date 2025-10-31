import { Button, DropdownMenu, Text } from "@radix-ui/themes";
import { EllipsisVertical } from "lucide-react";

import { getTagName } from "../../../lib/bookmarkUtils";
import { formatDate, getHostname } from "../../../lib/formatUtils";
import type { Bookmark, Tag } from "../../../lib/types";

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
        <Text size="4" weight="regular">
          {bookmark.title || "(Untitled)"}
        </Text>
        <Text size="2" color="gray">
          {getHostname(bookmark.url)}
        </Text>

        {bookmark.tags.length > 0 && (
          <div className={styles.tags}>
            {bookmark.tags.map((tagId: string) => (
              <span key={tagId} className={styles.tag}>
                {getTagName(tagId, tags)}
              </span>
            ))}
          </div>
        )}

        <Text size="1" color="gray">
          Updated: {formatDate(bookmark.updated_at)}
        </Text>
      </div>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button variant="soft" size="1">
            <EllipsisVertical height={16} width={14} />
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
