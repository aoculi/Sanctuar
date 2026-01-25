/**
 * Utility functions for opening extension pages in browser tabs
 */

type ExtensionPage = 'app' | 'settings' | 'tags' | 'help'

const pageUrls: Record<ExtensionPage, string> = {
  app: '/app.html',
  settings: '/app.html?route=settings',
  tags: '/app.html?route=tags',
  help: '/app.html?route=help'
}

/**
 * Opens an extension page in a new tab.
 * Handles both Chrome and Firefox, and works correctly in incognito mode.
 */
export function openExtensionPage(page: ExtensionPage): void {
  const runtime =
    (typeof chrome !== 'undefined' && chrome.runtime) ||
    (typeof browser !== 'undefined' && browser.runtime)

  if (!runtime) {
    console.error('Browser runtime not available')
    return
  }

  const pageUrl = runtime.getURL(pageUrls[page] as any)
  if (!pageUrl) {
    console.error(`Unable to get URL for ${page} page`)
    return
  }

  // Open in a new tab in the current window
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      chrome.tabs.create({ url: pageUrl, ...(windowId ? { windowId } : {}) })
    })
  } else if (typeof browser !== 'undefined' && browser.tabs?.create) {
    browser.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      browser.tabs.create({ url: pageUrl, ...(windowId ? { windowId } : {}) })
    })
  } else {
    window.open(pageUrl, '_blank')
  }
}

/**
 * Opens multiple URLs in new tabs in the current window.
 * Handles both Chrome and Firefox, and works correctly in incognito mode.
 * Tabs are created in order by specifying their index positions.
 */
export function openUrlsInTabs(urls: string[]): void {
  if (urls.length === 0) return

  // Get current window to open tabs in same window (important for incognito)
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      const currentIndex = currentTabs?.[0]?.index ?? 0
      urls.forEach((url, i) => {
        chrome.tabs.create({
          url,
          index: currentIndex + 1 + i,
          ...(windowId ? { windowId } : {})
        })
      })
    })
  } else if (typeof browser !== 'undefined' && browser.tabs?.create) {
    browser.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      const currentIndex = currentTabs?.[0]?.index ?? 0
      urls.forEach((url, i) => {
        browser.tabs.create({
          url,
          index: currentIndex + 1 + i,
          ...(windowId ? { windowId } : {})
        })
      })
    })
  } else {
    urls.forEach((url) => {
      window.open(url, '_blank')
    })
  }
}
