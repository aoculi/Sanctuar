import { useEffect, useState } from 'react';
import Login from '../Screens/Login';
import Vault from '../Screens/Vault';
import { sessionManager } from '../store';

type Route = '/login' | '/vault';

export default function App() {
    const [route, setRoute] = useState<Route>('/login');
    const [flash, setFlash] = useState<string | null>(null);

    // Initialize session and set initial route
    useEffect(() => {
        const init = async () => {
            const session = await sessionManager.getSession();
            setRoute(session ? '/vault' : '/login');
        };
        init();
    }, []);

    // Listen for auth events
    useEffect(() => {
        const unsubscribe = sessionManager.onUnauthorized(() => {
            setFlash('Session expired');
            setRoute('/login');
        });

        return unsubscribe;
    }, []);

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
            {route === '/login' ? <Login /> : <Vault />}
        </div>
    );
}
