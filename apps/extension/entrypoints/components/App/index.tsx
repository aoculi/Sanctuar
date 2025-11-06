import { sessionManager } from "@/entrypoints/store/session";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "../../hooks/auth";
import Login from "../Screens/Login";
import Register from "../Screens/Register";
import Settings from "../Screens/Settings";
import Vault from "../Screens/Vault";

import styles from "./styles.module.css";

export type Route = "/login" | "/register" | "/vault" | "/settings";

type NavigationContextType = {
  navigate: (route: Route) => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within App");
  }
  return context;
};

export default function App() {
  const [route, setRoute] = useState<Route>("/login");
  const [flash, setFlash] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const sessionQuery = useSession();

  // Check session on popup mount using GET /auth/session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await sessionManager.getSession();

        if (session) {
          // Validate session with server
          const sessionData = await sessionQuery.refetch();

          if (sessionData.data?.valid) {
            // Session is valid, proceed to vault
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
      } catch (error) {
        // On error, assume invalid session
        console.error("Session check failed:", error);
        await sessionManager.clearSession();
        setRoute("/login");
        setFlash("Session check failed");
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Listen for auth events
  useEffect(() => {
    const unsubscribe = sessionManager.onUnauthorized(() => {
      if (route !== "/login") setFlash("Session expired");
      setRoute("/login");
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
      case "/settings":
        return <Settings />;
      case "/vault":
      default:
        return <Vault />;
    }
  };

  return (
    <NavigationContext.Provider value={{ navigate }}>
      <div className={styles.container}>
        {flash && <div className={styles.flash}>{flash}</div>}
        {renderRoute()}
      </div>
    </NavigationContext.Provider>
  );
}
