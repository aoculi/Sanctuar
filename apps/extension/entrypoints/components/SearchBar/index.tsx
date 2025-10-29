/**
 * Search bar component
 */
import styles from './styles.module.css';

type Props = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder = 'Search bookmarks...' }: Props) {
    return (
        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={styles.input}
        />
    );
}
