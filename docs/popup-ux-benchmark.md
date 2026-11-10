# Popup UX benchmark: Sanctuar vs Raindrop.io vs Evernote Web Clipper

_Date: 2026-11-10. Branch: PR aoculi/Sanctuar#11 (popup redesign already applied). Research only, no code changed._

## Sources and limits

- **Raindrop.io**: official help pages: [bookmarks](https://help.raindrop.io/bookmarks), [browser extension](https://help.raindrop.io/browser-extension), [shortcuts](https://help.raindrop.io/shortcuts), [collections](https://help.raindrop.io/collections), [tags](https://help.raindrop.io/tags), plus the [AI Suggestions blog post](https://blog.raindrop.io/ai-suggestions-5a85762ae176/).
- **Evernote Web Clipper**: the [marketing page](https://evernote.com/features/webclipper) has little detail. I used the official help center: [Quick Start](https://help.evernote.com/hc/en-us/articles/209125877), [Clip formats + Organize clips](https://help.evernote.com/hc/en-us/articles/209125827) and [Web Clipper settings](https://help.evernote.com/hc/en-us/articles/208314738). These pages return 403 to a plain fetcher, so I read them in a real browser.
- I did not install either extension. Anything the official docs don't state is marked _"not documented"_ instead of filled in from memory. The exact popup layouts in particular were not checked.

---

## 1. Side-by-side: the save flow

| Step | Raindrop.io | Evernote Web Clipper | Sanctuar (PR #11) |
|---|---|---|---|
| **Opening** | Toolbar icon. Keyboard shortcut (Firefox default Alt+X / ⌃X, Chrome Ctrl+Shift+S), user-remappable. Right-click on the icon gives Settings / Open Sidebar. Also a bookmarklet, a sidebar mode (Ctrl/⌘+.) and an `rd` omnibox search. | Toolbar "elephant" icon, pinned. Shortcuts exist and can be customized in the clipper's settings; the help pages don't list the keys. | Toolbar icon only. No `commands` in `wxt.config.ts`, so no keyboard shortcut, no context menu, no omnibox. The icon switches to a locked variant when you're signed out (`background.ts`). |
| **Saves on open?** | No by default (pick a collection, then Save). Optional **"Save automatically"**: one click saves to Unsorted or the **last used collection**. | No: you click "Save clip". _Smart filing_ then files it to the default or predicted notebook. | No: the form opens and you click Create (or Ctrl/⌘+Enter). |
| **Auto-filled** | Title, description, thumbnail/cover, content type (article/video/…), full text for search. | Title (editable). Content depends on clip type (Article, Simplified, Full page, **Bookmark** = URL + thumbnail + text snippet, Screenshot, Selection…). | Title, URL and favicon from the tab (`pageCapture.ts`). No description, no preview image. The Note gets focus. |
| **Collection / notebook** | Defaults to **Unsorted** (an inbox). You click the collection name to change it. **AI-suggested collections** come from page content and are picked only from your existing collections. | Default notebook, or **smart filing**, which predicts a notebook from how you filed similar clips before. You can also choose one by hand. | Nested Radix dropdown, defaults to "No collection" **every time**. No search, no "new collection", no memory of the last one used. |
| **Tags** | Comma-separated, free text, created inline. **AI-suggested tags** from page content (taken from existing tags). | Add one or more tags, remove with ×. Optional **auto-tag** set in settings; smart filing also suggests tags. | Autocomplete over existing tags with keyboard navigation and colored chips. **You can't create a new tag from the popup**: Enter only picks a suggestion (`TagSelectorField`). |
| **Notes** | Not part of the documented extension steps; notes are added later in the edit screen. Highlights are a separate feature. | **Remark** field ("why I clipped this"). | Note field with autofocus and the placeholder "Why are you saving this?". |
| **Duplicates** | Optional **badge on the toolbar icon** when the current page is already saved. Saving the same URL into another collection makes a separate copy. | Not documented. | Exact URL match (lowercased) → form opens as **"Already bookmarked"** in edit mode. No badge. No URL normalization (trailing `/`, `utm_*`, `#hash`). |
| **Saving** | Save button (or auto-save). | "Save clip". | Create/Save in a pinned footer, with Ctrl/⌘+Enter and a visible hint. |
| **Confirmation** | Not documented in detail. | **"After clip"** setting: you choose what happens after clipping. | Success screen with a check icon, "Bookmark saved", **Open my bookmarks** and **Done** (autofocused). |
| **Getting to the library** | Sidebar mode, omnibox, web/desktop app. | Opens in Evernote. **Related results** (your notes shown beside web search results). | "My bookmarks" button in the header plus a link on the success screen. |
| **Bulk** | Save all tabs. | — | Save all open tabs, with a confirmation and an automatic date tag. |

---

## 2. Prioritized changes for Sanctuar's popup

Effort: **S** < half a day, **M** = 1–2 days, **L** = more. Paths are relative to `packages/extension/src/`.

### High impact

**H1. Create a tag inline from the tag input.** _(S–M)_
- **What:** when the typed text matches no existing tag, show a "Create "foo"" option at the bottom of the suggestions. Enter or a comma creates the tag and selects it. Also accept pasting `a, b, c`.
- **Why:** Raindrop and Evernote both let you type new tags while saving. Today a Sanctuar user who wants a new tag has to leave the popup and go to the Tags page, which breaks the capture flow.
- **Files:** `components/ui/TagSelectorField/index.tsx` (+ css), `components/parts/Bookmarks/BookmarkForm/index.tsx` (pass an `onCreateTag`), `components/hooks/useTags.ts` (`createTag` already exists).

**H2. Smart default collection: remember the last one used.** _(S)_
- **What:** pre-select the collection used for the last save, stored locally in the encrypted manifest or extension storage. A setting can switch between "Last used" and "No collection".
- **Why:** Raindrop's auto-save uses the last used collection, and Evernote has a default notebook. Today Sanctuar resets to "No collection" on every open, so anyone who files consistently has to make one extra pick per save.
- **Files:** `components/Screens/Bookmark/index.tsx` (initial `collectionId`), `lib/storage.ts` / `lib/constants.ts`, `components/hooks/providers/useSettingsProvider` + Settings page.

**H3. Local, private collection/tag suggestions ("smart filing" without the cloud).** _(M)_
- **What:** show 1–3 suggestion chips above the Collection and Tags fields, computed **in the popup from the decrypted vault**, mainly by the same hostname (where did I file other `github.com` links, and which tags did they get?), with keyword overlap against the title as a fallback. Clicking a chip applies it.
- **Why:** this is the headline organizing feature of both references (Raindrop's AI suggestions, Evernote's smart filing), and both suggest only from your *existing* collections and tags. Raindrop does it server-side with AI, which Sanctuar can't do with end-to-end encryption. A local heuristic gives most of the benefit and doubles as a privacy selling point ("suggestions never leave your device").
- **Files:** new `lib/suggestions.ts`, `components/parts/Bookmarks/BookmarkForm/index.tsx`, small chip UI in `components/ui/CollectionSelect` / `TagSelectorField`.

**H4. Keyboard shortcut to open the popup.** _(S)_
- **What:** add `commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+S' } } }` (MV2 Firefox: `_execute_browser_action`) in `wxt.config.ts`, pick a combination that doesn't clash with Raindrop's defaults, and show it in Help/Settings. Together with the existing note autofocus and Ctrl/⌘+Enter, saving becomes keyboard-only: shortcut → type → Ctrl+Enter → Enter (Done).
- **Why:** Raindrop documents remappable shortcuts per browser, and Evernote has customizable shortcuts.
- **Files:** `wxt.config.ts`, Help page copy. Check it in Zen: Firefox lets users remap it under about:addons → Manage Extension Shortcuts.

**H5. Stop sending every saved hostname to Google for favicons.** _(S)_
- **What:** `BookmarkForm` falls back to `https://www.google.com/s2/favicons?domain=…`. That tells Google which sites the user bookmarks, which contradicts Sanctuar's privacy promise. Use the tab's `favIconUrl` (already captured), then the site's own `/favicon.ico`, then the Globe placeholder.
- **Why:** this isn't a reference feature but a trust issue specific to a privacy-focused product, and it's visible in the popup.
- **Files:** `components/parts/Bookmarks/BookmarkForm/index.tsx` (`faviconUrl` memo). `components/parts/Bookmarks/BookmarkRow/index.tsx:47` does the same for every row in the full app, so fix both.

### Medium impact

**M1. "Already saved" badge on the toolbar icon.** _(M)_
- **What:** on tab activation or URL change, the background checks the URL against the unlocked vault's URL set (in memory only, nothing stored in plain text) and shows a small ✓ badge. Off by default, or tied to an unlocked session, because it needs tab URL access, which Sanctuar already has through `tabs` + `<all_urls>`.
- **Why:** Raindrop offers exactly this. It answers "did I already save this?" without opening the popup.
- **Files:** `entrypoints/background.ts`, a message from the popup/app to keep the URL set current, a Settings toggle. Watch out: the background must not keep decrypted data after auto-lock.

**M2. Normalize URLs for duplicate detection.** _(S)_
- **What:** compare URLs with tracking parameters (`utm_*`, `fbclid`, `gclid`), the `#fragment`, the trailing slash and `www.` removed. Optionally show "Saved 3 weeks ago in *Reading*" in the "Already bookmarked" header.
- **Why:** Sanctuar's in-popup duplicate handling is already better than what the references document (see §3). Normalization makes it catch the duplicates people actually hit.
- **Files:** `lib/utils.ts` (new `normalizeUrl`), `components/Screens/Bookmark/index.tsx`.

**M3. Create a collection from the picker.** _(M)_
- **What:** add a "+ New collection…" item at the bottom of `CollectionSelect` that switches to an inline name input, optionally with a parent. Add a search box once there are more than about 10 collections.
- **Why:** Raindrop and Evernote both let you choose freely at save time. Without this, a new topic means leaving the popup. Search matters because a nested list quickly outgrows a 500 px popup.
- **Files:** `components/ui/CollectionSelect/index.tsx` (+ css), `components/hooks/useCollections.ts` (`createCollection` exists). Logic can come from `components/parts/Bookmarks/CreateCollection`. Keep DropdownMenu in modal mode, which Firefox needs. A text input inside a Radix menu needs `onKeyDown` stopPropagation to avoid typeahead; test in Zen.

**M4. Remove / undo from the popup.** _(S)_
- **What:** in "Already bookmarked" mode, add a quiet "Remove" button in the footer. On the success screen, add **Undo** next to Done.
- **Why:** a quick save sometimes lands in the wrong place or wasn't wanted. Today fixing it means opening the full app.
- **Files:** `components/Screens/Bookmark/index.tsx`, `components/parts/Bookmarks/BookmarkForm/index.tsx` (extra footer slot), `useBookmarks` (`deleteBookmark`).

**M5. Optional "quick save" mode and a choice of what happens after saving.** _(M)_
- **What:** a setting "After saving: show confirmation / close automatically after 1 s / stay open". Optionally, a "Save automatically" mode that creates the bookmark on open (with the H2 default collection) and shows the form for edits, with Remove (M4) as the safety net.
- **Why:** Raindrop's "Save automatically" and Evernote's "After clip" setting both let power users cut the flow to one click. Keep today's behavior as the default.
- **Files:** `components/Screens/Bookmark/index.tsx`, settings provider + Settings page.

**M6. Save a short description with the bookmark.** _(M)_
- **What:** read `meta[name=description]` / `og:description` (and optionally `og:image`) from the active tab, using `scripting.executeScript` or the existing background `FETCH_METADATA` fetch. Store it encrypted, show it as a muted one-line preview under the URL, and let it be edited.
- **Why:** Raindrop auto-fills a description and cover, and Evernote's Bookmark clip saves a thumbnail and snippet. Both make the library easier to scan and search later. The note stays for the user's own words.
- **Files:** `lib/pageCapture.ts`, `lib/types.ts` (new optional field), `BookmarkForm`, API/manifest schema in `packages/api` if a field is added. Weigh the size of the encrypted manifest before adding images; a description alone is cheap.

### Low impact

**L1. Make the shortcut hint and "Hide from list" lighter.** _(S)_ "Hide from list" plus its hint takes vertical space on every save for a feature most saves don't use. Move it into a small "More options" disclosure, or make it an icon toggle in the footer. Files: `BookmarkForm/index.tsx` + css.

**L2. Right-click "Save link to Sanctuar" / "Save page to Sanctuar".** _(M)_ Raindrop has right-click access (on its icon). A context-menu entry on a *link* saves pages you haven't opened. It needs the `contextMenus` permission and a background flow that opens the popup or a small window with the URL prefilled. Files: `wxt.config.ts`, `entrypoints/background.ts`, `Screens/Bookmark` (accept a URL param).

**L3. Pin from the popup.** _(S)_ The form sends `pinned: false` on create. A star toggle in the header row would let you pin right away (the full app has a PinnedList). Files: `BookmarkForm`, `Screens/Bookmark`.

**L4. Show the shortcut on the success screen.** _(S)_ Once H4 exists, a muted "Tip: Alt+Shift+S opens Sanctuar" under Done teaches it. Files: `Screens/Bookmark/index.tsx`.

**L5. Login / PIN screens polish.** _(S)_ PinUnlock already autofocuses and auto-submits, which is good. Add a one-line reason on the lock screen ("Your vault locked after N min of inactivity") and, after unlocking, go straight back to the current tab's save form, as it does now. Check that Register explains up front that the password can't be recovered (E2EE), since a popup closes easily mid-flow. Files: `Screens/PinUnlock`, `components/AuthForm.tsx`.

**Not recommended:** Evernote-style clip formats (article, screenshot, full page). They turn a bookmark manager into a content archive, add a lot of weight, and would multiply encrypted storage. Raindrop's server-side AI suggestions conflict with end-to-end encryption, so H3 is the local substitute.

### Status

- **Done (2026-11-10):** H1, H2, H4, H5 (commit 847fceb); M2, M3, M4 (commit 33b7fdd).
- **Next batch:** H3, M1, M5, M6.

### Suggested order

H5 → H1 → H2 → H4 (all small, ship together) → H3 → M2 → M3 → M4 → M1 → M5/M6 → low items.

---

## 3. What Sanctuar already does better: keep it

- **End-to-end encryption and a locked-state icon.** Neither reference is E2EE. The icon that switches to a locked variant tells you the vault state before you even open the popup.
- **Duplicate handling inside the popup.** Opening on an already-saved page switches to an "Already bookmarked" edit form with the existing data. Raindrop documents only an optional icon badge, and saving into another collection makes a *copy*. Evernote documents nothing.
- **Note autofocus plus "Why are you saving this?".** Raindrop leaves notes for later. Sanctuar puts the most valuable context first, which matches Evernote's Remark but with less friction.
- **Ctrl/⌘+Enter with a visible hint and a pinned footer.** Neither reference documents a save shortcut inside the popup.
- **Explicit success screen** with "Open my bookmarks" and an autofocused "Done", so Enter closes it. This is clearer than an unconfirmed save and keeps the keyboard-only flow.
- **Clearly labeled "My bookmarks" entry** in the header. The library is one click away and isn't hidden behind an icon.
- **Save all tabs with a confirmation and an automatic date tag.** Raindrop has save-tabs, but the date tag that makes the batch easy to find again is a nice touch.
- **Nested collection picker that stays inside the popup and works in Firefox/Zen.** Keep modal mode.
- **Colored tag chips and keyboard navigation** in the tag field.
- **The Sanctuar logo stays as it is.**
