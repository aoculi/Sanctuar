import { Folder, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useCollections } from '@/components/hooks/useCollections'

import ActionBtn from '@/components/ui/ActionBtn'

import styles from './styles.module.css'

export default function CreateCollection() {
  const { createCollection } = useCollections()
  const [isCreating, setIsCreating] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const collectionNameRef = useRef(collectionName)

  // Keep ref in sync with state
  useEffect(() => {
    collectionNameRef.current = collectionName
  }, [collectionName])

  const handleCreateCollection = useCallback(async () => {
    const trimmedName = collectionNameRef.current.trim()
    if (!trimmedName) {
      setIsCreating(false)
      setCollectionName('')
      return
    }

    try {
      await createCollection({
        name: trimmedName
      })
      setIsCreating(false)
      setCollectionName('')
    } catch (error) {
      // Handle error silently or show a message
      console.error('Failed to create collection:', error)
      setIsCreating(false)
      setCollectionName('')
    }
  }, [createCollection])

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  useEffect(() => {
    if (!isCreating) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        handleCreateCollection()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCreating, handleCreateCollection])

  const handleStartCreating = () => {
    setIsCreating(true)
    setCollectionName('')
  }

  const handleCancel = () => {
    setIsCreating(false)
    setCollectionName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateCollection()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (!isCreating) {
    return (
      <div className={styles.component}>
        <ActionBtn
          icon={Plus}
          label='New collection'
          size='lg'
          onClick={handleStartCreating}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.component}>
      <div className={styles.createRow}>
        <Folder size={16} className={styles.icon} />
        <input
          ref={inputRef}
          type='text'
          className={styles.input}
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Collection name'
        />
        <ActionBtn
          icon={X}
          size='sm'
          onClick={handleCancel}
        />
      </div>
    </div>
  )
}
