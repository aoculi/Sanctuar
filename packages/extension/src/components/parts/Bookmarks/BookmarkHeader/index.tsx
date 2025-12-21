import { Search } from 'lucide-react'

import styles from './styles.module.css'

export default function BookmarkHeader({
  searchQuery,
  onSearchChange
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
}) {
  return (
    <div className={styles.container}>
      <div className={styles.searchBarContainer}>
        <Search strokeWidth={1} size={16} />
        <input
          type='text'
          placeholder='Search bookmarks...'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>
    </div>
  )
}
