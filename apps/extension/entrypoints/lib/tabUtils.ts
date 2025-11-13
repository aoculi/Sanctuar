/**
 * Tab utilities for background script
 */

export interface TabInfo {
  url: string | undefined;
  title: string | undefined;
  id: number | undefined;
  picture: string | undefined;
}

/**
 * Get current active tab - background script has reliable access
 */
export async function getCurrentTab(): Promise<TabInfo | null> {
  if (!chrome.tabs) {
    console.error("chrome.tabs is not available");
    throw new Error("chrome.tabs is not available");
  }

  if (typeof chrome.tabs.query !== "function") {
    console.error("chrome.tabs.query is not a function", chrome.tabs);
    throw new Error("chrome.tabs.query is not a function");
  }

  const queryOptions = { active: true, currentWindow: true };

  try {
    // Try Promise-based approach (Manifest V3)
    const queryResult = chrome.tabs.query(queryOptions);

    if (queryResult && typeof queryResult.then === "function") {
      // Promise-based API available
      const tabs = await queryResult;
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        return {
          url: tab.url,
          title: tab.title,
          id: tab.id,
          picture: tab.favIconUrl,
        };
      } else {
        throw new Error("No active tab found");
      }
    } else {
      // Fallback to callback-based API
      return new Promise((resolve, reject) => {
        chrome.tabs.query(queryOptions, (tabs) => {
          if (chrome.runtime.lastError) {
            console.error(
              "chrome.runtime.lastError:",
              chrome.runtime.lastError,
            );
            reject(
              new Error(
                chrome.runtime.lastError.message || "Unknown error",
              ),
            );
            return;
          }

          if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            resolve({
              url: tab.url,
              title: tab.title,
              id: tab.id,
              picture: tab.favIconUrl,
            });
          } else {
            reject(new Error("No active tab found"));
          }
        });
      });
    }
  } catch (error) {
    console.error("Error in getCurrentTab:", error);
    throw error;
  }
}
