import React, { useState } from 'react';
import { SimConnectControl } from '../components/SimConnectControl';
import { AudioManager } from '../components/AudioManager';
import { FlightDataDisplay } from '../components/FlightDataDisplay';
import { ChartBarSquareIcon, SpeakerWaveIcon, CheckIcon } from '@heroicons/react/24/outline';

interface MainPageProps {
    onDisconnect?: () => void;
}

export function MainPage({ onDisconnect }: MainPageProps) {
    const [isConnected, setIsConnected] = useState(false);

    const handleConnectionChange = (connected: boolean) => {
        setIsConnected(connected);
        if (!connected && onDisconnect) {
            onDisconnect();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 py-8 text-gray-100">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
                        Flight Simulator Control Panel
                    </h1>
                    <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                        Connect to Microsoft Flight Simulator to monitor flight data and receive audio alerts
                    </p>
                </div>

                <div className="space-y-8">
                    {/* SimConnect Control Card */}
                    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-gray-600">
                        <div className="px-6 py-5">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                SimConnect Status
                            </h2>
                            <SimConnectControl 
                                onConnectionChange={handleConnectionChange}
                            />
                        </div>
                    </div>

                    {/* Flight Data Display Section */}
                    {isConnected && (
                        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-gray-600">
                            <div className="px-6 py-5">
                                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                                    <ChartBarSquareIcon className="w-5 h-5 mr-2 text-blue-400" />
                                    Live Flight Data
                                </h2>
                                <FlightDataDisplay />
                            </div>
                        </div>
                    )}

                    {/* Audio Manager Section */}
                    {isConnected && (
                        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-gray-600">
                            <div className="px-6 py-5">
                                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                                    <SpeakerWaveIcon className="w-5 h-5 mr-2 text-blue-400" />
                                    Audio Alerts
                                </h2>
                                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                                    <p className="text-sm font-medium text-gray-300 mb-2">
                                        Active Audio Alerts:
                                    </p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center text-sm text-gray-300">
                                            <CheckIcon className="w-4 h-4 mr-2 text-green-400" />
                                            Beacon Light changes
                                        </li>
                                        <li className="flex items-center text-sm text-gray-300">
                                            <CheckIcon className="w-4 h-4 mr-2 text-green-400" />
                                            Seatbelt Sign changes
                                        </li>
                                    </ul>
                                </div>
                                <AudioManager />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-sm text-gray-400">
                    <p>Make sure Microsoft Flight Simulator is running before connecting</p>
                </div>
            </div>
        </div>
    );
} 