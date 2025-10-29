import type { Bookmark, ManifestV1, Tag } from './types';

export type ConflictResolution = {
    merged: ManifestV1;
    hasConflicts: boolean;
    conflicts: string[];
};

export type ThreeWayMergeInput = {
    base: ManifestV1;
    local: ManifestV1;
    remote: ManifestV1;
};

/**
 * Simple 3-way merge for ManifestV1
 *
 * Strategy:
 * - If both local and remote changed the same property, prefer remote and re-apply local changes that don't collide
 * - For arrays (items, tags), merge by ID - prefer remote for conflicts
 * - For strings (chain_head), prefer remote if both changed
 * - For numbers (version), use remote value
 */
export function threeWayMerge(input: ThreeWayMergeInput): ConflictResolution {
    const { base, local, remote } = input;
    const conflicts: string[] = [];
    let hasConflicts = false;

    // Start with remote as base (prefer remote for conflicts)
    const merged: ManifestV1 = { ...remote };

    // Check version conflicts
    if (base.version !== local.version &&
        base.version !== remote.version &&
        local.version !== remote.version) {
        conflicts.push('version');
        hasConflicts = true;
    }
    // Use remote version (already copied above)

    // Check chain_head conflicts
    if (base.chain_head !== local.chain_head &&
        base.chain_head !== remote.chain_head &&
        local.chain_head !== remote.chain_head) {
        conflicts.push('chain_head');
        hasConflicts = true;
        // Prefer remote (already copied above)
    }

    // Merge items (bookmarks) by ID with item-level merge strategy
    const baseItemIds = new Set(base.items?.map(item => item.id) || []);
    const localItemIds = new Set(local.items?.map(item => item.id) || []);
    const remoteItemIds = new Set(remote.items?.map(item => item.id) || []);
    const baseItemMap = new Map(base.items?.map(item => [item.id, item]) || []);
    const localItemMap = new Map(local.items?.map(item => [item.id, item]) || []);
    const remoteItemMap = new Map(remote.items?.map(item => [item.id, item]) || []);

    const mergedItems = new Map<string, Bookmark>();

    // Strategy: Process each item based on where it appears
    const allItemIds = new Set([...baseItemIds, ...localItemIds, ...remoteItemIds]);

    allItemIds.forEach(id => {
        const baseItem = baseItemMap.get(id);
        const localItem = localItemMap.get(id);
        const remoteItem = remoteItemMap.get(id);

        const wasInBase = !!baseItem;
        const isInLocal = !!localItem;
        const isInRemote = !!remoteItem;

        if (!wasInBase && isInLocal && !isInRemote) {
            // Id only in local → keep (it's a local addition)
            mergedItems.set(id, localItem!);
        } else if (!wasInBase && !isInLocal && isInRemote) {
            // Id only in remote → keep (they added it)
            mergedItems.set(id, remoteItem!);
        } else if (!wasInBase && isInLocal && isInRemote) {
            // Added in both - prefer remote (they added it first)
            mergedItems.set(id, remoteItem!);
            conflicts.push(`item:${id}`);
            hasConflicts = true;
        } else if (wasInBase && isInLocal && !isInRemote) {
            // Deleted in remote, modified in local - keep local
            mergedItems.set(id, localItem!);
        } else if (wasInBase && !isInLocal && isInRemote) {
            // Deleted in local, exists in remote - keep remote
            mergedItems.set(id, remoteItem!);
        } else if (wasInBase && isInLocal && isInRemote) {
            // Both modified - merge by updated_at (last-write-wins)
            const localUpdated = localItem!.updated_at;
            const remoteUpdated = remoteItem!.updated_at;

            if (remoteUpdated > localUpdated) {
                // Remote is newer - prefer remote, but reapply non-conflicting local changes
                const mergedItem = { ...remoteItem! };

                // Reapply local changes that don't conflict (only if fields are different)
                // For now, prefer remote but mark conflict
                mergedItems.set(id, mergedItem);
                conflicts.push(`item:${id}`);
                hasConflicts = true;
            } else if (localUpdated > remoteUpdated) {
                // Local is newer - prefer local, but reapply non-conflicting remote changes
                const mergedItem = { ...localItem! };

                // Reapply remote changes that don't conflict
                // For now, prefer local but mark conflict
                mergedItems.set(id, mergedItem);
                conflicts.push(`item:${id}`);
                hasConflicts = true;
            } else {
                // Same timestamp - prefer remote and mark conflict
                mergedItems.set(id, remoteItem!);
                conflicts.push(`item:${id}`);
                hasConflicts = true;
            }
        }
        // If wasInBase && !isInLocal && !isInRemote → deleted in both, don't add
    });

    merged.items = Array.from(mergedItems.values());

    // Merge tags by ID/name - union approach
    const baseTagIds = new Set(base.tags?.map(tag => tag.id) || []);
    const localTagIds = new Set(local.tags?.map(tag => tag.id) || []);
    const remoteTagIds = new Set(remote.tags?.map(tag => tag.id) || []);
    const baseTagMap = new Map(base.tags?.map(tag => [tag.id, tag]) || []);
    const localTagMap = new Map(local.tags?.map(tag => [tag.id, tag]) || []);
    const remoteTagMap = new Map(remote.tags?.map(tag => [tag.id, tag]) || []);

    // Map by name for rename collision detection
    const remoteTagNames = new Map(remote.tags?.map(tag => [tag.name.toLowerCase(), tag]) || []);

    const mergedTags = new Map<string, Tag>();

    // Union tags by ID
    const allTagIds = new Set([...baseTagIds, ...localTagIds, ...remoteTagIds]);

    allTagIds.forEach(id => {
        const baseTag = baseTagMap.get(id);
        const localTag = localTagMap.get(id);
        const remoteTag = remoteTagMap.get(id);

        const wasInBase = !!baseTag;
        const isInLocal = !!localTag;
        const isInRemote = !!remoteTag;

        if (!wasInBase && isInLocal && !isInRemote) {
            // Local-only tag → keep
            mergedTags.set(id, localTag!);
        } else if (!wasInBase && !isInLocal && isInRemote) {
            // Remote-only tag → keep
            mergedTags.set(id, remoteTag!);
        } else if (!wasInBase && isInLocal && isInRemote) {
            // Added in both - prefer remote
            mergedTags.set(id, remoteTag!);
            conflicts.push(`tag:${id}`);
            hasConflicts = true;
        } else if (wasInBase && isInLocal && !isInRemote) {
            // Deleted in remote, exists in local - keep local
            mergedTags.set(id, localTag!);
        } else if (wasInBase && !isInLocal && isInRemote) {
            // Deleted in local, exists in remote - keep remote
            mergedTags.set(id, remoteTag!);
        } else if (wasInBase && isInLocal && isInRemote) {
            // Both exist - check for rename collisions
            const localName = localTag!.name.toLowerCase();
            const remoteName = remoteTag!.name.toLowerCase();

            if (localName !== remoteName && localName !== baseTag!.name.toLowerCase()) {
                // Rename collision - prefer remote, keep local as alternate
                // For now, prefer remote but mark conflict
                mergedTags.set(id, remoteTag!);
                conflicts.push(`tag:${id}`);
                hasConflicts = true;
            } else {
                // Same name or only remote changed - prefer remote
                mergedTags.set(id, remoteTag!);
            }
        }
    });

    merged.tags = Array.from(mergedTags.values());

    return {
        merged,
        hasConflicts,
        conflicts,
    };
}

