/**
 * Utility functions for opening extension pages in browser tabs
 */

type ExtensionPage = 'app' | 'settings' | 'tags'

const pageUrls: Record<ExtensionPage, string> = {
  app: '/app.html',
  settings: '/app.html?route=settings',
  tags: '/app.html?route=tags'
}

/**
 * Opens an extension page by navigating the current tab.
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

  // Navigate the current tab instead of opening a new one
  if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
    chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      if (currentTabs && currentTabs.length > 0 && currentTabs[0].id !== undefined) {
        chrome.tabs.update(currentTabs[0].id, { url: pageUrl })
      } else {
        chrome.tabs.create({ url: pageUrl })
      }
    })
  } else if (typeof browser !== 'undefined' && browser.tabs?.update) {
    browser.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      if (currentTabs && currentTabs.length > 0 && currentTabs[0].id !== undefined) {
        browser.tabs.update(currentTabs[0].id, { url: pageUrl })
      } else {
        browser.tabs.create({ url: pageUrl })
      }
    })
  } else {
    window.location.href = pageUrl
  }
}

/**
 * Opens multiple URLs in new tabs in the current window.
 * Handles both Chrome and Firefox, and works correctly in incognito mode.
 */
export function openUrlsInTabs(urls: string[]): void {
  if (urls.length === 0) return

  // Get current window to open tabs in same window (important for incognito)
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      urls.forEach((url) => {
        chrome.tabs.create({ url, ...(windowId ? { windowId } : {}) })
      })
    })
  } else if (typeof browser !== 'undefined' && browser.tabs?.create) {
    browser.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
      const windowId = currentTabs?.[0]?.windowId
      urls.forEach((url) => {
        browser.tabs.create({ url, ...(windowId ? { windowId } : {}) })
      })
    })
  } else {
    urls.forEach((url) => {
      window.open(url, '_blank')
    })
  }
}
