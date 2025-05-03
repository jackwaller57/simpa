import React, { useState, useEffect } from 'react';
import { EnhancedAudioProcessor } from '../audio/EnhancedAudioProcessor';
import './AudioControls.css';

interface AudioControlsProps {
  audioProcessor: EnhancedAudioProcessor;
}

// Define a type for the zone volumes
type ZoneVolumes = {
  outside: number;
  jetway: number;
  cabin: number;
  cockpit: number;
};

const AudioControls: React.FC<AudioControlsProps> = ({ audioProcessor }) => {
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [fadeDuration, setFadeDuration] = useState<number>(1.5);
  const [zoneVolumes, setZoneVolumes] = useState<ZoneVolumes>({
    outside: 0.45,
    jetway: 0.8,
    cabin: 0.7,
    cockpit: 0.65
  });
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // Initialize component state from audioProcessor
  useEffect(() => {
    // Get initial fade duration
    const initialFadeDuration = audioProcessor.getCrossfadeDuration();
    setFadeDuration(initialFadeDuration);
    
    // Initialize zone volumes
    const zones = ['outside', 'jetway', 'cabin', 'cockpit'] as const;
    const initialZoneVolumes = { ...zoneVolumes };
    
    zones.forEach(zone => {
      initialZoneVolumes[zone] = audioProcessor.getZoneVolume(zone);
    });
    
    setZoneVolumes(initialZoneVolumes);
  }, [audioProcessor]);

  // Set master volume
  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setMasterVolume(volume);
    audioProcessor.setMasterVolume(volume);
  };

  // Set fade duration
  const handleFadeDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value);
    setFadeDuration(duration);
    audioProcessor.setCrossfadeDuration(duration);
  };

  // Update zone volume
  const handleZoneVolumeChange = (zone: keyof ZoneVolumes, volume: number) => {
    setZoneVolumes(prev => ({
      ...prev,
      [zone]: volume
    }));
    
    audioProcessor.setZoneVolume(zone, volume);
  };

  // Toggle debug mode
  const handleDebugToggle = () => {
    const newDebugMode = !debugMode;
    setDebugMode(newDebugMode);
    audioProcessor.setDebugMode(newDebugMode);
  };

  return (
    <div className="audio-controls">
      <h3>Audio Controls</h3>
      
      <div className="control-group">
        <label>Master Volume</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={handleMasterVolumeChange}
        />
        <span>{Math.round(masterVolume * 100)}%</span>
      </div>
      
      <div className="control-group">
        <label>Fade Duration (s)</label>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          value={fadeDuration}
          onChange={handleFadeDurationChange}
        />
        <span>{fadeDuration.toFixed(1)}s</span>
      </div>
      
      <div className="zone-volumes">
        <h4>Zone Volumes</h4>
        {(Object.entries(zoneVolumes) as [keyof ZoneVolumes, number][]).map(([zone, volume]) => (
          <div key={zone} className="control-group">
            <label>{zone}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleZoneVolumeChange(zone, parseFloat(e.target.value))}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>
        ))}
      </div>
      
      <div className="control-group checkbox">
        <label>Debug Mode</label>
        <input
          type="checkbox"
          checked={debugMode}
          onChange={handleDebugToggle}
        />
      </div>
    </div>
  );
};

export default AudioControls; 