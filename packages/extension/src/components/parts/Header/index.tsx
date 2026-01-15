import {
  Bookmark,
  HelpCircle,
  LogOut,
  Menu,
  Save,
  Search,
  Settings2,
  StarIcon,
  Tag as TagIcon
} from 'lucide-react'
import React, { useCallback } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { captureAllTabs } from '@/lib/pageCapture'
import { openExtensionPage } from '@/lib/tabs'
import type { Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import Logo from '@/components/ui/Logo'

import styles from './styles.module.css'

export default function Header({
  canShowMenu = true,
  rightContent,
  searchQuery,
  onSearchChange
}: {
  canShowMenu?: boolean
  rightContent?: React.ReactNode
  searchQuery?: string
  onSearchChange?: (query: string) => void
}) {
  const { navigate, setFlash } = useNavigation()
  const { logout } = useQueryAuth()
  const { isAuthenticated } = useAuthSession()
  const { addBookmark } = useBookmarks()
  const { manifest, save } = useManifest()

  const handleSaveAllTabs = useCallback(async () => {
    if (!manifest) {
      setFlash('Manifest not loaded')
      return
    }

    try {
      // Get all open tabs
      const tabBookmarks = await captureAllTabs()

      if (tabBookmarks.length === 0) {
        setFlash('No bookmarkable tabs found')
        return
      }

      // Get current date as string (YYYY-MM-DD format)
      const today = new Date()
      const dateString = today.toISOString().split('T')[0]

      // Check if tag with this date already exists in manifest
      let dateTag: Tag | undefined = manifest.tags?.find(
        (t) => t.name.toLowerCase() === dateString.toLowerCase()
      )

      let tagId: string

      // Create tag if it doesn't exist
      if (!dateTag) {
        // Create the tag locally first to get its ID
        const newTag: Tag = {
          id: generateId(),
          name: dateString
        }

        // Save the tag to manifest
        await save({
          ...manifest,
          tags: [...(manifest.tags || []), newTag]
        })

        tagId = newTag.id
      } else {
        tagId = dateTag.id
      }

      // Save all bookmarks with the date tag
      let successCount = 0
      let errorCount = 0

      for (const tabBookmark of tabBookmarks) {
        try {
          await addBookmark({
            ...tabBookmark,
            tags: [tagId]
          })
          successCount++
        } catch (error) {
          console.error('Error saving bookmark:', error)
          errorCount++
        }
      }

      if (successCount > 0 && errorCount === 0) {
        setFlash(
          `Saved ${successCount} tab${successCount !== 1 ? 's' : ''} with tag "${dateString}"`
        )
      } else if (successCount > 0 && errorCount > 0) {
        setFlash(
          `Saved ${successCount} tab${successCount !== 1 ? 's' : ''}, ${errorCount} failed`
        )
      } else {
        setFlash('Failed to save tabs')
      }
      setTimeout(() => setFlash(null), 5000)
    } catch (error) {
      console.error('Error saving all tabs:', error)
      setFlash('Failed to save tabs')
    }
  }, [addBookmark, manifest, save, setFlash])

  return (
    <div className={styles.component}>
      <div className={styles.content}>
        <div className={styles.left}>
          <Logo />
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

          {canShowMenu && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button asIcon={true} variant='ghost' title='Menu'>
                  <Menu strokeWidth={2} size={18} color='white' />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {isAuthenticated && (
                  <DropdownMenu.Item
                    onClick={() => navigate('/bookmark', { bookmark: 'blank' })}
                  >
                    <StarIcon strokeWidth={1} size={18} color='white' />
                    New blank bookmark
                  </DropdownMenu.Item>
                )}

                {isAuthenticated && (
                  <DropdownMenu.Item onClick={handleSaveAllTabs}>
                    <Save strokeWidth={1} size={18} color='white' /> Save all
                    open tabs
                  </DropdownMenu.Item>
                )}

                {isAuthenticated && (
                  <DropdownMenu.Item onClick={() => openExtensionPage('app')}>
                    <Bookmark strokeWidth={1} size={18} color='white' />{' '}
                    Bookmarks
                  </DropdownMenu.Item>
                )}
                {isAuthenticated && (
                  <DropdownMenu.Item onClick={() => openExtensionPage('tags')}>
                    <TagIcon strokeWidth={1} size={18} color='white' /> Tags
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  onClick={() => openExtensionPage('settings')}
                >
                  <Settings2 strokeWidth={1} size={18} color='white' /> Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => openExtensionPage('help')}>
                  <HelpCircle strokeWidth={1} size={18} color='white' /> Help
                </DropdownMenu.Item>
                {isAuthenticated && <DropdownMenu.Separator />}
                {isAuthenticated && (
                  <DropdownMenu.Item onClick={() => logout.mutate()}>
                    <LogOut strokeWidth={1} size={18} color='white' /> Logout
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </div>
      </div>
    </div>
  )
}