/**
 * Simple conflict resolution strategies
 */
export type ConflictResolutionStrategy = 'keepLocal' | 'keepRemote' | 'merge';

export function resolveConflict(
    input: ThreeWayMergeInput,
    strategy: ConflictResolutionStrategy
): ConflictResolution {
    switch (strategy) {
        case 'keepLocal':
            return {
                merged: input.local,
                hasConflicts: false,
                conflicts: [],
            };

        case 'keepRemote':
            return {
                merged: input.remote,
                hasConflicts: false,
                conflicts: [],
            };

        case 'merge':
        default:
            return threeWayMerge(input);
    }
}

/**
 * Check if two manifests are equivalent (ignoring version)
 */
export function manifestsEqual(a: ManifestV1, b: ManifestV1): boolean {
    return (
        a.chain_head === b.chain_head &&
        JSON.stringify(a.items || []) === JSON.stringify(b.items || []) &&
        JSON.stringify(a.tags || []) === JSON.stringify(b.tags || [])
    );
}

/**
 * Get a human-readable description of conflicts
 */
export function getConflictDescription(conflicts: string[]): string {
    if (conflicts.length === 0) {
        return 'No conflicts';
    }

    const descriptions: Record<string, string> = {
        version: 'Version number',
        chain_head: 'Chain head',
        items: 'Bookmarks',
        tags: 'Tags',
    };

    return conflicts.map(conflict => descriptions[conflict] || conflict).join(', ');
}
