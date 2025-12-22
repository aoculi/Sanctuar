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
  chain_head?: string // reserved (ignore for now)
}

/**
 * Bookmark
 */
export interface Bookmark {
  id: string // nanoid
  url: string
  title: string
  picture: string
  tags: string[] // tag ids
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
  hidden?: boolean // whether tag is hidden (default: false)
}

/**
 * Crypto environment state
 */
export interface CryptoEnv {
  ready: boolean
  sodium: typeof import('libsodium-wrappers-sumo') | null
}
