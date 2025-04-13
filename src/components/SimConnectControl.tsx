import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface SimConnectControlProps {
    onConnectionChange?: (connected: boolean) => void;
}

export function SimConnectControl({ onConnectionChange }: SimConnectControlProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check SimConnect status on mount and periodically
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await invoke<boolean>('check_simconnect_status');
                setIsConnected(status);
                onConnectionChange?.(status);
            } catch (err) {
                console.error('Failed to check SimConnect status:', err);
            }
        };

        // Check initial status
        checkStatus();

        // Set up periodic status check
        const intervalId = setInterval(checkStatus, 5000); // Check every 5 seconds

        return () => clearInterval(intervalId);
    }, [onConnectionChange]);

    useEffect(() => {
        // Listen for SimConnect connection events
        const unlistenOpen = listen('simconnect-open', () => {
            setIsConnected(true);
            setIsLoading(false);
            setError(null);
            onConnectionChange?.(true);
        });

        const unlistenQuit = listen('simconnect-quit', () => {
            setIsConnected(false);
            setIsLoading(false);
            onConnectionChange?.(false);
        });

        const unlistenError = listen('simconnect-error', (event: any) => {
            setError(event.payload.message);
            setIsLoading(false);
            setIsConnected(false);
            onConnectionChange?.(false);
        });

        return () => {
            unlistenOpen.then(fn => fn());
            unlistenQuit.then(fn => fn());
            unlistenError.then(fn => fn());
        };
    }, [onConnectionChange]);

    const handleConnect = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            if (isConnected) {
                await invoke('stop_simconnect_data_collection');
                setIsConnected(false);
                onConnectionChange?.(false);
            } else {
                await invoke('start_simconnect_data_collection');
                // Status will be updated by the event listeners
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to SimConnect');
            setIsConnected(false);
            onConnectionChange?.(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
                <div 
                    className={`w-3 h-3 rounded-full ${
                        isConnected ? 'bg-green-400' : 
                        isLoading ? 'bg-yellow-400' : 
                        'bg-red-400'
                    }`}
                />
                <span className="text-lg font-medium text-gray-100">
                    {isConnected ? 'Connected to SimConnect' : 
                     isLoading ? 'Connecting...' : 
                     'Disconnected'}
                </span>
            </div>
            
            <button
                onClick={handleConnect}
                disabled={isLoading}
                className={`px-6 py-2 rounded-md text-white font-medium transition-colors
                    ${isConnected 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    } 
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {isLoading ? 'Connecting...' : 
                 isConnected ? 'Disconnect' : 
                 'Connect to SimConnect'}
            </button>

            {error && (
                <div className="text-red-400 text-sm mt-2">
                    {error}
                </div>
            )}
        </div>
    );
} 