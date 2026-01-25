import { Folder, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useCollections } from '@/components/hooks/useCollections'

import ActionBtn from '@/components/ui/ActionBtn'
import Collapsible from '@/components/ui/Collapsible'

import styles from './styles.module.css'

interface CreateCollectionProps {
  compact?: boolean
}

export default function CreateCollection({ compact = false }: CreateCollectionProps) {
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

  // Compact mode for sidebar
  if (compact) {
    if (isCreating) {
      return (
        <div ref={containerRef} className={styles.compactWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={styles.compactInput}
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Name..."
          />
          <button
            type="button"
            className={styles.compactCancel}
            onClick={handleCancel}
          >
            <X size={12} />
          </button>
        </div>
      )
    }

    return (
      <button
        type="button"
        className={styles.compactBtn}
        onClick={handleStartCreating}
        title="New collection"
      >
        <Plus size={14} />
      </button>
    )
  }

  // Full mode
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
      <Collapsible
        icon={Folder}
        label={
          <div className={styles.labelContent}>
            <div
              className={styles.inputWrapper}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type='text'
                className={styles.input}
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                placeholder='Collection name'
              />
            </div>
            <ActionBtn
              icon={X}
              size='sm'
              onClick={(e) => {
                e.stopPropagation()
                handleCancel()
              }}
            />
          </div>
        }
        count={0}
        defaultOpen={true}
        editable={true}
      >
        <></>
      </Collapsible>
    </div>
  )
}
