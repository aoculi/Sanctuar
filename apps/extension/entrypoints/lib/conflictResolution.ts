import type { Bookmark, ManifestV1, Tag } from './types';

/**
 * Result of a three-way merge operation
 */
export type ConflictResolution = {
    merged: ManifestV1;
    hasConflicts: boolean;
    conflicts: string[];
};

/**
 * Input for three-way merge
 */
export type ThreeWayMergeInput = {
    base: ManifestV1;
    local: ManifestV1;
    remote: ManifestV1;
};

/**
 * Helper to check if all three values are different
 */
function allDifferent<T>(base: T, local: T, remote: T): boolean {
    return base !== local && base !== remote && local !== remote;
}

/**
 * Helper to create maps by ID
 */
function createIdMap<T extends { id: string }>(items: T[] | undefined): Map<string, T> {
    return new Map((items || []).map(item => [item.id, item]));
}

/**
 * Helper to get all unique IDs from multiple maps
 */
function getAllIds<T>(...maps: Map<string, T>[]): Set<string> {
    const allIds = new Set<string>();
    maps.forEach(map => map.forEach((_, id) => allIds.add(id)));
    return allIds;
}

/**
 * Simple 3-way merge for ManifestV1
 *
 * Strategy:
 * - Prefer remote for conflicts (server is source of truth)
 * - For arrays (items, tags), merge by ID
 * - For bookmarks: use last-write-wins based on updated_at timestamp
 * - For tags: prefer remote on conflicts
 * - Track all conflicts for logging/debugging
 *
 * @param input - Base, local, and remote manifests
 * @returns Merged manifest with conflict information
 */
export function threeWayMerge(input: ThreeWayMergeInput): ConflictResolution {
    const { base, local, remote } = input;
    const conflicts: string[] = [];
    let hasConflicts = false;

    // Start with remote as base (prefer remote for conflicts)
    const merged: ManifestV1 = { ...remote };

    // Check version conflicts
    if (allDifferent(base.version, local.version, remote.version)) {
        conflicts.push('version');
        hasConflicts = true;
    }

    // Check chain_head conflicts
    if (allDifferent(base.chain_head, local.chain_head, remote.chain_head)) {
        conflicts.push('chain_head');
        hasConflicts = true;
    }

    // Merge items (bookmarks) by ID with item-level merge strategy
    const baseItemMap = createIdMap(base.items);
    const localItemMap = createIdMap(local.items);
    const remoteItemMap = createIdMap(remote.items);
    const allItemIds = getAllIds(baseItemMap, localItemMap, remoteItemMap);

    const mergedItems = new Map<string, Bookmark>();

    // Process each item based on where it appears
    allItemIds.forEach(id => {
        const baseItem = baseItemMap.get(id);
        const localItem = localItemMap.get(id);
        const remoteItem = remoteItemMap.get(id);

        const wasInBase = !!baseItem;
        const isInLocal = !!localItem;
        const isInRemote = !!remoteItem;

        // New item only in local
        if (!wasInBase && isInLocal && !isInRemote) {
            mergedItems.set(id, localItem);
            return;
        }

        // New item only in remote
        if (!wasInBase && !isInLocal && isInRemote) {
            mergedItems.set(id, remoteItem);
            return;
        }

        // New item in both (conflict)
        if (!wasInBase && isInLocal && isInRemote) {
            mergedItems.set(id, remoteItem);
            conflicts.push(`item:${id}`);
            hasConflicts = true;
            return;
        }

        // Deleted in remote, kept/modified in local
        if (wasInBase && isInLocal && !isInRemote) {
            mergedItems.set(id, localItem);
            return;
        }

        // Deleted in local, kept/modified in remote
        if (wasInBase && !isInLocal && isInRemote) {
            mergedItems.set(id, remoteItem);
            return;
        }

        // Modified in both - use last-write-wins
        if (wasInBase && isInLocal && isInRemote) {
            const localUpdated = localItem.updated_at;
            const remoteUpdated = remoteItem.updated_at;

            if (remoteUpdated >= localUpdated) {
                mergedItems.set(id, remoteItem);
            } else {
                mergedItems.set(id, localItem);
            }

            // Mark as conflict if both were modified
            if (localUpdated !== remoteUpdated) {
                conflicts.push(`item:${id}`);
                hasConflicts = true;
            }
            return;
        }

        // Deleted in both - don't add to merged
    });

    merged.items = Array.from(mergedItems.values());

    // Merge tags by ID - union approach
    const baseTagMap = createIdMap(base.tags);
    const localTagMap = createIdMap(local.tags);
    const remoteTagMap = createIdMap(remote.tags);
    const allTagIds = getAllIds(baseTagMap, localTagMap, remoteTagMap);

    const mergedTags = new Map<string, Tag>();

    allTagIds.forEach(id => {
        const baseTag = baseTagMap.get(id);
        const localTag = localTagMap.get(id);
        const remoteTag = remoteTagMap.get(id);

        const wasInBase = !!baseTag;
        const isInLocal = !!localTag;
        const isInRemote = !!remoteTag;

        // New tag only in local
        if (!wasInBase && isInLocal && !isInRemote) {
            mergedTags.set(id, localTag);
            return;
        }

        // New tag only in remote
        if (!wasInBase && !isInLocal && isInRemote) {
            mergedTags.set(id, remoteTag);
            return;
        }

        // New tag in both (conflict)
        if (!wasInBase && isInLocal && isInRemote) {
            mergedTags.set(id, remoteTag);
            conflicts.push(`tag:${id}`);
            hasConflicts = true;
            return;
        }

        // Deleted in remote, kept/modified in local
        if (wasInBase && isInLocal && !isInRemote) {
            mergedTags.set(id, localTag);
            return;
        }

        // Deleted in local, kept/modified in remote
        if (wasInBase && !isInLocal && isInRemote) {
            mergedTags.set(id, remoteTag);
            return;
        }

        // Modified in both
        if (wasInBase && isInLocal && isInRemote) {
            const localName = localTag.name.toLowerCase();
            const remoteName = remoteTag.name.toLowerCase();
            const baseName = baseTag.name.toLowerCase();

            // Check for rename collision
            if (localName !== remoteName && localName !== baseName) {
                mergedTags.set(id, remoteTag);
                conflicts.push(`tag:${id}`);
                hasConflicts = true;
            } else {
                // No conflict or only remote changed - prefer remote
                mergedTags.set(id, remoteTag);
            }
            return;
        }

        // Deleted in both - don't add to merged
    });

    merged.tags = Array.from(mergedTags.values());

    return {
        merged,
        hasConflicts,
        conflicts,
    };
}
