import { EllipsisVertical } from 'lucide-react'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Tag({
  name,
  count,
  all = false,
  active = false,
  onClick,
  onEdit,
  onDelete,
  icon
}: {
  name: string
  count: number
  all: boolean
  active: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  icon: React.ReactNode
}) {
  return (
    <div className={styles.tagWrapper}>
      <a
        className={`${styles.tag} ${active ? styles.active : styles.inactive}`}
        href='#'
        onClick={onClick}
      >
        <div className={styles.tagIconLabelWrapper}>
          {icon}
          <div className={styles.tagLabel}>
            <Text size='2'>{name}</Text>
          </div>
        </div>
        <div className={`${styles.tagEnd} ${!all ? styles.countItem : ''}`}>
          <Text size='2' weight='medium' color='light'>
            {count}
          </Text>
        </div>
      </a>

      {!all && (onEdit || onDelete) && (
        <div className={styles.dropdownMenu}>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button asIcon={true} color='dark' variant='ghost' size='sm'>
                <EllipsisVertical size={16} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              {onEdit && (
                <DropdownMenu.Item onClick={onEdit}>Edit</DropdownMenu.Item>
              )}
              {onEdit && onDelete && <DropdownMenu.Separator />}
              {onDelete && (
                <DropdownMenu.Item onClick={onDelete} color='red'>
                  Delete
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}
