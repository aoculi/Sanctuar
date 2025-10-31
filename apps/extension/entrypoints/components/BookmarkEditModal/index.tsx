/**
 * Bookmark edit modal component
 */
import { useState } from "react";
import { MAX_TAGS_PER_ITEM } from "../../hooks/bookmarks";
import type { Bookmark, Tag } from "../../lib/types";
import styles from "./styles.module.css";

type Props = {
  bookmark: Bookmark | null;
  tags: Tag[];
  onSave: (data: { url: string; title: string; tags: string[] }) => void;
  onCancel: () => void;
};

export function BookmarkEditModal({ bookmark, tags, onSave, onCancel }: Props) {
  const [url, setUrl] = useState(bookmark?.url || "");
  const [title, setTitle] = useState(bookmark?.title || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    bookmark?.tags || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave({
      url: url.trim(),
      title: title.trim(),
      tags: selectedTags,
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <h3>{bookmark ? "Edit Bookmark" : "Add Bookmark"}</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="url">URL *</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errors.url) setErrors({ ...errors, url: "" });
              }}
              className={`${styles.input} ${
                errors.url ? styles.inputError : ""
              }`}
              placeholder="https://example.com"
            />
            {errors.url && (
              <span className={styles.fieldError}>{errors.url}</span>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: "" });
              }}
              className={`${styles.input} ${
                errors.title ? styles.inputError : ""
              }`}
              placeholder="Bookmark title"
            />
            {errors.title && (
              <span className={styles.fieldError}>{errors.title}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>
              Tags{" "}
              {selectedTags.length > 0 &&
                `(${selectedTags.length}/${MAX_TAGS_PER_ITEM})`}
            </label>
            {tags.length === 0 ? (
              <p className={styles.emptyState}>No tags available</p>
            ) : (
              <>
                <div className={styles.tagCheckboxes}>
                  {tags.map((tag) => (
                    <label key={tag.id} className={styles.tagCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={() => {
                          toggleTag(tag.id);
                          if (errors.tags) setErrors({ ...errors, tags: "" });
                        }}
                        disabled={
                          !selectedTags.includes(tag.id) &&
                          selectedTags.length >= MAX_TAGS_PER_ITEM
                        }
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
                {errors.tags && (
                  <span className={styles.fieldError}>{errors.tags}</span>
                )}
              </>
            )}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitButton}>
              {bookmark ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
