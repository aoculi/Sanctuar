/**
 * Formatting utilities
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

export function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}
