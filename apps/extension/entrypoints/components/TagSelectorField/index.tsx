import { Button, TextField } from "@radix-ui/themes";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Tag } from "@/entrypoints/lib/types";

import styles from "./styles.module.css";

export const TagSelectorField = ({
  tags,
  selectedTags,
  onChange,
}: {
  tags: Tag[];
  selectedTags: string[];
  onChange: (selectedTags: string[]) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter tags based on search query and exclude already selected tags
  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return tags.filter(
      (tag) =>
        !selectedTags.includes(tag.id) &&
        (query === "" || tag.name.toLowerCase().includes(query))
    );
  }, [tags, selectedTags, searchQuery]);

  // Get selected tag objects for display
  const selectedTagObjects = useMemo(() => {
    return tags.filter((tag) => selectedTags.includes(tag.id));
  }, [tags, selectedTags]);

  // Handle tag selection
  const handleSelectTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onChange([...selectedTags, tagId]);
      setSearchQuery("");
      setHighlightedIndex(0);
      inputRef.current?.focus();
    }
  };

  // Handle tag removal
  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedTags.filter((id) => id !== tagId));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && filteredTags.length > 0) {
      e.preventDefault();
      handleSelectTag(filteredTags[highlightedIndex].id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (
      e.key === "Backspace" &&
      searchQuery === "" &&
      selectedTags.length > 0
    ) {
      // Remove last tag when backspace is pressed on empty input
      onChange(selectedTags.slice(0, -1));
    }
  };

  // Reset highlighted index when filtered tags change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTags.length]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <TextField.Root
        ref={inputRef}
        className={styles.textFieldRoot}
        size="3"
        placeholder="Search tags..."
        value={searchQuery}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setSearchQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      >
        <TextField.Slot>
          <Search height="16" width="16" />

          <div className={styles.inputContent}>
            {/* Selected tags displayed as badges */}
            {selectedTagObjects.length > 0 && (
              <div className={styles.selectedTags}>
                {selectedTagObjects.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="soft"
                    size="1"
                    className={styles.tagBadge}
                    onClick={(e) => handleRemoveTag(tag.id, e)}
                  >
                    <span className={styles.tagName}>{tag.name}</span>
                    <X className={styles.removeIcon} height="12" width="12" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        </TextField.Slot>
      </TextField.Root>

      {/* Autocomplete suggestions */}
      {isOpen && filteredTags.length > 0 && (
        <div ref={suggestionsRef} className={styles.suggestions}>
          <div className={styles.suggestionsList}>
            {filteredTags.map((tag, index) => (
              <Button
                key={tag.id}
                variant="ghost"
                className={`${styles.suggestionItem} ${
                  index === highlightedIndex ? styles.highlighted : ""
                }`}
                onClick={() => handleSelectTag(tag.id)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {tag.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
