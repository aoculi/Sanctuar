import {
  BookOpenText,
  ChevronDown,
  Library,
  LogOut,
  Menu,
  Search,
  Settings2,
  Star
} from 'lucide-react'
import React from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Header({
  title,
  canSwitchToVault = false,
  canSwitchToBookmark = false,
  rightContent,
  searchQuery,
  onSearchChange
}: {
  title?: string
  canSwitchToVault?: boolean
  canSwitchToBookmark?: boolean
  rightContent?: React.ReactNode
  searchQuery?: string
  onSearchChange?: (query: string) => void
}) {
  const { navigate } = useNavigation()
  const { logout } = useQueryAuth()
  const { isAuthenticated } = useAuthSession()

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

        {searchQuery !== undefined && onSearchChange && (
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
        )}

        <div className={styles.right}>
          {rightContent}
          {canSwitchToVault && isAuthenticated && (
            <Button
              onClick={() => navigate('/vault')}
              variant='ghost'
              title='Vault'
            >
              <BookOpenText strokeWidth={2} size={18} color='white' />
            </Button>
          )}
          {canSwitchToBookmark && isAuthenticated && (
            <>
              <Button
                asIcon={true}
                onClick={() => navigate('/bookmark')}
                title='New bookmark'
                className={styles.newBookmarkButton}
              >
                <Star strokeWidth={2} size={18} color='white' />
              </Button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    className={styles.moreBookmarkOptionsButton}
                    asIcon={true}
                    title='More bookmark options'
                  >
                    <ChevronDown strokeWidth={2} size={13} color='white' />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    onClick={() => navigate('/bookmark', { bookmark: 'blank' })}
                  >
                    New blank bookmark
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </>
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
