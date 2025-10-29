/**
 * Tag CRUD operations hook
 */
import { useCallback } from 'react';
import { generateId } from '../../lib/id';
import type { Tag } from '../../lib/types';
import { manifestStore } from '../store/manifest';
import { useTagValidation } from './validation';
import { useManifest } from './vault';

export function useTags() {
    const { store } = useManifest();
    const { validateTag } = useTagValidation();

    const createTag = useCallback((tag: Omit<Tag, 'id'>) => {
        if (!store.manifest) return;

        // Validate tag name
        const validationError = validateTag(tag.name);
        if (validationError) {
            throw new Error(validationError);
        }

        const trimmedName = tag.name.trim();

        // Check for duplicate tag names
        const existingTag = store.manifest.tags?.find(t => t.name.toLowerCase() === trimmedName.toLowerCase());
        if (existingTag) {
            throw new Error('A tag with this name already exists');
        }

        const newTag: Tag = {
            ...tag,
            id: generateId(),
            name: trimmedName,
        };

        manifestStore.apply(manifest => ({
            ...manifest,
            tags: [...(manifest.tags || []), newTag],
        }));
    }, [store.manifest, validateTag]);

    const renameTag = useCallback((id: string, newName: string) => {
        if (!store.manifest) return;

        // Validate new name
        const validationError = validateTag(newName);
        if (validationError) {
            throw new Error(validationError);
        }

        const trimmedName = newName.trim();

        // Check for duplicate tag names (excluding current tag)
        const existingTag = store.manifest.tags?.find(t =>
            t.id !== id && t.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (existingTag) {
            throw new Error('A tag with this name already exists');
        }

        manifestStore.apply(manifest => ({
            ...manifest,
            tags: (manifest.tags || []).map(tag =>
                tag.id === id ? { ...tag, name: trimmedName } : tag
            ),
        }));
    }, [store.manifest, validateTag]);

    const deleteTag = useCallback((id: string) => {
        if (!store.manifest) return;

        // Remove tag from manifest
        manifestStore.apply(manifest => ({
            ...manifest,
            tags: (manifest.tags || []).filter(tag => tag.id !== id),
        }));

        // Remove tag from all bookmarks
        manifestStore.apply(manifest => ({
            ...manifest,
            items: (manifest.items || []).map(bookmark => ({
                ...bookmark,
                tags: bookmark.tags.filter(tagId => tagId !== id),
            })),
        }));
    }, [store.manifest]);

    const getTag = useCallback((id: string): Tag | undefined => {
        return store.manifest?.tags?.find(tag => tag.id === id);
    }, [store.manifest]);

    return {
        tags: store.manifest?.tags || [],
        createTag,
        renameTag,
        deleteTag,
        getTag,
    };
}
