import {
  BookOpenText,
  ChevronDown,
  Library,
  LogOut,
  Menu,
  Save,
  Search,
  Settings2,
  Star,
  StarIcon
} from 'lucide-react'
import React, { useCallback } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { captureAllTabs } from '@/lib/pageCapture'
import type { Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'

import Button from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import Text from '@/components/ui/Text'

import styles from './styles.module.css'

export default function Header({
  title,
  canSwitchToVault = false,
  canSwitchToBookmark = false,
  canShowMenu = true,
  rightContent,
  searchQuery,
  onSearchChange
}: {
  title?: string
  canSwitchToVault?: boolean
  canSwitchToBookmark?: boolean
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
          name: dateString,
          hidden: false
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
          <div className={styles.leftIcon}>
            <Library strokeWidth={2} size={20} />
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
                    <StarIcon strokeWidth={1} size={18} color='white' />
                    New blank bookmark
                  </DropdownMenu.Item>
                  {isAuthenticated && (
                    <DropdownMenu.Item onClick={handleSaveAllTabs}>
                      <Save strokeWidth={1} size={18} color='white' /> Save all
                      open tabs
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </>
          )}

          {canShowMenu && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button asIcon={true} variant='ghost' title='Menu'>
                  <Menu strokeWidth={2} size={18} color='white' />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onClick={() => {
                    // Open the options page - compatible with both Chrome and Firefox
                    try {
                      // Get the runtime API (works for both Chrome and Firefox)
                      const runtime =
                        (typeof chrome !== 'undefined' && chrome.runtime) ||
                        (typeof browser !== 'undefined' && browser.runtime)

                      if (!runtime) {
                        setFlash(
                          'Unable to open settings page. Browser runtime not available.'
                        )
                        setTimeout(() => setFlash(null), 5000)
                        return
                      }

                      // Open options page as a standalone tab (not in extension management page)
                      try {
                        const optionsUrl = runtime.getURL(
                          '/settings.html' as any
                        )
                        if (optionsUrl) {
                          // Use chrome.tabs.create for better control, fallback to window.open
                          const tabs =
                            (typeof chrome !== 'undefined' && chrome.tabs) ||
                            (typeof browser !== 'undefined' && browser.tabs)
                          if (tabs && typeof tabs.create === 'function') {
                            tabs.create({ url: optionsUrl })
                          } else {
                            window.open(optionsUrl, '_blank')
                          }
                        } else {
                          setFlash(
                            'Unable to open settings page. Options page not found.'
                          )
                          setTimeout(() => setFlash(null), 5000)
                        }
                      } catch (error) {
                        console.error('Error opening options page:', error)
                        setFlash(
                          `Unable to open settings page: ${
                            error instanceof Error
                              ? error.message
                              : 'Unknown error'
                          }`
                        )
                        setTimeout(() => setFlash(null), 5000)
                      }
                    } catch (error) {
                      console.error('Error opening options page:', error)
                      setFlash(
                        `Unable to open settings page: ${
                          error instanceof Error
                            ? error.message
                            : 'Unknown error'
                        }`
                      )
                      setTimeout(() => setFlash(null), 5000)
                    }
                  }}
                >
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
          )}
        </div>
      </div>
    </div>
  )
}
