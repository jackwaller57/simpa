import React, { useState, useEffect, useRef } from 'react';
import { AudioManager } from '../audio/AudioManager';
import { AircraftZones, AudioState } from '../types';
import './AudioControlPanel.css';

interface AudioControlPanelProps {
  audioManager: AudioManager;
  currentZone: string;
  position: number;
  thresholds: AircraftZones;
}

export const AudioControlPanel: React.FC<AudioControlPanelProps> = ({
  audioManager,
  currentZone,
  position,
  thresholds
}) => {
  // Check if thresholds are valid (non-zero) and set defaults if needed
  const validatedThresholds = React.useMemo(() => {
    const isValid = Object.values(thresholds).some(zone => 
      zone.start !== 0 || zone.end !== 0
    );
    
    if (isValid) {
      console.log('Using provided thresholds:', thresholds);
      return thresholds;
    } else {
      // Use default thresholds if all values are zero
      console.log('Using default thresholds instead of:', thresholds);
      return {
        outside: { start: 0.0, end: -1.6 },
        jetway: { start: -1.6, end: -12.0 },
        cabin: { start: -12.0, end: -22.4 },
        cockpit: { start: -22.4, end: -24.3 }
      };
    }
  }, [thresholds]);

  const [masterVolume, setMasterVolume] = useState(1.0);
  const [debugMode, setDebugMode] = useState(false);
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const [zoneVolumes, setZoneVolumes] = useState({
    outside: 0.45,
    jetway: 0.8,
    cabin: 0.7,
    cockpit: 0.65
  });
  const [fadeDuration, setFadeDuration] = useState(1.5);
  const [show3DVisualizer, setShow3DVisualizer] = useState(false);
  const [showWaveform, setShowWaveform] = useState(false);
  const [audioEffects, setAudioEffects] = useState({
    reverb: false,
    delay: false,
    compression: false
  });
  const [testTone, setTestTone] = useState(false);
  const [testToneFrequency, setTestToneFrequency] = useState(440);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Update audio state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioState(audioManager.getAudioState());
    }, 1000);
    return () => clearInterval(interval);
  }, [audioManager]);

  // Update zone volumes when position changes
  useEffect(() => {
    try {
      // Validate inputs before updating zone volumes
      if (!currentZone || typeof position !== 'number' || !isFinite(position) || !validatedThresholds) {
        console.warn('Invalid inputs for updating zone volumes:', { currentZone, position, validatedThresholds });
        return;
      }
      
      // Check if the thresholds object has the required zone
      const zoneThreshold = validatedThresholds[currentZone as keyof typeof validatedThresholds];
      if (!zoneThreshold) {
        console.warn(`Missing threshold configuration for zone: ${currentZone}`);
        return;
      }
      
      // Validate the threshold start and end values
      if (typeof zoneThreshold.start !== 'number' || 
          typeof zoneThreshold.end !== 'number' || 
          !isFinite(zoneThreshold.start) || 
          !isFinite(zoneThreshold.end)) {
        console.warn(`Invalid threshold values for zone ${currentZone}:`, zoneThreshold);
        return;
      }
      
      // Now it's safe to update the zone volumes
      audioManager.updateZoneVolumes(currentZone, position, validatedThresholds);
    } catch (error) {
      console.error('Error updating audio zone volumes:', error);
    }
  }, [currentZone, position, validatedThresholds, audioManager]);

  // Audio waveform visualization
  useEffect(() => {
    if (showWaveform && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        // Use the AudioManager's createAnalyzer method
        analyserRef.current = audioManager.createAnalyzer();
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        console.log('Audio analyzer set up with buffer length:', bufferLength);

        // Animation frame for waveform
        const draw = () => {
          if (!analyserRef.current || !ctx) return;

          animationFrameRef.current = requestAnimationFrame(draw);
          analyserRef.current.getByteTimeDomainData(dataArray);

          // Clear the canvas
          ctx.fillStyle = 'rgb(240, 240, 240)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the waveform
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgb(74, 158, 255)';
          ctx.beginPath();

          const sliceWidth = canvas.width * 1.0 / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        };

        draw();
      } catch (error) {
        console.error('Error setting up audio analyzer:', error);
      }
    }

    return () => {
      // Clean up
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (error) {
          console.warn('Error disconnecting analyzer:', error);
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showWaveform, audioManager]);

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setMasterVolume(volume);
    audioManager.setMasterVolume(volume);
  };

  const handleZoneVolumeChange = (zone: string, value: number) => {
    setZoneVolumes(prev => ({
      ...prev,
      [zone]: value
    }));
    // Update zone volume in audio manager
    const gainNode = audioManager.getGainNode(zone);
    if (gainNode) {
      gainNode.gain.setValueAtTime(value, audioManager.getAudioContext().currentTime);
    }
  };

  const handleFadeDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value);
    setFadeDuration(duration);
    audioManager.setFadeDuration(duration);
  };

  const handleDebugModeToggle = () => {
    const newDebugMode = !debugMode;
    setDebugMode(newDebugMode);
    audioManager.setDebugMode(newDebugMode);
  };

  const handle3DVisualizerToggle = () => {
    setShow3DVisualizer(!show3DVisualizer);
  };

  const handleEffectToggle = (effect: 'reverb' | 'delay' | 'compression') => {
    audioManager.toggleEffect(effect);
    setAudioEffects(prev => {
      const updatedEffects = { ...prev };
      updatedEffects[effect] = !updatedEffects[effect];
      return updatedEffects;
    });
  };

  const getZoneColor = (zone: string) => {
    const colors = {
      outside: '#ff6b6b',
      jetway: '#4ecdc4',
      cabin: '#45b7d1',
      cockpit: '#96ceb4'
    };
    return colors[zone as keyof typeof colors] || '#4a9eff';
  };

  const getZonePosition = (zone: string) => {
    try {
      const config = validatedThresholds[zone as keyof typeof validatedThresholds];
      
      // Safety checks
      if (!config || typeof config.start !== 'number' || typeof config.end !== 'number' ||
          !isFinite(config.start) || !isFinite(config.end)) {
        console.warn(`Invalid config for zone: ${zone}`);
        return 50; // Return middle position as fallback
      }
      
      // Map negative positions to 0-100% range
      // Find the min/max values across all thresholds
      const allThresholds = Object.values(validatedThresholds);
      const minVal = Math.min(...allThresholds.map(t => Math.min(t.start, t.end)));
      const maxVal = Math.max(...allThresholds.map(t => Math.max(t.start, t.end)));
      const range = Math.abs(maxVal - minVal);
      
      // Calculate the middle position of this zone
      const zoneMiddle = (config.start + config.end) / 2;
      
      // Map to 0-100% range (reversed since negative values are "inside" the aircraft)
      const normalizedPos = 100 - ((zoneMiddle - minVal) / range * 100);
      
      console.log(`Zone ${zone} position calculation:`, {
        zoneMiddle,
        minVal, 
        maxVal,
        range,
        normalizedPos
      });
      
      return normalizedPos;
    } catch (error) {
      console.error(`Error calculating position for zone ${zone}:`, error);
      return 50; // Return middle position as fallback
    }
  };

  const getZoneWidth = (zone: string) => {
    try {
      const config = validatedThresholds[zone as keyof typeof validatedThresholds];
      
      // Safety checks
      if (!config || typeof config.start !== 'number' || typeof config.end !== 'number' ||
          !isFinite(config.start) || !isFinite(config.end)) {
        console.warn(`Invalid config for zone width: ${zone}`);
        return 10; // Return a default width as fallback
      }
      
      // Find the min/max values across all thresholds for consistent width calculation
      const allThresholds = Object.values(validatedThresholds);
      const minVal = Math.min(...allThresholds.map(t => Math.min(t.start, t.end)));
      const maxVal = Math.max(...allThresholds.map(t => Math.max(t.start, t.end)));
      const totalRange = Math.abs(maxVal - minVal);
      
      // Calculate the zone width in the same units as the thresholds
      const zoneWidth = Math.abs(config.end - config.start);
      
      // Convert to percentage of total range
      const widthPercent = (zoneWidth / totalRange) * 100;
      
      console.log(`Zone ${zone} width calculation:`, {
        zoneWidth,
        totalRange,
        widthPercent
      });
      
      // Ensure a minimum width for visibility
      return Math.max(widthPercent, 5);
    } catch (error) {
      console.error(`Error calculating width for zone ${zone}:`, error);
      return 10; // Return a default width as fallback
    }
  };

  // Toggle test tone (for visualizer testing)
  const toggleTestTone = () => {
    const audioContext = audioManager.getAudioContext();
    
    if (!testTone) {
      try {
        // Create an oscillator and gain node for volume control
        oscillatorRef.current = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Set oscillator properties
        oscillatorRef.current.type = 'sine';
        oscillatorRef.current.frequency.setValueAtTime(testToneFrequency, audioContext.currentTime);
        
        // Set gain to a low volume
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        
        // Connect the nodes
        oscillatorRef.current.connect(gainNode);
        
        // Get the master gain node from audio manager
        const masterGain = audioManager.getGainNode('master');
        if (masterGain) {
          gainNode.connect(masterGain);
        } else {
          gainNode.connect(audioContext.destination);
        }
        
        // Start the oscillator
        oscillatorRef.current.start();
        console.log(`Test tone started at ${testToneFrequency}Hz`);
        
        setTestTone(true);
      } catch (error) {
        console.error('Error starting test tone:', error);
      }
    } else {
      try {
        // Stop the oscillator
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
          console.log('Test tone stopped');
        }
      } catch (error) {
        console.error('Error stopping test tone:', error);
      }
      
      setTestTone(false);
    }
  };

  // Handle frequency change
  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frequency = parseInt(e.target.value, 10);
    setTestToneFrequency(frequency);
    
    // Update existing oscillator if it's running
    if (testTone && oscillatorRef.current) {
      const audioContext = audioManager.getAudioContext();
      oscillatorRef.current.frequency.setValueAtTime(frequency, audioContext.currentTime);
    }
  };

  // Add a function to normalize the current position
  const normalizePosition = (position: number) => {
    try {
      // Find the min/max values across all thresholds
      const allThresholds = Object.values(validatedThresholds);
      const minVal = Math.min(...allThresholds.map(t => Math.min(t.start, t.end)));
      const maxVal = Math.max(...allThresholds.map(t => Math.max(t.start, t.end)));
      const range = Math.abs(maxVal - minVal);
      
      // Calculate the normalized position (0-100%)
      const normalizedPos = 100 - ((position - minVal) / range * 100);
      
      console.log('Normalizing current position:', {
        position,
        minVal,
        maxVal,
        range,
        normalizedPos
      });
      
      return normalizedPos;
    } catch (error) {
      console.error('Error normalizing position:', error);
      return 50; // Return middle position as fallback
    }
  };

  return (
    <div className="audio-control-panel">
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
        {Object.entries(zoneVolumes).map(([zone, volume]) => (
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

      <div className="control-group">
        <label>Debug Mode</label>
        <input
          type="checkbox"
          checked={debugMode}
          onChange={handleDebugModeToggle}
        />
      </div>

      <div className="control-group">
        <label>3D Visualizer</label>
        <input
          type="checkbox"
          checked={show3DVisualizer}
          onChange={handle3DVisualizerToggle}
        />
      </div>

      <div className="control-group">
        <label>Audio Effects</label>
        <div className="effect-toggles">
          <button
            className={`effect-toggle ${audioEffects.reverb ? 'active' : ''}`}
            onClick={() => handleEffectToggle('reverb')}
          >
            Reverb
          </button>
          <button
            className={`effect-toggle ${audioEffects.delay ? 'active' : ''}`}
            onClick={() => handleEffectToggle('delay')}
          >
            Delay
          </button>
          <button
            className={`effect-toggle ${audioEffects.compression ? 'active' : ''}`}
            onClick={() => handleEffectToggle('compression')}
          >
            Compression
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>Waveform Display</label>
        <button
          className={`waveform-toggle ${showWaveform ? 'active' : ''}`}
          onClick={() => setShowWaveform(!showWaveform)}
        >
          {showWaveform ? 'Hide Waveform' : 'Show Waveform'}
        </button>
      </div>

      {showWaveform && (
        <div className="waveform-container">
          <canvas ref={canvasRef} width={400} height={100} />
          
          <div className="test-tone-controls">
            <h4>Test Tone</h4>
            <button
              className={`test-tone-toggle ${testTone ? 'active' : ''}`}
              onClick={toggleTestTone}
            >
              {testTone ? 'Stop Tone' : 'Play Tone'}
            </button>
            
            <div className="frequency-control">
              <label>Frequency: {testToneFrequency} Hz</label>
              <input
                type="range"
                min="50"
                max="2000"
                step="10"
                value={testToneFrequency}
                onChange={handleFrequencyChange}
                disabled={!testTone}
              />
            </div>
          </div>
        </div>
      )}

      {debugMode && audioState && (
        <div className="debug-info">
          <h4>Debug Information</h4>
          <div className="debug-section">
            <h5>Current State</h5>
            <p>Current Zone: {audioState.currentZone}</p>
            <p>Master Volume: {Math.round(audioState.masterVolume * 100)}%</p>
            <p>Fade Duration: {fadeDuration}s</p>
          </div>

          <div className="debug-section">
            <h5>Zone Volumes</h5>
            {Object.entries(audioState.zoneVolumes || {}).map(([zone, volume]) => (
              <p key={zone}>
                {zone}: {Math.round(Number(volume) * 100)}%
              </p>
            ))}
          </div>

          <div className="debug-section">
            <h5>Position Data</h5>
            <p>Current Position: {position.toFixed(2)}</p>
            <p>Zone Thresholds:</p>
            <pre>{JSON.stringify(validatedThresholds, null, 2)}</pre>
          </div>
        </div>
      )}

      {show3DVisualizer && (
        <div className="visualizer">
          <h4>3D Audio Visualizer</h4>
          
          {/* Debug info for thresholds */}
          <div className="debug-section" style={{ marginBottom: '10px', fontSize: '12px', background: '#333', padding: '8px', borderRadius: '4px' }}>
            <strong>Zone Thresholds:</strong>
            <ul style={{ margin: '5px 0', padding: '0 0 0 20px' }}>
              {Object.entries(validatedThresholds).map(([zone, config]) => (
                <li key={zone}>{zone}: start={config.start.toFixed(3)}, end={config.end.toFixed(3)}, width={Math.abs(config.end - config.start).toFixed(3)} ({getZoneWidth(zone).toFixed(1)}%)</li>
              ))}
            </ul>
            <strong>Current Position:</strong> {position.toFixed(3)} in zone: {currentZone}
          </div>
          
          <div className="visualizer-container">
            {/* Zone markers */}
            {Object.keys(validatedThresholds).map((zone) => {
              return (
                <div
                  key={zone}
                  className="zone-marker"
                  style={{
                    left: `${getZonePosition(zone)}%`,
                    width: `${getZoneWidth(zone)}%`,
                    backgroundColor: getZoneColor(zone),
                    opacity: 0.7
                  }}
                >
                  <div className="zone-label">{zone}</div>
                </div>
              );
            })}
            
            {/* Current position marker */}
            <div
              className="position-marker"
              style={{ left: `${normalizePosition(position)}%` }}
            >
              <div className="position-label">{currentZone}</div>
            </div>

            {/* Volume indicators */}
            <div className="volume-indicators">
              {Object.entries(audioState?.zoneVolumes || {}).map(([zone, vol]) => {
                // Ensure volume is a valid number
                const volume = typeof vol === 'number' && isFinite(vol) ? vol : 0;
                // Only render if the zone exists in our thresholds
                if (!validatedThresholds[zone as keyof typeof validatedThresholds]) {
                  return null;
                }
                
                return (
                  <div
                    key={zone}
                    className="volume-indicator"
                    style={{
                      left: `${getZonePosition(zone)}%`,
                      height: `${volume * 100}%`,
                      backgroundColor: getZoneColor(zone)
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 