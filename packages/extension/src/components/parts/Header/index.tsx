import {
  BookOpenText,
  Library,
  LockKeyhole,
  Settings2,
  Star
} from 'lucide-react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'

import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Header({
  title,
  canSwitchToVault = false,
  canSwitchToBookmark = false
}: {
  title?: string
  canSwitchToVault?: boolean
  canSwitchToBookmark?: boolean
}) {
  const { navigate } = useNavigation()
  const { logout } = useQueryAuth()

  const switchToVault = () => {
    navigate('/vault')
  }

  const switchToBookmark = () => {
    navigate('/bookmark')
  }
  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div className={styles.left}>
          <div className={styles.leftIcon}>
            <Library strokeWidth={2} size={20} color='orange' />
          </div>

          <Text as='h1' size='2' weight='medium'>
            {title ? title : 'LockMark'}
          </Text>
        </div>

        <div className={styles.right}>
          {canSwitchToVault && (
            <Button onClick={switchToVault} variant='ghost' title='Open vault'>
              <BookOpenText strokeWidth={2} size={18} color='white' />
            </Button>
          )}
          {canSwitchToBookmark && (
            <Button
              onClick={switchToBookmark}
              variant='ghost'
              title='New bookmark'
            >
              <Star strokeWidth={2} size={18} color='white' />
            </Button>
          )}

          <Button variant='ghost' title='Settings'>
            <Settings2 strokeWidth={2} size={18} color='white' />
          </Button>
          <Button
            variant='ghost'
            onClick={() => logout.mutate()}
            title='Logout'
          >
            <LockKeyhole strokeWidth={2} size={18} color='white' />
          </Button>
        </div>
      </div>
    </div>
  )
}
