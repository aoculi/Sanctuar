import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'

import TagManageModal from '@/components/parts/Tags/TagManageModal'
import ActionBtn from '@/components/ui/ActionBtn'
import { Checkbox } from '@/components/ui/Checkbox'

import Text from '@/components/ui/Text'
import styles from './styles.module.css'

interface BulkActionBarProps {
  totalCount: number
  selectedIds: Set<string>
  onSelectAll: () => void
  onClearSelection: () => void
}

export default function BulkActionBar({
  totalCount,
  selectedIds,
  onSelectAll,
  onClearSelection
}: BulkActionBarProps) {
  const { bookmarks, deleteBookmarks, updateBookmarks } = useBookmarks()
  const { setFlash } = useNavigation()
  const [showTagModal, setShowTagModal] = useState(false)

  const selectedCount = selectedIds.size
  const allSelected = selectedCount > 0 && selectedCount === totalCount

  // Check if all selected bookmarks are hidden
  const allSelectedHidden = useMemo(() => {
    if (selectedCount === 0) return false
    return Array.from(selectedIds).every((id) => {
      const bookmark = bookmarks.find((b) => b.id === id)
      return bookmark?.hidden === true
    })
  }, [selectedIds, selectedCount, bookmarks])

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedCount} bookmarks?`)) {
      try {
        await deleteBookmarks(Array.from(selectedIds))
        onClearSelection()
        setFlash(`${selectedCount} bookmarks deleted`)
        setTimeout(() => setFlash(null), 3000)
      } catch (error) {
        setFlash(`Failed to delete bookmarks: ${(error as Error).message}`)
        setTimeout(() => setFlash(null), 5000)
      }
    }
  }

  const handleBulkAddTags = () => {
    setShowTagModal(true)
  }

  const handleToggleHidden = async () => {
    const newHiddenState = !allSelectedHidden
    try {
      await updateBookmarks(Array.from(selectedIds), { hidden: newHiddenState })
      onClearSelection()
      const action = newHiddenState ? 'hidden' : 'visible'
      setFlash(`${selectedCount} bookmark${selectedCount > 1 ? 's' : ''} ${action}`)
      setTimeout(() => setFlash(null), 3000)
    } catch (error) {
      setFlash(`Failed to update bookmarks: ${(error as Error).message}`)
      setTimeout(() => setFlash(null), 5000)
    }
  }

  return (
    <>
      <div className={styles.component}>
        <div className={styles.left}>
          <Checkbox
            checked={allSelected}
            onChange={onSelectAll}
            label={
              <Text as='span' size='2' weight='medium'>
                bookmark{selectedCount > 1 ? 's' : ''}
              </Text>
            }
          />
          {selectedCount > 0 && (
            <div className={styles.actions}>
              <ActionBtn
                icon={Plus}
                label='Add Tags'
                variant='bordered'
                size='sm'
                onClick={handleBulkAddTags}
              />
              <ActionBtn
                icon={allSelectedHidden ? Eye : EyeOff}
                label={allSelectedHidden ? 'Show' : 'Hide'}
                variant='bordered'
                size='sm'
                onClick={handleToggleHidden}
              />
              <ActionBtn
                icon={Trash2}
                label='Delete'
                variant='bordered'
                size='sm'
                onClick={handleBulkDelete}
              />
            </div>
          )}
        </div>
        <div className={styles.right}>
          <span className={styles.count}>{selectedCount} selected</span>
        </div>
      </div>

      <TagManageModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        bookmark={null}
        bookmarkIds={Array.from(selectedIds)}
      />
    </>
  )
}
