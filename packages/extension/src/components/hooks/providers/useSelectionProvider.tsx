import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState
} from 'react'

type SelectionContextType = {
  selectedBookmark: string | null
  selectedTag: string | null
  setSelectedBookmark: (id: string | null) => void
  setSelectedTag: (id: string | null) => void
  resetSelection: () => void
}

export const SelectionContext = createContext<SelectionContextType>({
  selectedBookmark: null,
  selectedTag: null,
  setSelectedBookmark: () => {},
  setSelectedTag: () => {},
  resetSelection: () => {}
})

/**
 * Hook to use the selection context
 * Must be used within a SelectionProvider
 */
export const useSelection = () => {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}

type SelectionProviderProps = {
  children: ReactNode
}

/**
 * Selection Provider Component
 * Provides global state for selected bookmark and tag
 */
export function SelectionProvider({ children }: SelectionProviderProps) {
  const [selectedBookmark, setSelectedBookmarkState] = useState<string | null>(
    null
  )
  const [selectedTag, setSelectedTagState] = useState<string | null>(null)

  const setSelectedBookmark = useCallback((id: string | null) => {
    setSelectedBookmarkState(id)
  }, [])

  const setSelectedTag = useCallback((id: string | null) => {
    setSelectedTagState(id)
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedBookmarkState(null)
    setSelectedTagState(null)
  }, [])

  const contextValue: SelectionContextType = {
    selectedBookmark,
    selectedTag,
    setSelectedBookmark,
    setSelectedTag,
    resetSelection
  }

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  )
}
