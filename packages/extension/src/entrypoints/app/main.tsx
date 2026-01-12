import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from '@/components/Screens/App'
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

const params = new URLSearchParams(window.location.search)
const routeParam = params.get('route')
const initialRoute = routeParam === 'tags' || routeParam === 'settings' ? `/${routeParam}` : '/app'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App initialRoute={initialRoute as any} />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
)
