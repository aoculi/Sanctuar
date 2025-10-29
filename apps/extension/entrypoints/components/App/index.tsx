import { useEffect, useState } from 'react';
import { useSession } from '../../hooks/auth';
import { sessionManager } from '../../store';
import Login from '../Screens/Login';
import Vault from '../Screens/Vault';

type Route = '/login' | '/vault';

export default function App() {
    const [route, setRoute] = useState<Route>('/login');
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
                        setRoute('/vault');
                    } else {
                        // Session invalid, clear and show login
                        await sessionManager.clearSession();
                        setRoute('/login');
                        setFlash('Session expired');
                    }
                } else {
                    // No session, show login
                    setRoute('/login');
                }
            } catch (error) {
                // On error, assume invalid session
                console.error('Session check failed:', error);
                await sessionManager.clearSession();
                setRoute('/login');
                setFlash('Session check failed');
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
            setFlash('Session expired');
            setRoute('/login');
        });

        return unsubscribe;
    }, []);

    // Function to handle successful login
    const handleLoginSuccess = () => {
        setFlash(null);
        setRoute('/vault');
    };

    if (isChecking) {
        return (
            <div style={{ padding: 20, textAlign: 'center' }}>
                <p>Checking session...</p>
            </div>
        );
    }

    return (
        <div>
            {flash && (
                <div style={{
                    padding: 8,
                    color: '#b45309',
                    background: '#fffbeb',
                    border: '1px solid #f59e0b',
                    marginBottom: 8
                }}>
                    {flash}
                </div>
            )}
            {route === '/login' ? <Login onLoginSuccess={handleLoginSuccess} /> : <Vault />}
        </div>
    );
}
