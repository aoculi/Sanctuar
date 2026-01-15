/**
 * Type definitions for the vault system
 */

/**
 * ManifestV1 - In-memory decrypted structure
 */
export interface ManifestV1 {
  version: number // mirrors server version
  items: Bookmark[] // editable list
  tags?: Tag[] // optional centralized tag list
  collections?: Collection[] // collections (direct bookmark associations)
  chain_head?: string // reserved (ignore for now)
}

/**
 * Bookmark
 */
export interface Bookmark {
  id: string // nanoid
  url: string
  title: string
  note: string
  picture: string
  tags: string[] // tag ids
  collectionId?: string // optional collection id
  pinned?: boolean
  hidden?: boolean // whether bookmark is hidden (default: false)
  created_at: number // epoch ms
  updated_at: number // epoch ms
}

/**
 * Tag
 */
export interface Tag {
  id: string // nanoid
  name: string // display name
  color?: string // optional UI hint
  pinned?: boolean // whether tag is pinned (default: false)
}

/**
 * Collection - Folder that groups bookmarks by direct association
 */
export interface Collection {
  id: string // nanoid
  name: string // display name
  icon?: string // lucide icon name (e.g., 'Folder', 'Star', 'Briefcase')
  parentId?: string // for nesting (null = root level)
  order?: number // manual sort order (lower = first)
  created_at: number // epoch ms
  updated_at: number // epoch ms
}

/**
 * Crypto environment state
 */
export interface CryptoEnv {
  ready: boolean
  sodium: typeof import('libsodium-wrappers-sumo') | null
}
