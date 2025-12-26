import { ArrowUpDown, ChevronDown, Search, Tag, Tags } from 'lucide-react'
import { useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useTags } from '@/components/hooks/useTags'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { TagSelectorField } from '@/components/ui/TagSelectorField'

import styles from './styles.module.css'

export default function BookmarkHeader({
  searchQuery,
  onSearchChange,
  sortMode,
  onSortModeChange,
  selectedTags,
  onSelectedTagsChange
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortMode: 'updated_at' | 'title'
  onSortModeChange: (mode: 'updated_at' | 'title') => void
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
}) {
  const { tags } = useTags()
  const { navigate } = useNavigation()
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  return (
    <div className={styles.container}>
      <div className={styles.actionsContainer}>
        <DropdownMenu.Root open={sortOpen} onOpenChange={setSortOpen}>
          <DropdownMenu.Trigger asChild>
            <Button
              size='sm'
              variant='ghost'
              color='light'
              className={styles.actionButton}
            >
              <ArrowUpDown strokeWidth={2} size={16} />
              <span className={styles.actionLabel}>Sort</span>
              <ChevronDown
                strokeWidth={2}
                size={14}
                className={`${styles.chevron} ${sortOpen ? styles.chevronOpen : ''}`}
              />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              onClick={() => onSortModeChange('updated_at')}
              disabled={sortMode === 'updated_at'}
            >
              Sort by updated date
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onClick={() => onSortModeChange('title')}
              disabled={sortMode === 'title'}
            >
              Sort by title
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <DropdownMenu.Root open={filterOpen} onOpenChange={setFilterOpen}>
          <DropdownMenu.Trigger asChild>
            <Button
              size='sm'
              variant='ghost'
              color='light'
              className={`${styles.actionButton} ${selectedTags.length > 0 ? styles.filterActive : ''}`}
            >
              <Tags strokeWidth={2} size={16} />
              <span className={styles.actionLabel}>Filter</span>
              <ChevronDown
                strokeWidth={2}
                size={14}
                className={`${styles.chevron} ${filterOpen ? styles.chevronOpen : ''}`}
              />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className={styles.filterDropdown}>
            <TagSelectorField
              tags={tags}
              selectedTags={selectedTags}
              onChange={onSelectedTagsChange}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Button
          onClick={() => navigate('/tag')}
          size='sm'
          variant='ghost'
          color='light'
          className={styles.actionButton}
        >
          <Tag strokeWidth={2} size={16} />
          <span className={styles.actionLabel}>New tag</span>
        </Button>
      </div>
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
