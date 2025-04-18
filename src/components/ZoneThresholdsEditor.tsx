import React, { useState, useEffect } from 'react';
import './ZoneThresholdsEditor.css';

interface ZoneThreshold {
  start: number;
  end: number;
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

interface ZoneThresholdsEditorProps {
  aircraftType: string;
  defaultConfig: AircraftConfig;
  onConfigChange: (aircraftType: string, newConfig: AircraftConfig) => void;
  currentZone?: string;
  zoneVolumes?: {
    outside: number;
    jetway: number;
    cabin: number;
    cockpit: number;
  };
}

const ZoneThresholdsEditor: React.FC<ZoneThresholdsEditorProps> = ({
  aircraftType,
  defaultConfig,
  onConfigChange,
  currentZone = '', 
  zoneVolumes = { outside: 35, jetway: 65, cabin: 85, cockpit: 100 }
}) => {
  // Local state for editing
  const [config, setConfig] = useState<AircraftConfig>(defaultConfig);
  // Temporary state for tracking unsaved changes
  const [tempConfig, setTempConfig] = useState<AircraftConfig>(defaultConfig);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCustomized, setIsCustomized] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Reset configuration when aircraft type changes
  useEffect(() => {
    setConfig(defaultConfig);
    setTempConfig(defaultConfig);
    // Check if current config is different from default
    checkIfCustomized(defaultConfig);
    setHasUnsavedChanges(false);
    setSaveMessage('');
  }, [aircraftType, defaultConfig]);
  
  // Check if current config is different from default
  const checkIfCustomized = (defaultCfg: AircraftConfig) => {
    const savedConfig = localStorage.getItem('customAircraftConfigs');
    if (savedConfig) {
      const customConfigs = JSON.parse(savedConfig);
      if (customConfigs[aircraftType]) {
        // Deep comparison of zone values
        const custom = customConfigs[aircraftType].zones;
        const defaults = defaultCfg.zones;
        
        setIsCustomized(
          custom.outside.start !== defaults.outside.start ||
          custom.outside.end !== defaults.outside.end ||
          custom.jetway.start !== defaults.jetway.start ||
          custom.jetway.end !== defaults.jetway.end ||
          custom.cabin.start !== defaults.cabin.start ||
          custom.cabin.end !== defaults.cabin.end ||
          custom.cockpit.start !== defaults.cockpit.start ||
          custom.cockpit.end !== defaults.cockpit.end
        );
      } else {
        setIsCustomized(false);
      }
    } else {
      setIsCustomized(false);
    }
  };

  const handleThresholdChange = (zone: keyof AircraftZones, property: 'start' | 'end', value: string) => {
    const numValue = parseFloat(value);
    
    if (!isNaN(numValue)) {
      const newTempConfig = {
        ...tempConfig,
        zones: {
          ...tempConfig.zones,
          [zone]: { 
            ...tempConfig.zones[zone],
            [property]: numValue 
          }
        }
      };
      
      setTempConfig(newTempConfig);
      setHasUnsavedChanges(true);
      
      // Check if the new config is custom (different from default)
      const isCustom = 
        tempConfig.zones.outside.start !== defaultConfig.zones.outside.start ||
        tempConfig.zones.outside.end !== defaultConfig.zones.outside.end ||
        tempConfig.zones.jetway.start !== defaultConfig.zones.jetway.start ||
        tempConfig.zones.jetway.end !== defaultConfig.zones.jetway.end ||
        tempConfig.zones.cabin.start !== defaultConfig.zones.cabin.start ||
        tempConfig.zones.cabin.end !== defaultConfig.zones.cabin.end ||
        tempConfig.zones.cockpit.start !== defaultConfig.zones.cockpit.start ||
        tempConfig.zones.cockpit.end !== defaultConfig.zones.cockpit.end;
      
      setIsCustomized(isCustom);
    }
  };

  const saveChanges = () => {
    // Update the actual config
    setConfig(tempConfig);
    // Save changes to parent component
    onConfigChange(aircraftType, tempConfig);
    // Clear unsaved changes flag
    setHasUnsavedChanges(false);
    // Show save message
    setSaveMessage('Zone thresholds saved successfully!');
    // Clear message after 3 seconds
    setTimeout(() => {
      setSaveMessage('');
    }, 3000);
  };

  const cancelChanges = () => {
    // Revert temp config to current config
    setTempConfig(config);
    setHasUnsavedChanges(false);
    setSaveMessage('');
  };

