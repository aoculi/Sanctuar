/**
 * Individual bookmark card component
 */
import { Button, Text } from "@radix-ui/themes";
import { getTagName } from "../../../lib/bookmarkUtils";
import { formatDate, getHostname } from "../../../lib/formatUtils";
import type { Bookmark, Tag } from "../../../lib/types";

import { EllipsisVertical } from "lucide-react";
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
        <Text size="6" weight="regular">
          {bookmark.title || "(Untitled)"}
        </Text>
        <Text size="3" color="gray">
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

      <Button variant="ghost" onClick={() => onEdit(bookmark)} title="Edit">
        <EllipsisVertical height={16} width={14} />
      </Button>
    </a>
  );
}
