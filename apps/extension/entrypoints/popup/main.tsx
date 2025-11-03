import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "../components/App";
import ErrorBoundary from "../components/ErrorBoundary";

import "@radix-ui/themes/styles.css";
import "../styles/globals.css";

// Ensure popup window gets focus when it opens (fixes issue where popup opens behind interface)
// This is especially important on Linux systems
if (typeof window !== "undefined") {
  // Focus immediately
  window.focus();

  // Also focus after a short delay to handle race conditions
  setTimeout(() => {
    window.focus();
  }, 0);

  // Focus on any user interaction as a fallback
  const focusHandler = () => {
    window.focus();
  };

  window.addEventListener("load", focusHandler);
  document.addEventListener("DOMContentLoaded", focusHandler);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: (
        failureCount: number,
        _error?: unknown,
        _ctx?: { query?: any }
      ) => {
        const query = _ctx?.query;
        const key = query?.queryKey as readonly unknown[];
        const isAuth = Array.isArray(key) && key[0] === "auth";
        const isManifest =
          Array.isArray(key) && key[0] === "vault" && key[1] === "manifest";
        if (isAuth || isManifest) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme
        appearance="dark"
        radius="medium"
        accentColor="violet"
        grayColor="gray"
      >
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </Theme>
    </QueryClientProvider>
  </React.StrictMode>
);
