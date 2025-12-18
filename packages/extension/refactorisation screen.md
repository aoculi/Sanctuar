## The goal is to split the feature in two screen:

- A browser extension popup to add a bookmark
- a browser extension sidebar to check them

## Questions:

- how to manage auth if two screens
- if i want to see the bookmark (sidebar) and update one, we nd thave the update form in the sidebar too (duplication). it opens the popup, it's possible?

---

## Fix to do:

- increase app speed
- close popup on save bookmark
- close setting panel when save
- The tagSelector need to create a tag if not existing (with default value)
- logout (need to click twice)

## Features i want:

- colors on tag
- instead of favicon, use main image and favicon as backup?
- sorting, possible when a tag is not selected? it's more of a piority, no?
- add note in bookmark back
- delete bookmark/tag
- get title and description of the bookmark when saving
- shortcut
- proper export (json and valid html file compatible with browser)

## Questions:

- do we need categories?
- do we need an unsorted tag?
