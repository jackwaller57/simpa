import React from 'react';

interface FlightStatusPanelProps {
  flightState: {
    xPosition: number;
    yPosition: number;
    zPosition: number;
    speed: number;
    heading: number;
    altitude?: number;
    cameraViewType: string;
    beaconLight: boolean;
    seatbeltSign: boolean;
    jetwayMoving: boolean;
    jetwayState: number;
  };
  currentVolume: number;
  masterVolume: number;
  currentZone: string;
  isPlaying: boolean;
  currentAudioName: string;
  currentAudioVolume: number;
  cockpitDoorOpen: boolean;
  cameraPosition: string;
  landingLights: boolean;
  landingLightsOffCount: number;
  hasDescendedThrough10k: boolean;
  gsxBypassPin: boolean;
  seatbeltSignCount: number;
  touchdownData: {
    normalVelocity: number;
    bankDegrees: number;
    pitchDegrees: number;
    headingDegrees: number;
    lateralVelocity: number;
    longitudinalVelocity: number;
  } | null;
  onVolumeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetSeatbeltCount?: () => void;
}

const FlightStatusPanel: React.FC<FlightStatusPanelProps> = ({
  flightState,
  currentVolume,
  masterVolume,
  currentZone,
  isPlaying,
  currentAudioName,
  currentAudioVolume,
  cockpitDoorOpen,
  cameraPosition,
  landingLights,
  landingLightsOffCount,
  hasDescendedThrough10k,
  gsxBypassPin,
  seatbeltSignCount,
  touchdownData,
  onVolumeChange,
  onResetSeatbeltCount
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      {/* Flight Status Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex items-center">
          <span className="w-32 text-gray-400">View Type:</span>
          <span className="text-blue-400">{flightState.cameraViewType}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Volume Level:</span>
          <span className="text-blue-400">{Math.round(currentVolume)}%</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Master Volume:</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={onVolumeChange}
              className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-blue-400">{masterVolume}%</span>
          </div>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Cockpit Door:</span>
          <span className={`${cockpitDoorOpen ? 'text-green-400' : 'text-red-400'}`}>
            {cockpitDoorOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Camera Position:</span>
          <span className="text-blue-400">{cameraPosition}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Position X:</span>
          <span className="text-blue-400">{flightState.xPosition.toFixed(2)}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Position Y:</span>
          <span className="text-blue-400">{flightState.yPosition.toFixed(2)}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Position Z:</span>
          <span className="text-blue-400">{flightState.zPosition.toFixed(2)}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Altitude:</span>
          <span className="text-blue-400">{flightState.altitude?.toFixed(0) ?? 'N/A'} ft</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Current Zone:</span>
          <span className="text-blue-400">{currentZone}</span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Audio Status:</span>
          <span className="text-blue-400">
            {isPlaying ? `Playing: ${currentAudioName}` : 'No audio playing'}
          </span>
        </div>
        <div className="flex items-center">
          <span className="w-32 text-gray-400">Audio Volume:</span>
          <span className="text-blue-400">{Math.round(currentAudioVolume)}%</span>
        </div>
      </div>

      {/* System Status Section */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Landing Lights:</span>
            <span className={landingLights ? 'text-green-400' : 'text-red-400'}>
              {landingLights ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Lights Off Count:</span>
            <span className="text-blue-400">{landingLightsOffCount}</span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Descended 10k:</span>
            <span className={hasDescendedThrough10k ? 'text-green-400' : 'text-red-400'}>
              {hasDescendedThrough10k ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">GSX Bypass Pin:</span>
            <span className={gsxBypassPin ? 'text-green-400' : 'text-red-400'}>
              {gsxBypassPin ? 'INSERTED' : 'REMOVED'}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Beacon Light:</span>
            <span className={flightState.beaconLight ? 'text-green-400' : 'text-red-400'}>
              {flightState.beaconLight ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Seatbelt Sign:</span>
            <span className={flightState.seatbeltSign ? 'text-green-400' : 'text-red-400'}>
              {flightState.seatbeltSign ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Seatbelt Count:</span>
            <span className="text-blue-400">{seatbeltSignCount}</span>
            {onResetSeatbeltCount && (
              <button 
                onClick={onResetSeatbeltCount}
                className="ml-2 bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 px-2 rounded"
                title="Reset seatbelt sign count"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center">
            <span className="w-32 text-gray-400">Jetway:</span>
            <span className={flightState.jetwayMoving ? 'text-yellow-400' :
                           flightState.jetwayState === 1 ? 'text-green-400' : 'text-red-400'}>
              {flightState.jetwayMoving ? 'MOVING' :
               flightState.jetwayState === 1 ? 'ATTACHED' : 'DETACHED'}
            </span>
          </div>
        </div>

        {touchdownData && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">Touchdown Data</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Vertical Speed:</span>
                <span className="text-blue-400">{touchdownData.normalVelocity.toFixed(1)} ft/s</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Bank Angle:</span>
                <span className="text-blue-400">{touchdownData.bankDegrees.toFixed(1)}°</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Pitch Angle:</span>
                <span className="text-blue-400">{touchdownData.pitchDegrees.toFixed(1)}°</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Heading:</span>
                <span className="text-blue-400">{touchdownData.headingDegrees.toFixed(1)}°</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Lateral Speed:</span>
                <span className="text-blue-400">{touchdownData.lateralVelocity.toFixed(1)} ft/s</span>
              </div>
              <div className="flex items-center">
                <span className="w-32 text-gray-400">Longitudinal Speed:</span>
                <span className="text-blue-400">{touchdownData.longitudinalVelocity.toFixed(1)} ft/s</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightStatusPanel; 