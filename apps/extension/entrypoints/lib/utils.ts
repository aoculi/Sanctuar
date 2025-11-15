/**
 * General utilities
 */
import { nanoid } from 'nanoid';

/**
 * Format date from timestamp with locale support
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string
 */
export function formatDate(
    timestamp: number,
    options?: Intl.DateTimeFormatOptions
): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    return new Date(timestamp).toLocaleDateString(
        undefined,
        options || defaultOptions
    );
}

/**
 * Format date as relative time (e.g., "2 days ago", "just now")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    if (diffDay < 30) {
        const weeks = Math.floor(diffDay / 7);
        return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }
    if (diffDay < 365) {
        const months = Math.floor(diffDay / 30);
        return `${months} month${months !== 1 ? 's' : ''} ago`;
    }
    const years = Math.floor(diffDay / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/**
 * Get hostname from URL
 * @param url - Full URL string
 * @returns Hostname or original URL if parsing fails
 */
export function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

/**
 * Get domain from URL (removes www. prefix)
 * @param url - Full URL string
 * @returns Domain without www prefix
 */
export function getDomain(url: string): string {
    const hostname = getHostname(url);
    return hostname.replace(/^www\./, '');
}

/**
 * Generate a unique ID for bookmarks and tags
 * Uses nanoid for collision-resistant IDs
 * @returns Unique identifier string
 */
export function generateId(): string {
    return nanoid();
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Debounce function execution
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
