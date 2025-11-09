import { createContext, useContext, useEffect, useState } from "react";

import { useSession } from "@/entrypoints/components/hooks/auth";
import { SettingsModal } from "@/entrypoints/components/Screens/SettingsModal";
import { keystoreManager } from "@/entrypoints/store/keystore";
import { sessionManager } from "@/entrypoints/store/session";
import { settingsStore } from "@/entrypoints/store/settings";
import Login from "./Login";
import Register from "./Register";
import Vault from "./Vault";

import styles from "./styles.module.css";

export type Route = "/login" | "/register" | "/vault";

type NavigationContextType = {
  navigate: (route: Route) => void;
  setFlash: (message: string | null) => void;
  openSettings: () => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within Screens");
  }
  return context;
};

export default function Screens() {
  const [route, setRoute] = useState<Route>("/login");
  const [flash, setFlash] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const sessionQuery = useSession();

  // Check session and keystore on popup mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if API URL is set, if not open settings drawer
        const settings = await settingsStore.getState();
        if (!settings.apiUrl || settings.apiUrl.trim() === "") {
          setIsSettingsOpen(true);
        }

        const session = await sessionManager.getSession();
        const isUnlocked = await keystoreManager.isUnlocked();

        // If keystore is locked, redirect to login (even if session is valid)
        if (!isUnlocked) {
          setRoute("/login");
          setFlash("Vault locked - please login again");
          setIsChecking(false);
          return;
        }

        if (session) {
          // Validate session with server
          const sessionData = await sessionQuery.refetch();

          if (sessionData.data?.valid) {
            // Session is valid and keystore is unlocked, proceed to vault
            setRoute("/vault");
          } else {
            // Session invalid, clear and show login
            await sessionManager.clearSession();
            setRoute("/login");
            setFlash("Session expired");
          }
        } else {
          // No session, show login
          setRoute("/login");
        }
      } catch (error: any) {
        // Check if it's an API URL configuration error
        if (error?.status === -1 && error?.message?.includes("API URL")) {
          setFlash(error.message);
          setIsSettingsOpen(true);
        } else {
          // On other errors, assume invalid session
          console.error("Session check failed:", error);
          await sessionManager.clearSession();
          setRoute("/login");
          setFlash("Session check failed");
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Listen for auth events (keystore locked, session expired, etc.)
  useEffect(() => {
    const unsubscribe = sessionManager.onUnauthorized(() => {
      // Use functional update to avoid stale closure
      setRoute((currentRoute) => {
        // Only redirect from protected routes (vault)
        // Don't redirect if already on login or register
        if (currentRoute === "/vault") {
          setFlash("Vault locked - please login again");
          return "/login";
        }
        // Stay on current route if already on login/register
        return currentRoute;
      });
    });

    return unsubscribe;
  }, []);

  // Function to handle successful login
  const handleLoginSuccess = () => {
    setFlash(null);
    setRoute("/vault");
  };

  // Function to handle successful registration
  const handleRegisterSuccess = () => {
    setFlash(null);
    setRoute("/vault");
  };

  const navigate = (newRoute: Route) => {
    setRoute(newRoute);
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  if (isChecking) {
    return (
      <div className={styles.container}>
        <p>Checking session...</p>
      </div>
    );
  }

  const renderRoute = () => {
    switch (route) {
      case "/login":
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case "/register":
        return <Register onRegisterSuccess={handleRegisterSuccess} />;
      case "/vault":
      default:
        return <Vault />;
    }
  };

  return (
    <NavigationContext.Provider value={{ navigate, setFlash, openSettings }}>
      <div className={styles.container}>
        {flash && <div className={styles.flash}>{flash}</div>}
        {renderRoute()}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </NavigationContext.Provider>
  );
}
