/**
 * Main bookmarks hook - coordinates all bookmark operations
 */
import { MAX_NOTES_LENGTH, MAX_TAGS_PER_ITEM } from '../lib/validation';
import { useBookmarks } from './useBookmarks';
import { useTags } from './useTags';
import { useManifestSize } from './validation';

export { MAX_NOTES_LENGTH, MAX_TAGS_PER_ITEM, useBookmarks, useManifestSize, useTags };
