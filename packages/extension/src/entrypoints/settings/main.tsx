import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import Settings from '@/components/Screens/Settings'
import { AuthSessionProvider } from '@/components/hooks/providers/useAuthSessionProvider'
import { ManifestProvider } from '@/components/hooks/providers/useManifestProvider'
import { NavigationProvider } from '@/components/hooks/providers/useNavigationProvider'
import { SettingsProvider } from '@/components/hooks/providers/useSettingsProvider'
import ErrorBoundary from '@/components/parts/ErrorBoundary'

import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: (failureCount: number): boolean => {
        return failureCount < 3
      }
    },
    mutations: {
      retry: 0
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <SettingsProvider>
          <AuthSessionProvider>
            <ManifestProvider>
              <NavigationProvider initialRoute='/settings'>
                <Settings />
              </NavigationProvider>
            </ManifestProvider>
          </AuthSessionProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
)
