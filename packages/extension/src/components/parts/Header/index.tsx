import {
  ExternalLink,
  HelpCircle,
  LogOut,
  Menu,
  Save,
  Search,
  Settings2,
  StarIcon,
  Tag as TagIcon
} from 'lucide-react'
import React, { useCallback, useState } from 'react'

import { useAuthSession } from '@/components/hooks/providers/useAuthSessionProvider'
import { useManifest } from '@/components/hooks/providers/useManifestProvider'
import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useQueryAuth } from '@/components/hooks/queries/useQueryAuth'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { captureAllTabs, type BookmarkDraft } from '@/lib/pageCapture'
import { openExtensionPage } from '@/lib/tabs'
import type { Tag } from '@/lib/types'
import { generateId } from '@/lib/utils'

import Button from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
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

  const [pendingTabs, setPendingTabs] = useState<BookmarkDraft[] | null>(
    null
  )
  const [isSavingTabs, setIsSavingTabs] = useState(false)

  // Step 1: count the tabs and ask for confirmation
  const handlePrepareSaveAllTabs = useCallback(async () => {
    try {
      const tabBookmarks = await captureAllTabs()
      if (tabBookmarks.length === 0) {
        setFlash('No bookmarkable tabs found')
        return
      }
      setPendingTabs(tabBookmarks)
    } catch (error) {
      console.error('Error reading open tabs:', error)
      setFlash('Failed to read open tabs')
    }
  }, [setFlash])

  // Step 2: save them once confirmed
  const handleSaveAllTabs = useCallback(async () => {
    if (!manifest) {
      setFlash('Manifest not loaded')
      return
    }
    const tabBookmarks = pendingTabs
    if (!tabBookmarks || tabBookmarks.length === 0) {
      setPendingTabs(null)
      return
    }

    setIsSavingTabs(true)
    try {

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
    } finally {
      setIsSavingTabs(false)
      setPendingTabs(null)
    }
  }, [addBookmark, manifest, pendingTabs, save, setFlash])

  const todayTag = new Date().toISOString().split('T')[0]

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

          {isAuthenticated && (
            <Button
              variant='ghost'
              color='light'
              className={styles.libraryButton}
              title='Open all your bookmarks in a new tab'
              onClick={() => openExtensionPage('app')}
            >
              My bookmarks
              <ExternalLink strokeWidth={2} size={14} />
            </Button>
          )}

          {canShowMenu && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  asIcon={true}
                  variant='ghost'
                  color='light'
                  title='Menu'
                  aria-label='Menu'
                >
                  <Menu strokeWidth={2} size={18} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align='end' collisionPadding={8}>
                {isAuthenticated && (
                  <DropdownMenu.Item
                    onClick={() => navigate('/bookmark', { bookmark: 'blank' })}
                  >
                    <StarIcon strokeWidth={1} size={18} />
                    New blank bookmark
                  </DropdownMenu.Item>
                )}

                {isAuthenticated && (
                  <DropdownMenu.Item onClick={handlePrepareSaveAllTabs}>
                    <Save strokeWidth={1} size={18} /> Save all
                    open tabs…
                  </DropdownMenu.Item>
                )}

                {isAuthenticated && (
                  <DropdownMenu.Item onClick={() => openExtensionPage('tags')}>
                    <TagIcon strokeWidth={1} size={18} /> Tags
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  onClick={() => openExtensionPage('settings')}
                >
                  <Settings2 strokeWidth={1} size={18} /> Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => openExtensionPage('help')}>
                  <HelpCircle strokeWidth={1} size={18} /> Help
                </DropdownMenu.Item>
                {isAuthenticated && <DropdownMenu.Separator />}
                {isAuthenticated && (
                  <DropdownMenu.Item onClick={() => logout.mutate()}>
                    <LogOut strokeWidth={1} size={18} /> Logout
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </div>
      </div>

      <Dialog
        title={`Save ${pendingTabs?.length ?? 0} open tab${pendingTabs?.length === 1 ? '' : 's'}?`}
        description={`Each tab becomes a bookmark tagged "${todayTag}".`}
        open={pendingTabs !== null}
        onClose={() => !isSavingTabs && setPendingTabs(null)}
        width={340}
      >
        <div className={styles.dialogActions}>
          <Button
            variant='ghost'
            color='light'
            onClick={() => setPendingTabs(null)}
            disabled={isSavingTabs}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveAllTabs} disabled={isSavingTabs}>
            {isSavingTabs ? 'Saving…' : 'Save tabs'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
