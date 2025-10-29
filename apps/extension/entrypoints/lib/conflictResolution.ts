import type { VaultManifest } from './types';

export type ConflictResolution = {
    merged: VaultManifest;
    hasConflicts: boolean;
    conflicts: string[];
};

export type ThreeWayMergeInput = {
    base: VaultManifest;
    local: VaultManifest;
    remote: VaultManifest;
};

/**
 * Simple 3-way merge for VaultManifest
 *
 * Strategy:
 * - If both local and remote changed the same property, prefer remote and re-apply local changes that don't collide
 * - For arrays (book_index), merge by adding unique entries
 * - For strings (chain_head), prefer remote if both changed
 * - For numbers (version_counter), use remote value
 */
export function threeWayMerge(input: ThreeWayMergeInput): ConflictResolution {
    const { base, local, remote } = input;
    const conflicts: string[] = [];
    let hasConflicts = false;

    // Start with remote as base (prefer remote for conflicts)
    const merged: VaultManifest = { ...remote };

    // Check version_counter conflicts
    if (base.version_counter !== local.version_counter &&
        base.version_counter !== remote.version_counter &&
        local.version_counter !== remote.version_counter) {
        conflicts.push('version_counter');
        hasConflicts = true;
    }
    // Use remote version_counter (already copied above)

    // Check chain_head conflicts
    if (base.chain_head !== local.chain_head &&
        base.chain_head !== remote.chain_head &&
        local.chain_head !== remote.chain_head) {
        conflicts.push('chain_head');
        hasConflicts = true;
        // Prefer remote (already copied above)
    }

    // Merge book_index arrays
    const baseIndex = new Set(base.book_index || []);
    const localIndex = new Set(local.book_index || []);
    const remoteIndex = new Set(remote.book_index || []);

    // Find items that were added locally but not in remote
    const localOnly = [...localIndex].filter(item => !baseIndex.has(item) && !remoteIndex.has(item));

    // Find items that were removed locally but still in remote
    const localRemoved = [...baseIndex].filter(item => !localIndex.has(item) && remoteIndex.has(item));

    // Find items that were added remotely but not in local
    const remoteOnly = [...remoteIndex].filter(item => !baseIndex.has(item) && !localIndex.has(item));

    // Check for conflicts in book_index
    const localChanges = [...localIndex].filter(item => !baseIndex.has(item));
    const remoteChanges = [...remoteIndex].filter(item => !baseIndex.has(item));
    const conflictingChanges = localChanges.filter(item => remoteChanges.includes(item));

    if (conflictingChanges.length > 0) {
        conflicts.push('book_index');
        hasConflicts = true;
    }

    // Build merged book_index
    const mergedIndex = new Set(remoteIndex);

    // Add local-only items
    localOnly.forEach(item => mergedIndex.add(item));

    // Remove items that were removed locally
    localRemoved.forEach(item => mergedIndex.delete(item));

    merged.book_index = [...mergedIndex];

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
 * Check if two manifests are equivalent (ignoring version_counter)
 */
export function manifestsEqual(a: VaultManifest, b: VaultManifest): boolean {
    return (
        a.chain_head === b.chain_head &&
        JSON.stringify(a.book_index || []) === JSON.stringify(b.book_index || [])
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
        version_counter: 'Version number',
        chain_head: 'Chain head',
        book_index: 'Book index',
    };

    return conflicts.map(conflict => descriptions[conflict] || conflict).join(', ');
}
