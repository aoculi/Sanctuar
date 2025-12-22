import {
  BookOpenText,
  Library,
  LogOut,
  Menu,
  Settings2,
  Star
} from 'lucide-react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useSelection } from '@/components/hooks/providers/useSelectionProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
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
  const { resetSelection } = useSelection()
  const { logout } = useQueryAuth()
  const { isAuthenticated } = useAuthSession()

  const switchToVault = () => {
    resetSelection()
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
          {canSwitchToVault && isAuthenticated && (
            <Button onClick={switchToVault} variant='ghost' title='Vault'>
              <BookOpenText strokeWidth={2} size={18} color='white' />
            </Button>
          )}
          {canSwitchToBookmark && isAuthenticated && (
            <Button
              onClick={switchToBookmark}
              variant='ghost'
              title='New bookmark'
            >
              <Star strokeWidth={2} size={18} color='white' />
            </Button>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button asIcon={true} variant='ghost' title='Menu'>
                <Menu strokeWidth={2} size={18} color='white' />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => navigate('/settings')}>
                <Settings2 strokeWidth={1} size={18} color='white' /> Settings
              </DropdownMenu.Item>
              {isAuthenticated && <DropdownMenu.Separator />}
              {isAuthenticated && (
                <DropdownMenu.Item onClick={() => logout.mutate()}>
                  <LogOut strokeWidth={1} size={18} color='white' /> Logout
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  )
}
