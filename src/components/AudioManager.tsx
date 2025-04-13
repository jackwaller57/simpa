import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

interface AudioManagerProps {
    beaconSoundUrl?: string;
}

export function AudioManager({ 
    beaconSoundUrl = '/sounds/announcements/Doors-to-Auto.wav'
}: AudioManagerProps) {
    const beaconAudioRef = useRef<HTMLAudioElement | null>(null);
    const lastBeaconState = useRef<boolean>(false);

    useEffect(() => {
        // Create audio element
        beaconAudioRef.current = new Audio(beaconSoundUrl);
        
        // Configure audio element
        if (beaconAudioRef.current) {
            beaconAudioRef.current.preload = 'auto';
        }

        // Listen for beacon light state changes
        const unlistenBeacon = listen('beacon-light-changed', (event: any) => {
            const { state } = event.payload;
            
            if (state && !lastBeaconState.current && beaconAudioRef.current) {
                beaconAudioRef.current.currentTime = 0;
                beaconAudioRef.current.play().catch(err => {
                    console.error('Failed to play beacon sound:', err);
                });
            }
            
            lastBeaconState.current = state;
        });

        // Cleanup
        return () => {
            unlistenBeacon.then(unsubscribe => unsubscribe());
            if (beaconAudioRef.current) {
                beaconAudioRef.current.pause();
                beaconAudioRef.current = null;
            }
        };
    }, [beaconSoundUrl]);

    // This component doesn't render anything visible
    return null;
} 