  const resetToDefaults = () => {
    // Set both configs to default
    setConfig(defaultConfig);
    setTempConfig(defaultConfig);
    // Save changes to parent component
    onConfigChange(aircraftType, defaultConfig);
    // Reset flags
    setIsCustomized(false);
    setHasUnsavedChanges(false);
    // Show confirmation message
    setSaveMessage('Reset to default thresholds');
    // Clear message after 3 seconds
    setTimeout(() => {
      setSaveMessage('');
    }, 3000);
  };

  // Helper function to display volume indicator
  const renderVolumeIndicator = (zone: keyof AircraftZones) => {
    const isActiveZone = currentZone === zone;
    
    return (
      <div className={`volume-indicator ${isActiveZone ? 'active' : ''}`}>
        <div className="volume-bar">
          <div 
            className="volume-level" 
            style={{ width: `${zoneVolumes[zone]}%` }}
          ></div>
        </div>
        <span className="volume-text">{zoneVolumes[zone]}%</span>
      </div>
    );
  };

  return (
    <div className="zone-thresholds-editor">
      <div 
        className="editor-header" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>
          Zone Thresholds
          {isCustomized && <span className="custom-indicator">Custom</span>}
        </h3>
        <span className={`dropdown-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>
      
      {isExpanded && (
        <div className="editor-content">
          <p className="editor-description">
            Customize zone ranges for {aircraftType}. These values determine when audio and other 
            effects are triggered based on camera position.
          </p>
          
          <div className="thresholds-form">
            <div className="threshold-row">
              <div className="threshold-info">
                <label className={currentZone === 'outside' ? 'active-zone' : ''}>
                  Outside Zone:
                </label>
                {renderVolumeIndicator('outside')}
              </div>
              <div className="inputs-container">
                <div className="threshold-input">
                  <label className="small-label">Start:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempConfig.zones.outside.start}
                    onChange={(e) => handleThresholdChange('outside', 'start', e.target.value)}
                  />
                </div>
                <div className="threshold-input">
                  <label className="small-label">End:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempConfig.zones.outside.end}
                    onChange={(e) => handleThresholdChange('outside', 'end', e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="threshold-row">
              <div className="threshold-info">
                <label className={currentZone === 'jetway' ? 'active-zone' : ''}>
                  Jetway Zone:
                </label>
                {renderVolumeIndicator('jetway')}
              </div>
              <div className="inputs-container">
                <div className="threshold-input">
                  <label className="small-label">Start:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.jetway.start}
                    onChange={(e) => handleThresholdChange('jetway', 'start', e.target.value)}
                  />
                </div>
                <div className="threshold-input">
                  <label className="small-label">End:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.jetway.end}
                    onChange={(e) => handleThresholdChange('jetway', 'end', e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="threshold-row">
              <div className="threshold-info">
                <label className={currentZone === 'cabin' ? 'active-zone' : ''}>
                  Cabin Zone:
                </label>
                {renderVolumeIndicator('cabin')}
              </div>
              <div className="inputs-container">
                <div className="threshold-input">
                  <label className="small-label">Start:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.cabin.start}
                    onChange={(e) => handleThresholdChange('cabin', 'start', e.target.value)}
                  />
                </div>
                <div className="threshold-input">
                  <label className="small-label">End:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.cabin.end}
                    onChange={(e) => handleThresholdChange('cabin', 'end', e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="threshold-row">
              <div className="threshold-info">
                <label className={currentZone === 'cockpit' ? 'active-zone' : ''}>
                  Cockpit Zone:
                </label>
                {renderVolumeIndicator('cockpit')}
              </div>
              <div className="inputs-container">
                <div className="threshold-input">
                  <label className="small-label">Start:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.cockpit.start}
                    onChange={(e) => handleThresholdChange('cockpit', 'start', e.target.value)}
                  />
                </div>
                <div className="threshold-input">
                  <label className="small-label">End:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tempConfig.zones.cockpit.end}
                    onChange={(e) => handleThresholdChange('cockpit', 'end', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {saveMessage && (
            <div className="save-message">{saveMessage}</div>
          )}
          
          <div className="threshold-actions">
            {hasUnsavedChanges && (
              <>
                <button
                  className="cancel-button"
                  onClick={cancelChanges}
                >
                  Cancel
                </button>
                <button
                  className="save-button"
                  onClick={saveChanges}
                >
                  Save Changes
                </button>
              </>
            )}
            <button
              className="reset-button"
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneThresholdsEditor; 