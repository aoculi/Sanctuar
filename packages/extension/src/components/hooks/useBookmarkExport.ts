import { useState } from 'react'

import { useNavigation } from '@/components/hooks/providers/useNavigationProvider'
import { useBookmarks } from '@/components/hooks/useBookmarks'
import { useTags } from '@/components/hooks/useTags'
import type { Bookmark } from '@/lib/types'

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function useBookmarkExport() {
  const { setFlash } = useNavigation()
  const { bookmarks } = useBookmarks()
  const { tags } = useTags()

  const [isExporting, setIsExporting] = useState(false)
  const [exportWithTags, setExportWithTags] = useState(true)
  const [duplicateToAllTags, setDuplicateToAllTags] = useState(false)

  const handleExport = async () => {
    if (bookmarks.length === 0) {
      setFlash('No bookmarks to export')
      return
    }

    setIsExporting(true)
    setFlash(null)

    try {
      // Create a tag map for quick lookup
      const tagMap = new Map(tags.map((tag) => [tag.id, tag.name]))

      // Generate HTML in Netscape Bookmark File Format
      const htmlParts: string[] = [
        '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        '<TITLE>Bookmarks</TITLE>',
        '<H1>Bookmarks</H1>',
        '<DL><p>'
      ]

      if (exportWithTags) {
        // Group bookmarks by tags
        const bookmarksByTag = new Map<string, Bookmark[]>()

        bookmarks.forEach((bookmark) => {
          if (duplicateToAllTags && bookmark.tags.length > 0) {
            // Add bookmark to all its tag folders
            bookmark.tags.forEach((tagId) => {
              const tagName = tagMap.get(tagId) || 'Uncategorized'
              if (!bookmarksByTag.has(tagName)) {
                bookmarksByTag.set(tagName, [])
              }
              bookmarksByTag.get(tagName)!.push(bookmark)
            })
          } else {
            // Add bookmark only to first tag folder (or Uncategorized)
            const tagName =
              bookmark.tags.length > 0
                ? tagMap.get(bookmark.tags[0]) || 'Uncategorized'
                : 'Uncategorized'

            if (!bookmarksByTag.has(tagName)) {
              bookmarksByTag.set(tagName, [])
            }
            bookmarksByTag.get(tagName)!.push(bookmark)
          }
        })

        // Sort tags alphabetically
        const sortedTags = Array.from(bookmarksByTag.keys()).sort()

        sortedTags.forEach((tagName) => {
          const tagBookmarks = bookmarksByTag.get(tagName)!

          // Add folder (tag) header - DT wraps H3 and DL
          htmlParts.push(
            `<DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}">${escapeHtml(tagName)}</H3>`
          )
          htmlParts.push('<DL><p>')

          // Add bookmarks in this tag
          tagBookmarks.forEach((bookmark) => {
            const addDate = bookmark.created_at
              ? Math.floor(bookmark.created_at / 1000)
              : Math.floor(Date.now() / 1000)
            const lastModified = bookmark.updated_at
              ? Math.floor(bookmark.updated_at / 1000)
              : addDate

            htmlParts.push(
              `<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${addDate}" LAST_MODIFIED="${lastModified}">${escapeHtml(bookmark.title)}</A></DT>`
            )
          })

          htmlParts.push('</DL><p>')
          htmlParts.push('</DT>')
        })
      } else {
        // Export without tags - flat list
        bookmarks.forEach((bookmark) => {
          const addDate = bookmark.created_at
            ? Math.floor(bookmark.created_at / 1000)
            : Math.floor(Date.now() / 1000)
          const lastModified = bookmark.updated_at
            ? Math.floor(bookmark.updated_at / 1000)
            : addDate

          htmlParts.push(
            `<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${addDate}" LAST_MODIFIED="${lastModified}">${escapeHtml(bookmark.title)}</A></DT>`
          )
        })
      }

      htmlParts.push('</DL><p>')

      const htmlContent = htmlParts.join('\n')

      // Create and download the file
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lockmark-bookmarks-${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setFlash('Bookmarks exported successfully')
    } catch (error) {
      console.error('Error exporting bookmarks:', error)
      setFlash('Failed to export bookmarks')
    } finally {
      setIsExporting(false)
    }
  }

  return {
    isExporting,
    exportWithTags,
    setExportWithTags,
    duplicateToAllTags,
    setDuplicateToAllTags,
    handleExport
  }
}
