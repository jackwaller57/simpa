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
  const [audioContextStatus, setAudioContextStatus] = useState("Unknown");

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
      
      // Use enhanced spatial audio method with smooth transitions between zones
      audioManager.updateZoneVolumesSpatial(position, validatedThresholds, fadeDuration);
    } catch (error) {
      console.error('Error updating audio zone volumes:', error);
    }
  }, [currentZone, position, validatedThresholds, audioManager, fadeDuration]);

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

  // Sync component state with AudioManager on mount
  useEffect(() => {
    try {
      // Get current audio state from manager
      const currentAudioState = audioManager.getAudioState();
      
      // Update master volume from audio manager
      if (typeof currentAudioState.masterVolume === 'number' && 
          isFinite(currentAudioState.masterVolume)) {
        setMasterVolume(currentAudioState.masterVolume);
      }
      
      // Update zone volumes from audio manager if available
      if (currentAudioState.zoneVolumes) {
        const updatedZoneVolumes = { ...zoneVolumes };
        
        Object.entries(currentAudioState.zoneVolumes).forEach(([zone, volume]) => {
          if (typeof volume === 'number' && isFinite(volume) && 
              zone in updatedZoneVolumes) {
            // Type-safe assignment using index access
            updatedZoneVolumes[zone as keyof typeof updatedZoneVolumes] = volume;
          }
        });
        
        setZoneVolumes(updatedZoneVolumes);
      }
      
      // Update fade duration from audio manager
      const currentFadeDuration = audioManager.getFadeDuration();
      if (typeof currentFadeDuration === 'number' && isFinite(currentFadeDuration)) {
        setFadeDuration(currentFadeDuration);
      }
      
      console.log('Audio control panel synchronized with AudioManager state');
    } catch (error) {
      console.error('Error syncing with AudioManager state:', error);
    }
  }, [audioManager]);

  // Direct DOM event listener approach for sliders since React events might not be capturing correctly
  useEffect(() => {
    console.log("Adding direct DOM event listeners to sliders");
    
    // Get all slider elements
    const sliders = document.querySelectorAll('input[type="range"]');
    
    // Function to handle direct input changes
    const handleDirectInputChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const value = parseFloat(target.value);
      
      // Check which slider was changed based on className or id
      if (target.classList.contains('master-volume')) {
        console.log(`Direct master volume change: ${value}`);
        setMasterVolume(value);
        audioManager.setMasterVolume(value);
      } 
      else if (target.classList.contains('fade-duration')) {
        console.log(`Direct fade duration change: ${value}`);
        setFadeDuration(value);
        audioManager.setFadeDuration(value);
      }
      else {
        // Check for zone volume slider by searching for parent with data-zone
        const zoneGroup = target.closest('[data-zone]');
        if (zoneGroup) {
          const zone = zoneGroup.getAttribute('data-zone');
          if (zone) {
            console.log(`Direct zone volume change for ${zone}: ${value}`);
            // Update state
            setZoneVolumes(prev => ({
              ...prev,
              [zone]: value
            }));
            
            // Update audio directly
            const gainNode = audioManager.getGainNode(zone);
            if (gainNode) {
              const audioContext = audioManager.getAudioContext();
              gainNode.gain.setValueAtTime(value, audioContext.currentTime);
            }
          }
        }
      }
      
      // Apply spatial updates regardless of which slider changed
      setTimeout(() => {
        audioManager.updateZoneVolumesSpatial(position, validatedThresholds, fadeDuration);
      }, 10);
    };
    
    // Add event listeners to all sliders
    sliders.forEach(slider => {
      slider.addEventListener('input', handleDirectInputChange);
    });
    
    // Clean up event listeners on unmount
    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', handleDirectInputChange);
      });
    };
  }, [audioManager, fadeDuration, position, validatedThresholds]);

  const handleDebugModeToggle = () => {
    try {
      const newDebugMode = !debugMode;
      
      // Update local state
      setDebugMode(newDebugMode);
      
      // Update audio manager debug mode
      audioManager.setDebugMode(newDebugMode);
      
      // Immediately fetch updated audio state to reflect changes
      setAudioState(audioManager.getAudioState());
      
      console.log(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling debug mode:', error);
    }
  };

  const handle3DVisualizerToggle = () => {
    setShow3DVisualizer(!show3DVisualizer);
  };

  const handleEffectToggle = (effect: 'reverb' | 'delay' | 'compression') => {
    try {
      // Toggle the effect in the audio manager
      audioManager.toggleEffect(effect);
      
      // Update local state to reflect the change
      setAudioEffects(prev => {
        const updatedEffects = { ...prev };
        updatedEffects[effect] = !updatedEffects[effect];
        
        console.log(`Toggled ${effect} effect: ${updatedEffects[effect] ? 'ON' : 'OFF'}`);
        return updatedEffects;
      });
      
      // Apply spatial audio again to ensure effects are properly integrated
      if (audioManager.updateZoneVolumesSpatial) {
        audioManager.updateZoneVolumesSpatial(position, validatedThresholds, fadeDuration);
      }
    } catch (error) {
      console.error(`Error toggling ${effect} effect:`, error);
    }
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

  // Force update function that directly applies current state to audio system - more direct approach
  const forceVolumeUpdate = () => {
    try {
      console.log("Force updating all audio volumes and settings...");
      
      // Get audio context
      const audioContext = audioManager.getAudioContext();
      
      // Ensure audio context is running
      if (audioContext.state !== 'running') {
        console.log(`AudioContext state is ${audioContext.state}, attempting to resume...`);
        audioContext.resume().catch(err => {
          console.error("Failed to resume AudioContext:", err);
        });
      }
      
      // Apply master volume with direct node access
      const masterGain = audioManager.getGainNode('master');
      if (masterGain) {
        // Cancel any scheduled ramps
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        // Set value immediately
        masterGain.gain.setValueAtTime(masterVolume, audioContext.currentTime);
        console.log(`Applied master volume: ${masterVolume.toFixed(2)} directly to node`);
      }
      
      // Apply zone volumes with direct node access
      console.log("Directly applying zone volumes:");
      Object.entries(zoneVolumes).forEach(([zone, volume]) => {
        const gainNode = audioManager.getGainNode(zone);
        if (gainNode) {
          // Cancel any scheduled ramps
          gainNode.gain.cancelScheduledValues(audioContext.currentTime);
          // Set value immediately
          gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          console.log(`- ${zone}: ${volume.toFixed(2)}`);
        }
      });
      
      // Set fade duration in the audio manager
      audioManager.setFadeDuration(fadeDuration);
      console.log(`Set fade duration: ${fadeDuration.toFixed(1)}s`);
      
      // Apply spatial audio settings
      console.log("Applying spatial audio for current position:", position);
      audioManager.updateZoneVolumesSpatial(position, validatedThresholds, fadeDuration);
      
      console.log("All audio volumes and settings have been force updated");
    } catch (error) {
      console.error('Error force updating audio settings:', error);
    }
  };
  
  // Robust audio system initialization
  useEffect(() => {
    const initializeAudioSystem = async () => {
      try {
        console.log("AudioControlPanel: Initializing audio system...");
        
        // Check if AudioContext is suspended (common in browsers)
        const audioContext = audioManager.getAudioContext();
        if (audioContext.state === 'suspended') {
          console.log("AudioContext was suspended, attempting to resume...");
          await audioContext.resume();
        }
        
        // Make sure master gain is set
        const masterGain = audioManager.getGainNode('master');
        if (masterGain) {
          console.log(`Setting master gain to ${masterVolume}`);
          masterGain.gain.setValueAtTime(masterVolume, audioContext.currentTime);
        } else {
          console.warn("Master gain node not found");
        }
        
        // Set all zone volumes directly
        console.log("Setting initial zone volumes:");
        Object.entries(zoneVolumes).forEach(([zone, volume]) => {
          console.log(`- ${zone}: ${volume}`);
          const gainNode = audioManager.getGainNode(zone);
          if (gainNode) {
            gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
          } else {
            console.warn(`GainNode for zone "${zone}" not found`);
          }
        });
        
        // Apply spatial audio
        console.log("Applying spatial audio with position:", position);
        audioManager.updateZoneVolumesSpatial(position, validatedThresholds, fadeDuration);
        
        // Try to create a small test tone to ensure audio system is working
        try {
          const testOsc = audioContext.createOscillator();
          const testGain = audioContext.createGain();
          testGain.gain.value = 0.01; // Nearly silent
          testOsc.connect(testGain);
          testGain.connect(audioContext.destination);
          testOsc.start();
          setTimeout(() => {
            testOsc.stop();
            testOsc.disconnect();
            testGain.disconnect();
            console.log("Test tone completed - audio system should be initialized");
          }, 100);
        } catch (e) {
          console.warn("Could not create test tone:", e);
        }
        
        console.log("Audio system initialization complete");
      } catch (error) {
        console.error("Error initializing audio system:", error);
      }
    };

    // Run initialization after a short delay to ensure component is fully mounted
    const initTimer = setTimeout(() => {
      initializeAudioSystem();
    }, 1000);
    
    // Add user interaction listener to initialize audio (browser requirement)
    const handleUserInteraction = () => {
      console.log("User interaction detected, initializing audio...");
      initializeAudioSystem();
      // Remove listener after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    
    // Cleanup
    return () => {
      clearTimeout(initTimer);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset all volumes to default values
  const resetAllVolumes = () => {
    try {
      // Default values
      const defaultMasterVolume = 1.0;
      const defaultZoneVolumes = {
        outside: 0.45,
        jetway: 0.8,
        cabin: 0.7,
        cockpit: 0.65
      };
      const defaultFadeDuration = 1.5;
      
      // Update state
      setMasterVolume(defaultMasterVolume);
      setZoneVolumes(defaultZoneVolumes);
      setFadeDuration(defaultFadeDuration);
      
      // Apply to audio system
      audioManager.setMasterVolume(defaultMasterVolume);
      
      Object.entries(defaultZoneVolumes).forEach(([zone, volume]) => {
        const gainNode = audioManager.getGainNode(zone);
        if (gainNode) {
          const currentTime = audioManager.getAudioContext().currentTime;
          gainNode.gain.setValueAtTime(volume, currentTime);
        }
      });
      
      audioManager.setFadeDuration(defaultFadeDuration);
      
      // Apply spatial audio
      audioManager.updateZoneVolumesSpatial(position, validatedThresholds, defaultFadeDuration);
      
      console.log('All volumes reset to default values');
    } catch (error) {
      console.error('Error resetting volumes:', error);
    }
  };

  // Check audio context status periodically
  useEffect(() => {
    const checkStatus = () => {
      try {
        const audioContext = audioManager.getAudioContext();
        setAudioContextStatus(audioContext.state);
      } catch (e) {
        setAudioContextStatus("Error");
      }
    };
    
    // Initial check
    checkStatus();
    
    // Set up interval for periodic checking
    const statusInterval = setInterval(checkStatus, 2000);
    
    return () => clearInterval(statusInterval);
  }, [audioManager]);

  // Directly wake up the audio system on user interaction
  const wakeAudioSystem = async () => {
    try {
      console.log("Manual wake up of audio system initiated");
      
      // Get audio context
      const audioContext = audioManager.getAudioContext();
      
      // Resume audio context (important for browsers that suspend by default)
      if (audioContext.state !== 'running') {
        console.log(`Resuming AudioContext (current state: ${audioContext.state})`);
        await audioContext.resume();
        console.log(`AudioContext state after resume attempt: ${audioContext.state}`);
      }
      
      // Try to make a small sound to fully activate the audio system
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      // Set to a very quiet level
      gain.gain.value = 0.01;
      
      // Connect and play a short beep
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = 440;
      osc.start();
      
      // Stop after 100ms
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        console.log("Wake-up sound completed");
        
        // After wake-up, force update all volume settings
        forceVolumeUpdate();
        
        // Update status immediately
        setAudioContextStatus(audioContext.state);
      }, 100);
      
    } catch (error) {
      console.error("Error during manual audio system wake-up:", error);
    }
  };

  return (
    <div className="audio-control-panel">
      <h3>Audio Controls</h3>
      
      {/* Audio system status indicator */}
      <div className={`audio-status ${audioContextStatus.toLowerCase()}`}>
        <div>
          Audio System: <span className="status-text">{audioContextStatus}</span>
          {audioContextStatus !== "running" && (
            <button className="wake-button" onClick={wakeAudioSystem}>
              Wake Up
            </button>
          )}
        </div>
        <button 
          className="force-update-button" 
          onClick={forceVolumeUpdate}
          title="Apply all volume settings directly to the audio system"
        >
          Force Update Audio
        </button>
      </div>
      
      {/* Essential controls - Master volume, spatial audio toggle, zone visualization */}
      <div className="control-section">
        <h4>Main Controls</h4>
        <div className="control-group">
          <label>Master Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            className="master-volume"
            style={{ '--value': `${masterVolume * 100}%` } as React.CSSProperties}
          />
          <span>{Math.round(masterVolume * 100)}%</span>
        </div>

        <div className="control-group">
          <label>Fade Duration</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={fadeDuration}
            className="fade-duration"
            style={{ '--value': `${(fadeDuration / 3) * 100}%` } as React.CSSProperties}
          />
          <span>{fadeDuration.toFixed(1)}s</span>
        </div>
        
        <div className="reset-button-container">
          <button className="reset-button" onClick={resetAllVolumes}>
            Reset Default Volumes
          </button>
        </div>
        
        <div className="controls-row">
          <div className="toggle-control">
            <label>3D Visualizer</label>
            <input
              type="checkbox"
              checked={show3DVisualizer}
              onChange={handle3DVisualizerToggle}
            />
          </div>
          
          <div className="toggle-control">
            <label>Debug Mode</label>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={handleDebugModeToggle}
            />
          </div>
        </div>
      </div>

      {/* Optional section - Show only when needed */}
      {show3DVisualizer && (
        <div className="visualizer">
          <h4>3D Audio Visualizer</h4>
          
          <div className="visualizer-container">
            {/* Zone markers */}
            {Object.keys(validatedThresholds).map((zone) => (
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
            ))}
            
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
                const volume = typeof vol === 'number' && isFinite(vol) ? vol : 0;
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
          
          {/* Zone volume controls - only show when visualizer is active */}
          <div className="zone-volumes">
            <h4>Zone Volumes</h4>
            {Object.entries(zoneVolumes).map(([zone, volume]) => (
              <div key={zone} className="control-group" data-zone={zone}>
                <label>{zone}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  style={{ '--value': `${volume * 100}%` } as React.CSSProperties}
                />
                <span>{Math.round(volume * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug information - only show when debugging is enabled */}
      {debugMode && audioState && (
        <div className="debug-info">
          <h4>Debug Information</h4>
          <div className="debug-section">
            <h5>Current State</h5>
            <p>Current Zone: {audioState.currentZone}</p>
            <p>Position: {position.toFixed(2)}</p>
            <p>Master Volume: {Math.round(audioState.masterVolume * 100)}%</p>
            <p>Fade Duration: {fadeDuration}s</p>
            <p className="enhanced-audio-indicator">Enhanced Spatial Audio: <span className="active">Active</span></p>
          </div>

          <div className="debug-section">
            <h5>Advanced Options</h5>
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
            
            <div className="test-audio-controls">
              <button
                className={`waveform-toggle ${showWaveform ? 'active' : ''}`}
                onClick={() => setShowWaveform(!showWaveform)}
              >
                {showWaveform ? 'Hide Waveform' : 'Show Waveform'}
              </button>
              
              {showWaveform && (
                <div className="waveform-container">
                  <canvas ref={canvasRef} width={400} height={100} />
                  
                  <div className="test-tone-controls">
                    <h5>Test Tone</h5>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 