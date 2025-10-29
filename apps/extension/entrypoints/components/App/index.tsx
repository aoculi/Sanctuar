/**
 * Main App component - Routing and state management
 */

import { useEffect, useState } from 'react';
import { zeroize } from '../../lib/crypto';
import { initCrypto } from '../../lib/cryptoEnv';
import {
    clearAllStorage,
    getFileHandle,
    storeFileHandle,
    storeVaultUuid
} from '../../lib/storage';
import type { AppRoute, UnlockedVault } from '../../lib/types';
import { createVaultFile, readVaultFile, unlockVault } from '../../lib/vaultFile';

import CreateVault from '../CreateVault';
import ErrorBoundary from '../ErrorBoundary';
import Home from '../Home';
import OpenVault from '../OpenVault';
import UnlockVault from '../UnlockVault';
import VaultView from '../VaultView';

function AppContent() {
    const [route, setRoute] = useState<AppRoute>('/');
    const [cryptoReady, setCryptoReady] = useState(false);
    const [unlockedVault, setUnlockedVault] = useState<UnlockedVault | null>(null);
    const [existingFileHandle, setExistingFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize crypto and check for existing vault
    useEffect(() => {
        const initialize = async () => {
            try {
                // Initialize crypto libraries
                await initCrypto();
                setCryptoReady(true);

                // Check for existing file handle
                const handle = await getFileHandle();
                if (handle) {
                    setExistingFileHandle(handle);
                    setRoute('/unlock');
                }
            } catch (error) {
                console.error('Initialization error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, []);

    // Handle Create Vault
    const handleCreateVault = async (
        fileHandle: FileSystemFileHandle,
        password: string
    ) => {
        try {
            const header = await createVaultFile(fileHandle, password);

            // Store file handle for future sessions
            await storeFileHandle(fileHandle);
            await storeVaultUuid(header.vault_uuid);

            // Now unlock the vault we just created
            const file = await fileHandle.getFile();
            const fileBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);

            // Read the vault we just created
            const { header: vaultHeader, encryptedManifest } = await readVaultFile(fileHandle);
            const { manifest, kek, mak } = await unlockVault(vaultHeader, encryptedManifest, password);

            // Set unlocked vault
            setUnlockedVault({
                header: vaultHeader,
                manifest,
                fileHandle,
                sessionKeys: { kek, mak },
            });

            setRoute('/vault');
        } catch (error) {
            throw error;
        }
    };

    // Handle Open Vault (from file picker)
    const handleOpenVault = async (
        fileHandle: FileSystemFileHandle,
        password: string
    ) => {
        try {
            const { header, encryptedManifest } = await readVaultFile(fileHandle);
            const { manifest, kek, mak } = await unlockVault(header, encryptedManifest, password);

            // Store file handle for future sessions
            await storeFileHandle(fileHandle);
            await storeVaultUuid(header.vault_uuid);

            // Set unlocked vault
            setUnlockedVault({
                header,
                manifest,
                fileHandle,
                sessionKeys: { kek, mak },
            });

            setRoute('/vault');
        } catch (error) {
            console.error('Open vault error:', error);
            throw error;
        }
    };

    // Handle Unlock Vault (existing vault)
    const handleUnlockExistingVault = async (password: string) => {
        if (!existingFileHandle) {
            throw new Error('No vault file reference found');
        }

        try {
            const { header, encryptedManifest } = await readVaultFile(existingFileHandle);
            const { manifest, kek, mak } = await unlockVault(header, encryptedManifest, password);

            // Set unlocked vault
            setUnlockedVault({
                header,
                manifest,
                fileHandle: existingFileHandle,
                sessionKeys: { kek, mak },
            });

            setRoute('/vault');
        } catch (error) {
            console.error('Unlock vault error:', error);
            throw error;
        }
    };

    // Handle Lock Vault
    const handleLock = () => {
        if (unlockedVault) {
            // Zeroize session keys
            zeroize(unlockedVault.sessionKeys.kek, unlockedVault.sessionKeys.mak);
            setUnlockedVault(null);
        }

        // Return to unlock screen if we have a file handle, otherwise home
        if (existingFileHandle) {
            setRoute('/unlock');
        } else {
            setRoute('/');
        }
    };

    // Handle Forget Vault
    const handleForgetVault = async () => {
        await clearAllStorage();
        setExistingFileHandle(null);
        setUnlockedVault(null);
        setRoute('/');
    };

    // Loading state
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                color: '#666',
            }}>
                Initializing...
            </div>
        );
    }

    // Route rendering
    switch (route) {
        case '/':
            return (
                <Home
                    onCreateVault={() => setRoute('/create')}
                    onOpenVault={() => setRoute('/open')}
                    cryptoReady={cryptoReady}
                />
            );

        case '/create':
            return (
                <CreateVault
                    onBack={() => setRoute('/')}
                    onCreate={handleCreateVault}
                />
            );

        case '/open':
            return (
                <OpenVault
                    onBack={() => setRoute('/')}
                    onUnlock={handleOpenVault}
                />
            );

        case '/unlock':
            return (
                <UnlockVault
                    vaultName={existingFileHandle?.name || 'vault.bin'}
                    onUnlock={handleUnlockExistingVault}
                    onForget={handleForgetVault}
                />
            );

        case '/vault':
            if (!unlockedVault) {
                setRoute('/');
                return null;
            }
            return (
                <VaultView
                    vault={unlockedVault}
                    onLock={handleLock}
                />
            );

        default:
            return <Home onCreateVault={() => setRoute('/create')} onOpenVault={() => setRoute('/open')} cryptoReady={cryptoReady} />;
    }
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
}

