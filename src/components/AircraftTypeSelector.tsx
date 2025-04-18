import React, { useState, useEffect } from 'react';
import './AircraftTypeSelector.css';
import ZoneThresholdsEditor from './ZoneThresholdsEditor';

// Aircraft types supported by the application
const SUPPORTED_AIRCRAFT_TYPES = [
  // Airbus family
  { value: 'A319', label: 'Airbus A319' },
  { value: 'A320', label: 'Airbus A320' },
  { value: 'A321', label: 'Airbus A321' },
  
  // Airbus A350 family
  { value: 'A350', label: 'Airbus A350 (Generic)' },
  { value: 'A350-900', label: 'Airbus A350-900' },
  { value: 'A350-1000', label: 'Airbus A350-1000' },
  
  // Boeing 737 family
  { value: 'B737', label: 'Boeing 737 (Generic)' },
  { value: 'B737-700', label: 'Boeing 737-700' },
  { value: 'B737-800', label: 'Boeing 737-800' },
  { value: 'B737-900', label: 'Boeing 737-900' },
  
  // Boeing 787 family
  { value: 'B787', label: 'Boeing 787 (Generic)' },
  { value: 'B787-8', label: 'Boeing 787-8' },
  { value: 'B787-9', label: 'Boeing 787-9' },
  { value: 'B787-10', label: 'Boeing 787-10' },
  
  // Other aircraft types
  { value: 'CRJ', label: 'Bombardier CRJ Family' },
  { value: 'E-Jet', label: 'Embraer E-Jet Family' },
  { value: 'B747', label: 'Boeing 747 Family' },
  { value: 'Custom', label: 'Custom Aircraft' }
];

// Define zone threshold types for props
interface ZoneThreshold {
  threshold: number;
}

interface AircraftZones {
  outside: ZoneThreshold;
  jetway: ZoneThreshold;
  cabin: ZoneThreshold;
  cockpit: ZoneThreshold;
}

interface AircraftConfig {
  zones: AircraftZones;
}

type AircraftConfigs = {
  [key: string]: AircraftConfig;
};

interface AircraftTypeSelectorProps {
  currentAircraftType: string | undefined;
  detectedAircraftType: string | undefined;
  onAircraftTypeChange: (aircraftType: string) => void;
  detectionMode: string;
  onDetectionModeChange: (mode: string) => void;
  aircraftConfigs: AircraftConfigs;
  onZoneConfigChange: (aircraftType: string, newConfig: AircraftConfig) => void;
  currentZone?: string;
  zoneVolumes?: {
    outside: number;
    jetway: number;
    cabin: number;
    cockpit: number;
  };
}

const AircraftTypeSelector: React.FC<AircraftTypeSelectorProps> = ({
  currentAircraftType,
  detectedAircraftType,
  onAircraftTypeChange,
  detectionMode,
  onDetectionModeChange,
  aircraftConfigs,
  onZoneConfigChange,
  currentZone,
  zoneVolumes
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Find the best label for the current aircraft type
  const getDisplayLabel = () => {
    const matchedType = SUPPORTED_AIRCRAFT_TYPES.find(
      type => type.value === currentAircraftType
    );

    if (matchedType) {
      return matchedType.label;
    }

    // If no match but we have a current type, display it
    if (currentAircraftType) {
      return currentAircraftType;
    }

    return 'Select Aircraft Type';
  };

  // Handle detection mode toggle
  const toggleDetectionMode = () => {
    const newMode = detectionMode === 'auto' ? 'manual' : 'auto';
    onDetectionModeChange(newMode);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target && !target.closest('.aircraft-type-selector')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="aircraft-type-selector">
      <div className="selector-header">
        <h3>Aircraft Type</h3>
        <div className="detection-mode">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={detectionMode === 'auto'}
              onChange={toggleDetectionMode}
            />
            <span className="toggle-slider"></span>
          </label>
          <span>Auto Detect</span>
        </div>
      </div>

      <div className="selector-content">
        {detectedAircraftType && (
          <div className="detected-type">
            <span>Detected: {detectedAircraftType}</span>
          </div>
        )}

        <div className="dropdown-container">
          <button
            className="dropdown-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {getDisplayLabel()}
            <span className="dropdown-arrow">▼</span>
          </button>

          {dropdownOpen && (
            <div className="dropdown-menu">
              {SUPPORTED_AIRCRAFT_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`dropdown-item ${
                    currentAircraftType === type.value ? 'selected' : ''
                  }`}
                  onClick={() => {
                    onAircraftTypeChange(type.value);
                    setDropdownOpen(false);
                  }}
                >
                  {type.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add the ZoneThresholdsEditor component */}
      {currentAircraftType && aircraftConfigs[currentAircraftType] && (
        <ZoneThresholdsEditor
          aircraftType={currentAircraftType}
          defaultConfig={aircraftConfigs[currentAircraftType]}
          onConfigChange={onZoneConfigChange}
          currentZone={currentZone}
          zoneVolumes={zoneVolumes}
        />
      )}
    </div>
  );
};

export default AircraftTypeSelector; 