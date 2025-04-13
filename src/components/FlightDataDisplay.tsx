import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface FlightData {
    lat: number;
    lon: number;
    alt: number;
    asi: number;
    mach: number;
    ast: number;
    head: number;
    jetwayMoving: boolean;
    jetwayState: boolean;
}

interface BeaconState {
    state: boolean;
}

interface SeatbeltState {
    state: boolean;
}

export function FlightDataDisplay() {
    const [flightData, setFlightData] = useState<FlightData | null>(null);
    const [beaconLight, setBeaconLight] = useState(false);
    const [seatbeltSign, setSeatbeltSign] = useState(false);
    const [isJetwayAttached, setIsJetwayAttached] = useState(false);
    const [wasJetwayMoving, setWasJetwayMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Listen for flight data updates
        const unlistenFlightData = listen('simconnect-data', (event: any) => {
            try {
                const data = event.payload as FlightData;
                if (!data) {
                    setError('Received invalid flight data');
                    return;
                }
                setFlightData(data);
                setError(null);
                
                // Update jetway attachment state based on movement
                if (data.jetwayMoving) {
                    setIsJetwayAttached(false);
                    setWasJetwayMoving(true);
                } else if (wasJetwayMoving) {
                    setIsJetwayAttached(true);
                    setWasJetwayMoving(false);
                }
            } catch (err) {
                setError('Failed to process flight data');
                console.error('Error processing flight data:', err);
            }
        });

        // Listen for beacon light changes
        const unlistenBeacon = listen('beacon-light-changed', (event: any) => {
            try {
                const data = event.payload as BeaconState;
                setBeaconLight(data?.state ?? false);
            } catch (err) {
                console.error('Error processing beacon light change:', err);
            }
        });

        // Listen for seatbelt sign changes
        const unlistenSeatbelt = listen('seatbelt-switch-changed', (event: any) => {
            try {
                const data = event.payload as SeatbeltState;
                setSeatbeltSign(data?.state ?? false);
            } catch (err) {
                console.error('Error processing seatbelt sign change:', err);
            }
        });

        return () => {
            unlistenFlightData.then(fn => fn());
            unlistenBeacon.then(fn => fn());
            unlistenSeatbelt.then(fn => fn());
        };
    }, [wasJetwayMoving]);

    if (error) {
        return (
            <div className="bg-gray-800/50 rounded-lg p-6">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    if (!flightData) {
        return (
            <div className="bg-gray-800/50 rounded-lg p-6">
                <p className="text-gray-400 italic">Waiting for flight data...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Flight Data</h3>
            
            {/* Aircraft Position */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <h4 className="text-sm font-medium text-gray-400">Position</h4>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">Latitude:</span> {flightData?.lat?.toFixed(6) ?? 'N/A'}°
                        </p>
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">Longitude:</span> {flightData?.lon?.toFixed(6) ?? 'N/A'}°
                        </p>
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">Altitude:</span> {flightData?.alt?.toFixed(0) ?? 'N/A'} ft
                        </p>
                    </div>
                </div>

                {/* Aircraft Speed */}
                <div>
                    <h4 className="text-sm font-medium text-gray-400">Speed</h4>
                    <div className="space-y-1">
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">IAS:</span> {flightData?.asi?.toFixed(0) ?? 'N/A'} kts
                        </p>
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">Mach:</span> {flightData?.mach?.toFixed(3) ?? 'N/A'}
                        </p>
                        <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">TAS:</span> {flightData?.ast?.toFixed(0) ?? 'N/A'} kts
                        </p>
                    </div>
                </div>
            </div>

            {/* Aircraft Heading and Systems */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="text-sm font-medium text-gray-400">Direction</h4>
                    <p className="text-sm text-gray-300">
                        <span className="font-medium text-gray-200">Heading:</span> {flightData?.head?.toFixed(0) ?? 'N/A'}°
                    </p>
                </div>

                <div>
                    <h4 className="text-sm font-medium text-gray-400">Systems</h4>
                    <div className="space-y-1">
                        <p className="text-sm flex items-center gap-2 text-gray-300">
                            <span className="font-medium text-gray-200">Beacon Light:</span>
                            <span className={`inline-block w-2 h-2 rounded-full ${
                                beaconLight ? 'bg-green-400' : 'bg-red-400'
                            }`} />
                            {beaconLight ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-sm flex items-center gap-2 text-gray-300">
                            <span className="font-medium text-gray-200">Seatbelt Sign:</span>
                            <span className={`inline-block w-2 h-2 rounded-full ${
                                seatbeltSign ? 'bg-green-400' : 'bg-red-400'
                            }`} />
                            {seatbeltSign ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-sm flex items-center gap-2 text-gray-300">
                            <span className="font-medium text-gray-200">Jetway:</span>
                            <span className={`inline-block w-2 h-2 rounded-full ${
                                flightData?.jetwayMoving ? 'bg-yellow-400' :
                                flightData?.jetwayState ? 'bg-green-400' : 'bg-red-400'
                            }`} />
                            {flightData?.jetwayMoving ? 'MOVING' :
                             flightData?.jetwayState ? 'ATTACHED' : 'DETACHED'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Jetway Status */}
            <div className="mb-4">
                <h3 className="text-gray-400 font-semibold mb-2">Jetway Status</h3>
                <div className="flex items-center space-x-2">
                    <div className={`h-3 w-3 rounded-full ${
                        flightData?.jetwayMoving ? 'bg-yellow-400' :
                        flightData?.jetwayState ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className="text-gray-300">
                        {flightData?.jetwayMoving ? 'MOVING' :
                         flightData?.jetwayState ? 'ATTACHED' : 'DETACHED'}
                    </span>
                </div>
            </div>
        </div>
    );
} 