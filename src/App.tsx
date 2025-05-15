import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { MainPage } from './pages/MainPage';
import FlightStatusPanel from './components/FlightStatusPanel';
import CameraPosition from './components/CameraPosition';
import ViewDisplay from './components/ViewDisplay';
import AircraftTypeSelector from './components/AircraftTypeSelector';
import ConnectionControl from './components/ConnectionControl';
import { getZoneFromPosition, getVolumeForZone } from './zoneFix';
import { AudioManager } from './audio/AudioManager';
import { AudioControlPanel } from './components/AudioControlPanel';
import FenixStylePA from './components/FenixStylePA';
import Boeing737Interface from './components/Boeing737Interface';
import './components/AudioControlPanel.css';
// Import types but rename them to avoid conflicts
import * as AppTypes from './types';

// Local interfaces for App component
interface FlightState {
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
  wingLight: boolean;
  aircraftType?: string;
}

interface CameraPositionPayload {
  position: string;
  viewType: string;
  volumeLevel: number;
  xPosition?: number;
  yPosition?: number;
  zPosition?: number;
}

interface AudioEvent {
  name: string;
  action: 'play' | 'stop' | 'pause';
}

// Add Window interface
declare global {
  interface Window {
    ipcRenderer?: {
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
  }
}

// Aircraft configurations
const DEFAULT_AIRCRAFT_CONFIGS: AppTypes.AircraftConfigs = {
  "A320": {
    zones: {
      outside: { start: 0.0, end: -1.6 },
      jetway: { start: -1.6, end: -12.0 },
      cabin: { start: -12.0, end: -22.4 },
      cockpit: { start: -22.4, end: -24.3 }
    }
  },
  "A319": {
    zones: {
      outside: { start: -1.55, end: -1.55 },
      jetway: { start: -11.5, end: -11.5 },
      cabin: { start: -20.0, end: -20.0 },
      cockpit: { start: -22.0, end: -22.0 }
    }
  },
  "A321": {
    zones: {
      outside: { start: -1.65, end: -1.65 },
      jetway: { start: -12.5, end: -12.5 },
      cabin: { start: -24.6, end: -24.6 },
      cockpit: { start: -26.5, end: -26.5 }
    }
  },
  "A350": {
    zones: {
      outside: { start: -1.80, end: -1.80 },
      jetway: { start: -14.0, end: -14.0 },
      cabin: { start: -28.0, end: -28.0 },
      cockpit: { start: -30.0, end: -30.0 }
    }
  },
  "A350-900": {
    zones: {
      outside: { start: -1.80, end: -1.80 },
      jetway: { start: -14.0, end: -14.0 },
      cabin: { start: -28.0, end: -28.0 },
      cockpit: { start: -30.0, end: -30.0 }
    }
  },
  "A350-1000": {
    zones: {
      outside: { start: -1.85, end: -1.85 },
      jetway: { start: -15.0, end: -15.0 },
      cabin: { start: -32.0, end: -32.0 },
      cockpit: { start: -34.0, end: -34.0 }
    }
  },
  "B737": {
    zones: {
      outside: { start: -1.40, end: -1.40 },
      jetway: { start: -10.0, end: -10.0 },
      cabin: { start: -20.0, end: -20.0 },
      cockpit: { start: -22.0, end: -22.0 }
    }
  },
  "B737-700": {
    zones: {
      outside: { start: -1.35, end: -1.35 },
      jetway: { start: -9.5, end: -9.5 },
      cabin: { start: -19.0, end: -19.0 },
      cockpit: { start: -21.0, end: -21.0 }
    }
  },
  "B737-800": {
    zones: {
      outside: { start: -1.40, end: -1.40 },
      jetway: { start: -10.0, end: -10.0 },
      cabin: { start: -21.5, end: -21.5 },
      cockpit: { start: -23.5, end: -23.5 }
    }
  },
  "B737-900": {
    zones: {
      outside: { start: -1.45, end: -1.45 },
      jetway: { start: -10.5, end: -10.5 },
      cabin: { start: -23.0, end: -23.0 },
      cockpit: { start: -25.0, end: -25.0 }
    }
  },
  "B787": {
    zones: {
      outside: { start: -1.75, end: -1.75 },
      jetway: { start: -13.0, end: -13.0 },
      cabin: { start: -26.0, end: -26.0 },
      cockpit: { start: -28.0, end: -28.0 }
    }
  },
  "B787-8": {
    zones: {
      outside: { start: -1.70, end: -1.70 },
      jetway: { start: -12.5, end: -12.5 },
      cabin: { start: -24.0, end: -24.0 },
      cockpit: { start: -26.0, end: -26.0 }
    }
  },
  "B787-9": {
    zones: {
      outside: { start: -1.75, end: -1.75 },
      jetway: { start: -13.0, end: -13.0 },
      cabin: { start: -26.0, end: -26.0 },
      cockpit: { start: -28.0, end: -28.0 }
    }
  },
  "B787-10": {
    zones: {
      outside: { start: -1.80, end: -1.80 },
      jetway: { start: -13.5, end: -13.5 },
      cabin: { start: -28.0, end: -28.0 },
      cockpit: { start: -30.0, end: -30.0 }
    }
  },
  "CRJ": {
    zones: {
      outside: { start: -1.20, end: -1.20 },
      jetway: { start: -8.0, end: -8.0 },
      cabin: { start: -16.0, end: -16.0 },
      cockpit: { start: -18.0, end: -18.0 }
    }
  },
  "E-Jet": {
    zones: {
      outside: { start: -1.30, end: -1.30 },
      jetway: { start: -9.0, end: -9.0 },
      cabin: { start: -18.0, end: -18.0 },
      cockpit: { start: -20.0, end: -20.0 }
    }
  },
  "B747": {
    zones: {
      outside: { start: -2.00, end: -2.00 },
      jetway: { start: -15.0, end: -15.0 },
      cabin: { start: -30.0, end: -30.0 },
      cockpit: { start: -32.0, end: -32.0 }
    }
  },
  "Custom": {
    zones: {
      outside: { start: -1.60, end: -1.60 },
      jetway: { start: -12.0, end: -12.0 },
      cabin: { start: -22.4, end: -22.4 },
      cockpit: { start: -24.3, end: -24.3 }
    }
  }
};

function App() {
  // State declarations at the top
  const [position, setPosition] = useState<number>(0);
  const [thresholds, setThresholds] = useState<AppTypes.AircraftZones>({
    outside: { start: 0.0, end: -1.6 },
    jetway: { start: -1.6, end: -12.0 },
    cabin: { start: -12.0, end: -22.4 },
    cockpit: { start: -22.4, end: -24.3 }
  });
  const [audioManager] = useState(() => new AudioManager());
  const [currentZone, setCurrentZone] = useState<string>('outside');

  // Initialize audio manager
  useEffect(() => {
    audioManager.initialize();
  }, [audioManager]);

  // Update position and thresholds when camera position changes
  useEffect(() => {
    const handleCameraPosition = (event: any) => {
      if (event.xPosition !== undefined) {
        setPosition(event.xPosition);
      }
      if (event.thresholds) {
        setThresholds(event.thresholds);
      }
      if (event.zone) {
        setCurrentZone(event.zone);
      }
    };

    window.ipcRenderer?.on('camera-position', handleCameraPosition);
    return () => {
      window.ipcRenderer?.removeListener('camera-position', handleCameraPosition);
    };
  }, []);

  // Update audio manager when zone changes
  useEffect(() => {
    if (currentZone && position && thresholds) {
      audioManager.updateZoneVolumes(currentZone, position, thresholds);
    }
  }, [currentZone, position, thresholds, audioManager]);

  const [beaconLight, setBeaconLight] = useState<boolean>(false);
  const [landingLights, setLandingLights] = useState<boolean>(false);
  const [landingLightsOffCount, setLandingLightsOffCount] = useState<number>(0);
  const [hasDescendedThrough10k, setHasDescendedThrough10k] = useState<boolean>(false);
  const [cameraPosition, setCameraPosition] = useState<string>('exterior');
  const [cockpitDoorOpen, setCockpitDoorOpen] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState(100);
  const [currentVolume, setCurrentVolume] = useState(35);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioName, setCurrentAudioName] = useState<string>('');
  const [currentAudioVolume, setCurrentAudioVolume] = useState<number>(0);
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);
  const currentTimeRef = useRef(Date.now());
  const [wingLightCount, setWingLightCount] = useState<number>(0);
  // Aircraft selection states
  const [selectedAircraftType, setSelectedAircraftType] = useState<string>(() => {
    const saved = localStorage.getItem('selectedAircraftType');
    return saved || "A320";
  });
  const [aircraftDetectionMode, setAircraftDetectionMode] = useState<string>(() => {
    const saved = localStorage.getItem('aircraftDetectionMode');
    return saved || "manual"; // 'auto' or 'manual'
  });
  const [flightState, setFlightState] = useState<FlightState>({
    xPosition: 0,
    yPosition: 0,
    zPosition: 0,
    speed: 0,
    heading: 0,
    cameraViewType: 'external',
    beaconLight: false,
    seatbeltSign: false,
    jetwayMoving: false,
    jetwayState: 0,
    wingLight: false
  });
  const [hasLanded, setHasLanded] = useState<boolean>(false);
  const [touchdownData, setTouchdownData] = useState<{
    normalVelocity: number;
    bankDegrees: number;
    pitchDegrees: number;
    headingDegrees: number;
    lateralVelocity: number;
    longitudinalVelocity: number;
  } | null>(null);
  const lastTouchdownRef = useRef<number>(0);

  // Add seatbelt sign state
  const [seatbeltSign, setSeatbeltSign] = useState<boolean>(false);
  const seatbeltSignCountRef = useRef<number>(0);
  const [seatbeltSignCount, setSeatbeltSignCount] = useState<number>(0);
  // Add a reference to track the previous seatbelt state
  const lastSeatbeltStateRef = useRef<boolean>(false);

  // Add GSX bypass pin state
  const [gsxBypassPin, setGsxBypassPin] = useState<boolean>(false);
  const lastGsxBypassPinUpdateRef = useRef<number>(0);
  const GSX_BYPASS_PIN_DEBOUNCE_TIME = 5000; // 5 seconds debounce time
  const safetyVideoPlayedRef = useRef<boolean>(false); // Track if safety video has been played

  // Audio refs
  const boardingMusicRef = useRef<HTMLAudioElement | null>(null);
  const welcomeAboardRef = useRef<HTMLAudioElement | null>(null);
  const doorsAutoRef = useRef<HTMLAudioElement | null>(null);
  const tenKFeetRef = useRef<HTMLAudioElement | null>(null);
  const arriveSoonRef = useRef<HTMLAudioElement | null>(null);
  const landingSoonRef = useRef<HTMLAudioElement | null>(null);
  const weveArrivedRef = useRef<HTMLAudioElement | null>(null);
  const almostReadyRef = useRef<HTMLAudioElement | null>(null);
  const seatsForDepartureRef = useRef<HTMLAudioElement | null>(null);
  const safetyVideoRef = useRef<HTMLAudioElement | null>(null);
  const fastenSeatbeltRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const jetwayAttachedRef = useRef<boolean>(false);
  const lastAltitudeRef = useRef<number>(0);
  const tenKAnnouncedRef = useRef<boolean>(false);
  const arriveSoonAnnouncedRef = useRef<boolean>(false);
  const landingSoonAnnouncedRef = useRef<boolean>(false);
  const lastLandingLightsStateRef = useRef<boolean>(false);
  const hasDescendedThrough10kRef = useRef<boolean>(false);
  const lastZPositionRef = useRef<number | null>(null);
  const lastVolumeUpdateRef = useRef<number>(0);
  const currentZoneRef = useRef<string | null>(null);
  const welcomeAboardTimerRef = useRef<number | null>(null);
  const isAlmostReadyPlayingRef = useRef<boolean>(false);
  const lastWingLightStateRef = useRef<boolean>(false);
  const isWingLightAudioPlayingRef = useRef<boolean>(false);
 
  const positionHistoryRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);
  const MIN_UPDATE_INTERVAL = 1000; // Increased to 1 second to prevent rapid updates
  const POSITION_THRESHOLD = 0.05; // Changed from a higher value to be more sensitive
  const ZONE_CHANGE_THRESHOLD = 0.3; // Increased from 0.1 to avoid zone flicker
  const lastJetbridgeUpdateRef = useRef<number>(0);
  const JETBRIDGE_UPDATE_INTERVAL = 5000; // Minimum time between jetbridge updates (5 seconds)
  const JETBRIDGE_POSITION_THRESHOLD = 2.0; // Minimum position change for jetbridge updates

  // Camera position tracking for volume control
  const lastCameraZRef = useRef<number | null>(null);
  
  // Add fade transition constants
  const FADE_DURATION = 250; // Reduced to 250ms for faster transitions
  const FADE_STEPS = 10; // Reduced steps for faster transitions
  const FADE_INTERVAL = FADE_DURATION / FADE_STEPS;

  // Add debounce constants
  const VOLUME_DEBOUNCE_TIME = 500; // Increased from 250ms to 500ms for more stability

  // Add a ref to track audio playback state
  const isSeatbeltAudioPlayingRef = useRef<boolean>(false);
  const lastSeatbeltEventTimeRef = useRef<number>(Date.now());
  const seatbeltEventDebounceTimeRef = useRef<number>(3000); // 3 seconds debounce

  // Position debounce values
  const zoneStabilityRef = useRef<{
    lastZone: string,
    lastZoneZ: number,
    stableCounter: number,
    changeTime: number
  }>({
    lastZone: 'outside',
    lastZoneZ: 0,
    stableCounter: 0,
    changeTime: 0
  });

  // Add a reference to track the previous beacon light state
  const lastBeaconLightStateRef = useRef<boolean>(false);

  // Add audio ref for beacon light sound
  const beaconLightSoundRef = useRef<HTMLAudioElement | null>(null);
  const isBeaconAudioPlayingRef = useRef<boolean>(false);

  // Add a flag to indicate when wing light is manually controlled
  // const [wingLightManualOverride, setWingLightManualOverride] = useState<boolean>(false);
  
  // // Create a wrapper for setFlightState to track wing light changes
  // const setFlightStateWithTracking = (newStateOrFunction: React.SetStateAction<FlightState>) => {
  //   setFlightState(prevState => {
  //     // Calculate the new state
  //     const newState = typeof newStateOrFunction === 'function'
  //       ? (newStateOrFunction as (prev: FlightState) => FlightState)(prevState)
  //       : newStateOrFunction;
  //       
  //     // Check if wing light state is changing
  //     if (newState.wingLight !== prevState.wingLight) {
  //       console.log(`[WING LIGHT TRACKER] State changing from ${prevState.wingLight} to ${newState.wingLight}`);
  //       console.trace('[WING LIGHT TRACKER] Stack trace:');
  //     }
  //     
  //     return newState;
  //   });
  // };

  // Revert fadeVolume function to original implementation
  const fadeVolume = (element: HTMLAudioElement, targetVolume: number) => {
    const startVolume = element.volume;
    const duration = 250; // 250ms fade duration
    const steps = 10; // Number of steps in the fade
    const stepTime = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = startVolume + (volumeStep * currentStep);
      element.volume = Math.max(0, Math.min(1, newVolume)); // Ensure volume stays between 0 and 1

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        element.volume = targetVolume;
      }
    }, stepTime);
  };

  // Function to convert linear volume to logarithmic scale
  const toLogVolume = (linearVolume: number): number => {
    // Convert to dB scale (0-100% to -60dB to 0dB)
    const dB = (linearVolume / 100) * 60 - 60;
    // Convert dB back to linear scale (0-1)
    return Math.pow(10, dB / 20);
  };

  // Function to determine current zone based on camera Z position
  const getCurrentZone = (
    cameraPosition: [number, number, number],
    thresholds?: AppTypes.AircraftZones
  ): string => {
    if (!thresholds) {
      console.log('getCurrentZone: No thresholds provided, defaulting to "outside"');
      return "outside";
    }

    const [x, y, z] = cameraPosition;
    console.log(`getCurrentZone: Checking zone for position z=${z.toFixed(3)}`);
    
    // Debug values of all thresholds
    console.log("ZONE THRESHOLDS:", {
      outside: { start: thresholds.outside.start.toFixed(3) },
      jetway: { start: thresholds.jetway.start.toFixed(3) },
      cabin: { start: thresholds.cabin.start.toFixed(3) },
      cockpit: { start: thresholds.cockpit.start.toFixed(3) }
    });
    
    // Check exact threshold conditions to diagnose issues
    console.log("ZONE CONDITIONS:", {
      cockpit: `z(${z.toFixed(3)}) <= cockpit.start(${thresholds.cockpit.start.toFixed(3)}) = ${z <= thresholds.cockpit.start}`,
      cabin: `z(${z.toFixed(3)}) <= cabin.start(${thresholds.cabin.start.toFixed(3)}) = ${z <= thresholds.cabin.start}`,
      jetway: `z(${z.toFixed(3)}) <= jetway.start(${thresholds.jetway.start.toFixed(3)}) = ${z <= thresholds.jetway.start}`,
      outside: `z(${z.toFixed(3)}) > jetway.start(${thresholds.jetway.start.toFixed(3)}) = ${z > thresholds.jetway.start}`
    });
    
    // Note: Z is negative and smaller numbers are further inside the aircraft
    // Therefore, we need to check from inside out (cockpit first, then cabin, etc.)
    if (z <= thresholds.cockpit.start) {
      console.log(`getCurrentZone: In COCKPIT zone (z=${z.toFixed(3)} <= cockpit.start=${thresholds.cockpit.start.toFixed(3)})`);
      return "cockpit";
    } else if (z <= thresholds.cabin.start) {
      console.log(`getCurrentZone: In CABIN zone (z=${z.toFixed(3)} <= cabin.start=${thresholds.cabin.start.toFixed(3)})`);
      return "cabin";
    } else if (z <= thresholds.jetway.start) {
      console.log(`getCurrentZone: In JETWAY zone (z=${z.toFixed(3)} <= jetway.start=${thresholds.jetway.start.toFixed(3)})`);
      return "jetway";
    } else {
      console.log(`getCurrentZone: In OUTSIDE zone (z=${z.toFixed(3)} > jetway.start=${thresholds.jetway.start.toFixed(3)})`);
      return "outside";
    }
  };

  // Function to get volume for zone
  const getZoneVolume = (zone: string): number => {
    console.log(`Getting volume for zone: ${zone}`);
    switch (zone) {
      case 'outside': return 0.45;    // 45%
      case 'jetway': return 0.792;    // 79.2%
      case 'cabin': return 0.693;     // 69.3%
      case 'cockpit': return 0.65;    // 65%
      default: return 0.693;          // 69.3%
    }
  };

  // Fix NodeJS namespace by using number instead
  // Add a reference for the last zone update time
  const lastZoneUpdateTimeRef = useRef<number>(Date.now());
  // Add a timeout reference for zone monitoring
  const zoneMonitorTimeoutRef = useRef<number | null>(null);
  // Add a constant for zone recalculation timeout (force check every 2 seconds)
  const ZONE_RECALCULATION_TIMEOUT = 2000;

  // Add a zone monitoring function to ensure zones are updated periodically
  const monitorZoneDetection = () => {
    // Clear any existing monitor
    if (zoneMonitorTimeoutRef.current) {
      window.clearTimeout(zoneMonitorTimeoutRef.current);
    }
    
    // Set up a new monitor
    zoneMonitorTimeoutRef.current = window.setTimeout(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastZoneUpdateTimeRef.current;
      
      // If it's been too long since the last zone update, force a recalculation
      if (timeSinceLastUpdate > ZONE_RECALCULATION_TIMEOUT) {
        console.log(`ZONE MONITOR: ${timeSinceLastUpdate}ms since last update, forcing recalculation`);
        // Force a zone update by temporarily resetting position tracking
        const originalLastPosition = lastZPositionRef.current;
        lastZPositionRef.current = null;
        updateAllAudioVolumes();
        // Restore original position after forced update
        lastZPositionRef.current = originalLastPosition;
      }
      
      // Continue monitoring
      monitorZoneDetection();
    }, ZONE_RECALCULATION_TIMEOUT);
  };

  // Start monitoring in a useEffect
  useEffect(() => {
    console.log("Starting zone detection monitoring");
    monitorZoneDetection();
    
    
    return () => {
      console.log("Stopping zone detection monitoring");
      if (zoneMonitorTimeoutRef.current) {
        window.clearTimeout(zoneMonitorTimeoutRef.current);
      }
    };
  }, []);

  // Revert the changes to updateAllAudioVolumes to restore the original behavior
  const updateAllAudioVolumes = () => {
    const now = Date.now();
    if (now - lastVolumeUpdateRef.current < VOLUME_DEBOUNCE_TIME) {
      // Skip update if too soon since last update
      return;
    }

    // Get the current Z position, prioritizing the most recent value
    const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
    
    console.log(`updateAllAudioVolumes: Current Z position = ${currentZ}, Last Z = ${lastZPositionRef.current ?? 'null'}`);
    
    // Always update when first called (lastZPositionRef is null)
    const isFirstUpdate = lastZPositionRef.current === null;
    
    // Check if position has changed significantly or this is first update
    // Skip this check in debug mode
    if (!isFirstUpdate && !debugMode) {
      const lastZ = lastZPositionRef.current || 0; // Use 0 as fallback if null
      const positionDelta = Math.abs(currentZ - lastZ);
      if (positionDelta < POSITION_THRESHOLD) {
        console.log(`updateAllAudioVolumes: Position change too small (${positionDelta.toFixed(5)}), skipping update`);
        return; // Skip update - position change too small
      }
      console.log(`Position change detected: ${lastZ.toFixed(5)} -> ${currentZ.toFixed(5)}, delta: ${positionDelta.toFixed(5)}`);
    } else if (debugMode) {
      console.log(`DEBUG MODE: Processing all position updates regardless of threshold`);
    } else {
      console.log(`First position update, using Z = ${currentZ.toFixed(5)}`);
    }
    
    // Update last update time since we're proceeding with the update
    lastVolumeUpdateRef.current = now;
    
    // Get the current aircraft config based on selected type
    const currentAircraftConfig = selectedAircraftType ? 
      getAircraftConfigs()[selectedAircraftType] : null;
    
    console.log(`updateAllAudioVolumes: Using aircraft config for ${selectedAircraftType}:`, 
      currentAircraftConfig ? JSON.stringify(currentAircraftConfig.zones) : 'No config found');
    
    // Get current zone from position using the aircraft-specific thresholds
    const zone = currentAircraftConfig ? 
      getCurrentZone([0, 0, currentZ], currentAircraftConfig.zones) : 
      getZoneFromPosition(currentZ);
    
    // Check if zone changed from last known zone
    const zoneChanged = zone !== currentZoneRef.current;
    if (zoneChanged) {
      console.log(`ZONE CHANGED from ${currentZoneRef.current || 'unknown'} to ${zone}`);
    }
    
    console.log(`updateAllAudioVolumes: Determined zone: ${zone}`);
    
    const baseVolume = getZoneVolume(zone);
    const logVolume = toLogVolume(baseVolume * 100);
    const finalVolume = (masterVolume / 100) * logVolume;

    console.log('Volume calculation:', {
      currentZ,
      zone,
      baseVolume,
      logVolume,
      finalVolume,
      masterVolume
    });

    // Update all audio elements with smooth transition
    const updateVolume = (ref: React.MutableRefObject<HTMLAudioElement | null>, name: string) => {
      if (ref.current) {
        fadeVolume(ref.current, finalVolume);
      }
    };

    // Update all audio elements including doors auto
    updateVolume(boardingMusicRef, 'boarding music');
    updateVolume(welcomeAboardRef, 'welcome aboard');
    updateVolume(doorsAutoRef, 'doors auto');
    updateVolume(tenKFeetRef, '10k feet');
    updateVolume(arriveSoonRef, 'arrive soon');
    updateVolume(landingSoonRef, 'landing soon');
    updateVolume(weveArrivedRef, 'weve arrived');
    updateVolume(almostReadyRef, 'almost ready');
    updateVolume(seatsForDepartureRef, 'seats for departure');
    updateVolume(safetyVideoRef, 'safety video');
    updateVolume(fastenSeatbeltRef, 'fasten seatbelt');

    // Update volume indicator (show linear value for user)
    setCurrentVolume(baseVolume * 100);
    setCurrentZone(zone);

    // Update timestamp of last zone calculation
    lastZoneUpdateTimeRef.current = now;

    // Store current Z position and zone
    lastZPositionRef.current = currentZ;
    currentZoneRef.current = zone;
  };

  // Common function to handle altitude-related announcements
  const playAltitudeAnnouncement = (ref: React.MutableRefObject<HTMLAudioElement | null>, announcementName: string) => {
    if (ref.current) {
      console.log(`Attempting to play ${announcementName} announcement`);
      console.log(`Audio element state:`, {
        readyState: ref.current.readyState,
        error: ref.current.error,
        src: ref.current.src,
        volume: ref.current.volume,
        muted: ref.current.muted
      });

      const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
      const zone = getCurrentZone([currentZ, 0, 0]);
      const baseVolume = getZoneVolume(zone);
      const logVolume = toLogVolume(baseVolume * 100);
      const positionVolume = (masterVolume / 100) * logVolume;
      
      setCurrentAudioVolume(positionVolume * 100);
      setCurrentZone(zone);
      console.log(`Playing ${announcementName} announcement with volume: ${positionVolume} in zone: ${zone}`);
      
      // Lower boarding music volume before playing announcement
      if (boardingMusicRef.current) {
        console.log('Lowering boarding music volume for announcement');
        boardingMusicRef.current.volume = 0.05;
      }
      
      // Ensure audio is ready before playing
      if (ref.current.readyState >= 2) {
        ref.current.volume = positionVolume;
        ref.current.currentTime = 0; // Reset to start
        ref.current.play()
          .then(() => {
            console.log(`Successfully started playing ${announcementName} announcement`);
            ref.current?.addEventListener('ended', () => {
              console.log(`${announcementName} announcement finished playing`);
              setIsPlaying(false);
              setCurrentAudioName('');
              
              // Restore boarding music volume after announcement
              if (boardingMusicRef.current && jetwayAttachedRef.current) {
                console.log('Restoring boarding music volume after announcement');
                boardingMusicRef.current.volume = 1.0;
              }
            }, { once: true });
          })
          .catch(error => {
            console.error(`Error playing ${announcementName} announcement:`, error);
            // Restore boarding music volume on error
            if (boardingMusicRef.current && jetwayAttachedRef.current) {
              boardingMusicRef.current.volume = 1.0;
            }
          });
      } else {
        console.log(`${announcementName} audio not ready yet. ReadyState:`, ref.current.readyState);
        // Wait for audio to be ready
        ref.current.addEventListener('canplaythrough', () => {
          console.log(`${announcementName} audio is now ready to play`);
          ref.current?.play()
            .then(() => {
              console.log(`Successfully started playing ${announcementName} announcement after waiting`);
              ref.current?.addEventListener('ended', () => {
                // Restore boarding music volume after announcement
                if (boardingMusicRef.current && jetwayAttachedRef.current) {
                  console.log('Restoring boarding music volume after announcement');
                  boardingMusicRef.current.volume = 1.0;
                }
              }, { once: true });
            })
            .catch(error => {
              console.error(`Error playing ${announcementName} announcement after waiting:`, error);
              // Restore boarding music volume on error
              if (boardingMusicRef.current && jetwayAttachedRef.current) {
                boardingMusicRef.current.volume = 1.0;
              }
            });
        }, { once: true });
      }
    } else {
      console.error(`${announcementName} audio element not found`);
    }
  };

  // Function to handle audio events
  const handleAudioEvent = async (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid audio event:', event);
        return;
      }

      const data = event.payload as {
        type: string;
        volume?: number;
      };

      console.log('Audio event received:', data);

      if (data.type === 'safety_video') {
        if (safetyVideoRef.current) {
          console.log('Attempting to play safety video');
          console.log('Safety video audio element state:', {
            readyState: safetyVideoRef.current.readyState,
            error: safetyVideoRef.current.error,
            src: safetyVideoRef.current.src,
            volume: safetyVideoRef.current.volume,
            muted: safetyVideoRef.current.muted,
            paused: safetyVideoRef.current.paused,
            currentTime: safetyVideoRef.current.currentTime
          });
          
          // Lower boarding music volume before playing safety video
          if (boardingMusicRef.current) {
            console.log('Lowering boarding music volume for safety video');
            boardingMusicRef.current.volume = 0.2;
          }
          
          // Set safety video volume based on current zone
          const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
          const zone = getCurrentZone([currentZ, 0, 0]);
          const baseVolume = getZoneVolume(zone);
          const logVolume = toLogVolume(baseVolume * 100);
          const positionVolume = (masterVolume / 100) * logVolume;
          
          console.log('Volume calculation:', {
            currentZ,
            zone,
            baseVolume,
            logVolume,
            positionVolume,
            masterVolume
          });
          
          safetyVideoRef.current.volume = positionVolume;
          safetyVideoRef.current.currentTime = 0; // Reset to start
          
          try {
            await safetyVideoRef.current.play();
            console.log('Successfully started playing safety video');
            setIsPlaying(true);
            setCurrentAudioName('safety_video');
            setCurrentAudioVolume(positionVolume * 100);
            setCurrentZone(zone);
            
            // Add event listener for when the audio ends
            safetyVideoRef.current.addEventListener('ended', () => {
              console.log('Safety video finished playing');
              setIsPlaying(false);
              setCurrentAudioName('');
              
              // Restore boarding music volume after safety video finishes
              if (boardingMusicRef.current) {
                console.log('Restoring boarding music volume');
                boardingMusicRef.current.volume = 1.0;
              }
            }, { once: true });
          } catch (error) {
            console.error('Error playing safety video:', error);
            setIsPlaying(false);
            setCurrentAudioName('');
            
            // Restore boarding music volume on error
            if (boardingMusicRef.current) {
              console.log('Restoring boarding music volume after error');
              boardingMusicRef.current.volume = 1.0;
            }
          }
        } else {
          console.error('Safety video audio element not found');
        }
      }
    } catch (error) {
      console.error('Error handling audio event:', error);
    }
  };

  // Function to handle landing lights state changes
  const handleLandingLightsChange = (newState: boolean) => {
    console.log(`Landing lights state changed: ${lastLandingLightsStateRef.current} -> ${newState}`);
    console.log(`Current count: ${landingLightsOffCount}, Has descended through 10k: ${hasDescendedThrough10kRef.current}`);
    
    // Only process if the state has actually changed
    if (newState !== lastLandingLightsStateRef.current) {
      console.log(`Landing lights state change detected. Previous: ${lastLandingLightsStateRef.current}, New: ${newState}`);
      
      // If landing lights were turned off (transition from ON to OFF)
      if (lastLandingLightsStateRef.current === true && newState === false) {
        setLandingLightsOffCount(prevCount => {
          const newCount = prevCount + 1;
          console.log(`Incrementing count from ${prevCount} to ${newCount}`);
          console.log(`Checking conditions for "We've arrived" announcement:`);
          console.log(`- Landing lights off count: ${newCount} (needs to be exactly 2)`);
          console.log(`- Has descended through 10k: ${hasDescendedThrough10kRef.current}`);
          
          // Check if we should play "We've arrived" announcement
          if (newCount === 2 && hasDescendedThrough10kRef.current) {
            console.log('Conditions met! Playing "We\'ve arrived" announcement');
            if (weveArrivedRef.current) {
              // Use the helper function for consistent audio playback management
              playAnnouncementWithVolume(weveArrivedRef, 'weve_arrived', () => {
                console.log('We\'ve arrived announcement completed');
              });
            } else {
              console.error('weveArrivedRef.current is null - cannot play announcement');
            }
          } else {
            console.log('Conditions not met for "We\'ve arrived" announcement');
            console.log(`Landing lights off count: ${newCount}, Has descended through 10k: ${hasDescendedThrough10kRef.current}`);
          }
          
          return newCount;
        });
      }
      
      // Update the last state after processing the change
      lastLandingLightsStateRef.current = newState;
      setLandingLights(newState);
    }
  };

  // Function to stop all audio
  const stopAllAudio = () => {
    console.log('Stopping all audio...');
    const audioRefs = [
      boardingMusicRef,
      welcomeAboardRef,
      doorsAutoRef,
      tenKFeetRef,
      arriveSoonRef,
      landingSoonRef,
      weveArrivedRef,
      almostReadyRef,
      seatsForDepartureRef,
      safetyVideoRef
    ];

    audioRefs.forEach(ref => {
      if (ref.current) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });

    // Reset audio states
    setIsPlaying(false);
    setCurrentAudioName('');
    setCurrentAudioVolume(0);
  };

  // Function to handle seatbelt sign changes
  const handleSeatbeltSignChange = (newState: boolean) => {
    console.log('=== Seatbelt Sign State Change ===');
    console.log(`New State: ${newState ? 'ON' : 'OFF'}`);
    console.log(`Previous State: ${lastSeatbeltStateRef.current ? 'ON' : 'OFF'}`);
    console.log(`Current Count: ${seatbeltSignCountRef.current}`);
    
    // Only process if the state has actually changed
    if (newState !== lastSeatbeltStateRef.current) {
      console.log(`Seatbelt sign state change detected. Previous: ${lastSeatbeltStateRef.current ? 'ON' : 'OFF'}, New: ${newState ? 'ON' : 'OFF'}`);
      
      // If seatbelt sign was turned ON (transition from OFF to ON)
      if (!lastSeatbeltStateRef.current && newState) {
        setSeatbeltSignCount(prevCount => {
          const newCount = prevCount + 1;
          console.log(`Incrementing count from ${prevCount} to ${newCount}`);
          seatbeltSignCountRef.current = newCount;
          
          // If audio is currently playing, don't interrupt it
          if (isSeatbeltAudioPlayingRef.current) {
            console.log('Seatbelt audio already playing, ignoring event');
            return newCount;
          }
          
          // Play appropriate announcement based on count
          if (newCount === 1) {
            // First time - play "Almost ready to go"
            if (almostReadyRef.current) {
              console.log('Playing "Almost ready to go" announcement (first use of seatbelt sign)');
              
              // Always stop welcome aboard announcements
              if (welcomeAboardTimerRef.current) {
                console.log('Clearing welcome aboard announcement timer');
                clearTimeout(welcomeAboardTimerRef.current);
                welcomeAboardTimerRef.current = null;
              }
              
              // Set flag to track the "Almost ready" announcement is playing
              isAlmostReadyPlayingRef.current = true;
              isSeatbeltAudioPlayingRef.current = true;
              
              playAnnouncementWithVolume(almostReadyRef, 'almost_ready', () => {
                console.log('Almost ready announcement finished, resetting flags');
                isAlmostReadyPlayingRef.current = false;
                isSeatbeltAudioPlayingRef.current = false;
                
                // Restart welcome aboard announcements with random timer
                scheduleWelcomeAboardAnnouncement();
              });
            } else {
              console.error('Almost ready audio element not found');
            }
          } else {
            // Subsequent times - play "Fasten seatbelts"
            console.log(`Playing "Fasten seatbelts" announcement (seatbelt use count: ${newCount})`);
            if (fastenSeatbeltRef.current) {
              console.log('Playing "Fasten seatbelts" announcement');
              
              // Set flag to track that seatbelt audio is playing
              isSeatbeltAudioPlayingRef.current = true;
              
              playAnnouncementWithVolume(fastenSeatbeltRef, 'fasten_seatbelt', () => {
                console.log('Fasten seatbelt announcement finished, resetting flag');
                isSeatbeltAudioPlayingRef.current = false;
              });
            } else {
              console.error('Fasten seatbelt audio element not found');
            }
          }
          
          return newCount;
        });
      }
      
      // Update the last state after processing the change
      lastSeatbeltStateRef.current = newState;
      setSeatbeltSign(newState);
    } else {
      console.log('Seatbelt sign state did not change, ignoring event');
    }
    console.log('=== End Seatbelt Sign State Change ===');
  };

  // Helper function to play announcement with proper volume
  const playAnnouncementWithVolume = (audioRef: React.MutableRefObject<HTMLAudioElement | null>, audioName: string, onEndCallback?: () => void) => {
    if (!audioRef.current) {
      console.error(`${audioName} audio element not found`);
      if (onEndCallback) {
        // Still call the callback so state flags are reset properly
        onEndCallback();
      }
      return;
    }
    
    console.log(`Playing announcement: ${audioName}`);
    
    // Get current zone and calculate proper volume
    const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
    const zone = getCurrentZone([currentZ, 0, 0]);
    const baseVolume = getZoneVolume(zone);
    const logVolume = toLogVolume(baseVolume * 100);
    const positionVolume = (masterVolume / 100) * logVolume;
    
    console.log(`Audio ${audioName} volume calculation:`, {
      zone,
      baseVolume,
      logVolume,
      positionVolume,
      masterVolume
    });
    // Lower boarding music volume before playing announcement
    if (boardingMusicRef.current) {
      console.log(`Lowering boarding music volume for ${audioName} announcement`);
      boardingMusicRef.current.volume = 0.05;
    }
    
    // Set up audio for playback
    audioRef.current.volume = positionVolume;
    audioRef.current.currentTime = 0;
    
    // Attempt to play the audio
    audioRef.current.play()
      .then(() => {
        console.log(`Successfully started playing "${audioName}" announcement`);
        setIsPlaying(true);
        setCurrentAudioName(audioName);
        setCurrentAudioVolume(positionVolume * 100);
        setCurrentZone(zone);
        
        // Add event listener for when the audio ends
        audioRef.current?.addEventListener('ended', () => {
          console.log(`"${audioName}" announcement finished playing`);
          setIsPlaying(false);
          setCurrentAudioName('');
          
          // Restore boarding music volume if needed
          if (boardingMusicRef.current && jetwayAttachedRef.current) {
            console.log(`Restoring boarding music volume after ${audioName} announcement`);
            boardingMusicRef.current.volume = 1.0;
          }
          
          if (onEndCallback) {
            onEndCallback();
          }
        }, { once: true });
      })
      .catch(error => {
        console.error(`Error playing "${audioName}" announcement:`, error);
        setIsPlaying(false);
        setCurrentAudioName('');
        
        // Restore boarding music volume on error
        if (boardingMusicRef.current && jetwayAttachedRef.current) {
          console.log(`Restoring boarding music volume after ${audioName} error`);
          boardingMusicRef.current.volume = 1.0;
        }
        
        if (onEndCallback) {
          onEndCallback();
        }
      });
  };

  // Helper function to schedule welcome aboard announcements
  const scheduleWelcomeAboardAnnouncement = () => {
    if (!jetwayAttachedRef.current) {
      return;
    }
    
    // Only schedule if the "Almost ready" is not playing
    if (isAlmostReadyPlayingRef.current) {
      return;
    }
    
    const randInterval = Math.floor(Math.random() * (140000 - 30000) + 30000); // Random between 30-140 seconds
    console.log(`Scheduling next welcome aboard announcement in ${randInterval/1000} seconds`);
    
    // Clear any existing timer before setting a new one
    if (welcomeAboardTimerRef.current) {
      clearTimeout(welcomeAboardTimerRef.current);
    }
    
    welcomeAboardTimerRef.current = window.setTimeout(() => {
      if (welcomeAboardRef.current && jetwayAttachedRef.current && !isAlmostReadyPlayingRef.current) {
        console.log('Playing welcome aboard announcement');
        if (boardingMusicRef.current) {
          boardingMusicRef.current.volume = 0.05;
        }
        welcomeAboardRef.current.currentTime = 0;
        welcomeAboardRef.current.play()
          .then(() => {
            console.log('Successfully started playing welcome aboard announcement');
            welcomeAboardRef.current?.addEventListener('ended', () => {
              console.log('Welcome aboard announcement finished playing');
              if (boardingMusicRef.current) {
                boardingMusicRef.current.volume = 1.0;
              }
              
              // Schedule next announcement
              scheduleWelcomeAboardAnnouncement();
            }, { once: true });
          })
          .catch(error => {
            console.error('Error playing welcome aboard:', error);
          });
      }
    }, randInterval);
  };

  // Function to handle GSX bypass pin input
  const handleGsxBypassPin = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid GSX bypass pin event:', event);
        return;
      }

      const data = event.payload as { active: boolean };
      console.log('=== GSX Bypass Pin Event ===');
      console.log('GSX bypass pin event received:', data);
      
      // Implement debounce for GSX bypass pin events
      const now = Date.now();
      if (now - lastGsxBypassPinUpdateRef.current < GSX_BYPASS_PIN_DEBOUNCE_TIME) {
        console.log(`Skipping GSX bypass pin update - too soon since last update (${now - lastGsxBypassPinUpdateRef.current}ms < ${GSX_BYPASS_PIN_DEBOUNCE_TIME}ms)`);
        console.log('=== End GSX Bypass Pin Event ===');
        return;
      }
      
      // Update the last update time
      lastGsxBypassPinUpdateRef.current = now;
      
      // Update the state
      setGsxBypassPin(data.active);
      
      // If GSX bypass pin is inserted, play the safety video after a delay
      if (data.active && !safetyVideoPlayedRef.current) {
        console.log('GSX bypass pin inserted, scheduling safety video playback in 5 seconds');
        setTimeout(() => {
          console.log('Attempting to play safety video after bypass pin insertion');
          
          // Check if the safety video element exists
          if (safetyVideoRef.current) {
            console.log('Safety video audio element found, attempting to play');
            console.log('Safety video element state:', {
              readyState: safetyVideoRef.current.readyState,
              error: safetyVideoRef.current.error,
              src: safetyVideoRef.current.src
            });
            
            // Ensure the safety video source is correctly loaded
            if (!safetyVideoRef.current.src || safetyVideoRef.current.src === "") {
              console.log('Safety video source not set, setting it now');
              safetyVideoRef.current.src = '/audio/safety_video.mp3';
              safetyVideoRef.current.load();
            }
            
            // Set reasonable volume levels
            const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
            const zone = getCurrentZone([currentZ, 0, 0]);
            const baseVolume = getZoneVolume(zone);
            const logVolume = toLogVolume(baseVolume * 100);
            const videoVolume = (masterVolume / 100) * logVolume;
            
            console.log('Volume calculation for safety video:', {
              currentZ,
              zone,
              baseVolume,
              logVolume,
              videoVolume,
              masterVolume
            });
            
            // Lower boarding music if it's playing
            if (boardingMusicRef.current) {
              console.log('Lowering boarding music volume for safety video');
              boardingMusicRef.current.volume = 0.2;
            }
            
            // Set up safety video playback
            safetyVideoRef.current.volume = videoVolume;
            safetyVideoRef.current.currentTime = 0;
            
            // Add listener for when the video can play
            safetyVideoRef.current.addEventListener('canplaythrough', () => {
              console.log('Safety video can now play through');
              safetyVideoRef.current?.play()
                .then(() => {
                  console.log('Safety video started playing successfully');
                  safetyVideoPlayedRef.current = true;
                  setIsPlaying(true);
                  setCurrentAudioName('safety_video');
                  setCurrentAudioVolume(videoVolume * 100);
                  setCurrentZone(zone);
                })
                .catch(error => {
                  console.error('Error playing safety video:', error);
                  // Restore boarding music on error
                  if (boardingMusicRef.current) {
                    console.log('Restoring boarding music volume after error');
                    boardingMusicRef.current.volume = 1.0;
                  }
                });
            }, { once: true });
            
            // Add listener for when the video ends
            safetyVideoRef.current.addEventListener('ended', () => {
              console.log('Safety video finished playing');
              setIsPlaying(false);
              setCurrentAudioName('');
              
              // Restore boarding music volume
              if (boardingMusicRef.current) {
                console.log('Restoring boarding music volume after safety video');
                boardingMusicRef.current.volume = 1.0;
              }
            }, { once: true });
            
            // Try to start playing
            safetyVideoRef.current.play()
              .then(() => {
                console.log('Safety video started playing immediately');
                safetyVideoPlayedRef.current = true;
                setIsPlaying(true);
                setCurrentAudioName('safety_video');
                setCurrentAudioVolume(videoVolume * 100);
                setCurrentZone(zone);
              })
              .catch(error => {
                if (error.name === 'NotAllowedError') {
                  console.log('Safety video autoplay prevented by browser. Waiting for user interaction.');
                } else if (error.name === 'NotSupportedError') {
                  console.error('Safety video format not supported:', error);
                } else {
                  console.error('Error starting safety video playback:', error);
                }
              });
          } else {
            console.error('Safety video audio element not found. Creating one dynamically.');
            
            // Create a safety video element dynamically if it doesn't exist
            const audioElement = document.createElement('audio');
            audioElement.id = 'safety_video';
            audioElement.src = '/audio/safety_video.mp3';
            audioElement.preload = 'auto';
            document.body.appendChild(audioElement);
            
            // Store the reference
            safetyVideoRef.current = audioElement;
            
            console.log('Created safety video element dynamically, now attempting to play');
            // Try again with the new element (recursive call with safeguards)
            handleGsxBypassPin(event);
          }
        }, 5000);
      }
      
      console.log('=== End GSX Bypass Pin Event ===');
    } catch (error) {
      console.error('Error handling GSX bypass pin event:', error);
    }
  };

  // Function to reset seatbelt sign count
  const resetSeatbeltCount = () => {
    console.log('Manually resetting seatbelt sign count to 0');
    seatbeltSignCountRef.current = 0;
    setSeatbeltSignCount(0);
    lastSeatbeltStateRef.current = false; // Reset the last state as well
  };

  // Function to handle beacon light state changes
  const handleBeaconLightChange = (newState: boolean) => {
    console.log('=== Beacon Light State Change ===');
    console.log(`New State: ${newState ? 'ON' : 'OFF'}`);
    console.log(`Previous State: ${lastBeaconLightStateRef.current ? 'ON' : 'OFF'}`);
    
    // Only process if the state has actually changed
    if (newState !== lastBeaconLightStateRef.current) {
      console.log(`Beacon light state change detected. Previous: ${lastBeaconLightStateRef.current ? 'ON' : 'OFF'}, New: ${newState ? 'ON' : 'OFF'}`);
      
      // If beacon light was turned ON (transition from OFF to ON)
      if (!lastBeaconLightStateRef.current && newState) {
        // If audio is currently playing, don't interrupt it
        if (isBeaconAudioPlayingRef.current) {
          console.log('Beacon light audio already playing, ignoring event');
        } else {
          // Play "Doors to Auto" sound when beacon light turns on
          if (doorsAutoRef.current) {
            console.log('Playing "Doors to Auto" sound for beacon light');
            
            // Set flag to track that beacon light audio is playing
            isBeaconAudioPlayingRef.current = true;
            
            // Always stop welcome aboard announcements when playing doors auto
            if (welcomeAboardTimerRef.current) {
              console.log('Clearing welcome aboard announcement timer');
              clearTimeout(welcomeAboardTimerRef.current);
              welcomeAboardTimerRef.current = null;
            }
            
            // Use the same playAnnouncementWithVolume function
            playAnnouncementWithVolume(doorsAutoRef, 'doors_auto', () => {
              console.log('"Doors to Auto" sound finished, resetting flag');
              isBeaconAudioPlayingRef.current = false;
              
              // Restart welcome aboard announcements with random timer if jetway is attached
              if (jetwayAttachedRef.current) {
                scheduleWelcomeAboardAnnouncement();
              }
            });
          } else {
            console.error('Doors to Auto audio element not found');
          }
        }
      }
      
      // Update the last state after processing the change
      lastBeaconLightStateRef.current = newState;
      setFlightState(prev => ({
        ...prev,
        beaconLight: newState
      }));
    } else {
      console.log('Beacon light state did not change, ignoring event');
    }
    console.log('=== End Beacon Light State Change ===');
  };

  // Function to handle camera position events
  const handleCameraPositionEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid camera position event:', event);
        return;
      }

      const data = event.payload as CameraPositionPayload;
      console.log('Camera position event received:', {
        position: data.position,
        viewType: data.viewType,
        x: data.xPosition,
        y: data.yPosition,
        z: data.zPosition,
      });
      
      // Update camera position tracking
      if (data.position) {
        setCameraPosition(data.position);
      }
      
      // Skip processing if zPosition is undefined
      if (typeof data.zPosition === 'undefined') {
        console.warn('Received camera position event with undefined zPosition');
        return;
      }

      const newZPosition = data.zPosition;
      const previousZPosition = lastCameraZRef.current || 0;
      const positionDelta = Math.abs(newZPosition - previousZPosition);
      
      // Only update if position has changed significantly
      if (positionDelta >= POSITION_THRESHOLD) {
        console.log(`Significant camera position event: Z ${previousZPosition} -> ${newZPosition}, delta: ${positionDelta}`);
        
        // Update camera position state
        setFlightState(prevState => ({
          ...prevState,
          xPosition: data.xPosition ?? prevState.xPosition,
          yPosition: data.yPosition ?? prevState.yPosition,
          zPosition: newZPosition,
          cameraViewType: data.viewType
        }));
        
        // Update camera position ref
        lastCameraZRef.current = data.zPosition;
        
        // Don't need to call updateAllAudioVolumes here as it will be triggered 
        // by the flightState update
      } else {
        // Position change too small, ignore it
        console.log(`Ignoring small camera position event: Z ${previousZPosition} -> ${newZPosition}, delta: ${positionDelta}`);
      }
    } catch (error) {
      console.error('Error handling camera position event:', error);
    }
  };

  // Function to handle touchdown events
  const handleTouchdownEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid touchdown event:', event);
        return;
      }

      const data = event.payload as {
        normalVelocity: number;
        bankDegrees: number;
        pitchDegrees: number;
        headingDegrees: number;
        lateralVelocity: number;
        longitudinalVelocity: number;
      };
      
      console.log('Touchdown event received:', data);
      
      // Set touchdown data and mark as landed
      setTouchdownData(data);
      setHasLanded(true);
      lastTouchdownRef.current = Date.now();
      
      // Trigger appropriate audio if landing was good
      if (data.normalVelocity < -200) {
        console.log('Hard landing detected, skipping arrival announcement');
      } else if (weveArrivedRef.current && !landingSoonAnnouncedRef.current) {
        console.log('Playing arrival announcement after touchdown');
        playAltitudeAnnouncement(weveArrivedRef, 'we\'ve arrived');
      }
    } catch (error) {
      console.error('Error handling touchdown event:', error);
    }
  };

  // Function to handle landing lights events
  const handleLandingLightsEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid landing lights event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('Landing lights event received:', data);
      handleLandingLightsChange(data.state);
    } catch (error) {
      console.error('Error handling landing lights event:', error);
    }
  };

  // Function to handle beacon light events
  const handleBeaconLightEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid beacon light event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('=== Beacon Light Event Received ===');
      console.log('Beacon light event received:', data);
      console.log('Current beacon state:', lastBeaconLightStateRef.current ? 'ON' : 'OFF');
      
      // Handle the state change
      handleBeaconLightChange(data.state);
      console.log('=== End Beacon Light Event ===');
    } catch (error) {
      console.error('Error handling beacon light event:', error);
    }
  };

  // Function to handle seatbelt sign events
  const handleSeatbeltSignEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid seatbelt sign event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('Seatbelt sign event received:', data);
      handleSeatbeltSignChange(data.state);
    } catch (error) {
      console.error('Error handling seatbelt sign event:', error);
    }
  };

  // Function to handle wing light state changes
  const handleWingLightChange = (newState: boolean) => {
    console.log('=== Wing Light State Change ===');
    console.log(`Previous state: ${flightState.wingLight ? 'ON' : 'OFF'}`);
    console.log(`New State: ${newState ? 'ON' : 'OFF'}`);
    console.log(`Current count: ${wingLightCount}`);
    
    // Only update if the state actually changed
    if (flightState.wingLight !== newState) {
      console.log('State changed, updating flight state...');
      
      // If wing light was turned ON (transition from OFF to ON)
      if (!lastWingLightStateRef.current && newState) {
        // Increment the count
        setWingLightCount(prevCount => {
          const newCount = prevCount + 1;
          console.log(`Incrementing wing light count from ${prevCount} to ${newCount}`);
          
          // If audio is currently playing, don't interrupt it
          if (isWingLightAudioPlayingRef.current) {
            console.log('Wing light audio already playing, ignoring event');
            return newCount;
          }
          
          // Play announcement if count is 1 or less
          if (newCount <= 1) {
            console.log('Playing "Seats For Departure" announcement (wing light count is 1 or less)');
            if (seatsForDepartureRef.current) {
              // Set flag to track that wing light audio is playing
              isWingLightAudioPlayingRef.current = true;
              
              // Play announcement with proper volume
              playAnnouncementWithVolume(seatsForDepartureRef, 'seats_for_departure', () => {
                console.log('Seats for departure announcement finished, resetting flag');
                isWingLightAudioPlayingRef.current = false;
              });
            } else {
              console.error('Seats for departure audio element not found');
            }
          } else {
            console.log('Not playing announcement - wing light count is greater than 1');
          }
          
          return newCount;
        });
      }
      
      // Update the last state after processing the change
      lastWingLightStateRef.current = newState;
      setFlightState(prev => ({
        ...prev,
        wingLight: newState
      }));
    } else {
      console.log('State unchanged, no update needed');
    }
    
    console.log('=== End Wing Light State Change ===');
  };

  // Function to handle wing light events
  const handleWingLightEvent = (event: any) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid wing light event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('Wing light event received:', data);
      handleWingLightChange(data.state);
    } catch (error) {
      console.error('Error handling wing light event:', error);
    }
  };

  // Set up event listeners
  useEffect(() => {
    // Subscribe to events from SimConnect
    const handleSimConnectEvent = (event: any) => {
      try {
        if (event?.type === 'SIM_CONNECT_DATA') {
          if (event.payload) {
            handleSimConnectData(event.payload);
          }
        } else if (event?.type === 'CAMERA_POSITION') {
          handleCameraPositionEvent(event);
        } else if (event?.type === 'TOUCHDOWN') {
          handleTouchdownEvent(event);
        } else if (event?.type === 'LANDING_LIGHTS') {
          handleLandingLightsEvent(event);
        } else if (event?.type === 'BEACON_LIGHT') {
          handleBeaconLightEvent(event);
        } else if (event?.type === 'WING_LIGHT') {
          handleWingLightEvent(event);
        } else if (event?.type === 'SEATBELT_SIGN') {
          handleSeatbeltSignEvent(event);
        } else if (event?.type === 'GSX_BYPASS_PIN') {
          handleGsxBypassPin(event);
        } else if (event?.type === 'AUDIO') {
          handleAudioEvent(event);
        } else {
          console.log('Unknown event received:', event);
        }
      } catch (error) {
        console.error('Error handling event:', error);
      }
    };

    // Set up event listener for simconnect-data
    const unsubscribe = listen('simconnect-data', handleSimConnectEvent);
    
    // Set up event listener for wing-light-changed with more logging
    console.log('Setting up wing-light-changed event listener');
    const unsubscribeWingLight = listen('wing-light-changed', (event: { payload: { state: boolean } }) => {
      console.log('Wing light changed event received:', event);
      if (event && event.payload && typeof event.payload.state === 'boolean') {
        console.log(`Wing light state changed to ${event.payload.state ? 'ON' : 'OFF'}`);
        handleWingLightChange(event.payload.state);
      } else {
        console.error('Invalid wing light event payload:', event);
      }
    });
    
    // Debug other events - remove the wildcard listener since it's causing issues
    // const unsubscribeDebug = listen('*', (event) => {
    //   // Filter out common events to avoid noise
    //   if (!event.event.startsWith('tauri://') && 
    //       event.event !== 'simconnect-data' &&
    //       !['window-resized', 'window-moved', 'window-focus'].includes(event.event)) {
    //     console.log(`Received event: ${event.event}`, event);
    //   }
    // });

    // Replace with a specific listener for unknown events
    const unsubscribeDebug = listen('unknown-event', (event) => {
      console.log(`Received unknown event:`, event);
    });
    
    // Cleanup
    return () => {
      console.log('Cleaning up event listeners');
      if (unsubscribe) {
        unsubscribe.then(fn => fn());
      }
      if (unsubscribeWingLight) {
        unsubscribeWingLight.then(fn => fn());
      }
      if (unsubscribeDebug) {
        unsubscribeDebug.then(fn => fn());
      }
    };
  }, [flightState.zPosition, masterVolume]); // Restore original dependency array

  // Listen for simconnect data
  const unlistenSimconnect = listen('simconnect-data', (event) => {
    try {
      // Ensure we have a valid payload
      if (!event || !event.payload) {
        console.error('Invalid simconnect data event:', event);
        return;
      }

      // Debug the entire payload to check what's being received
      console.log('SIMCONNECT DEBUG - Raw payload:', JSON.stringify(event.payload));

      const data = event.payload as { 
        alt?: number, 
        tenKAnnounced?: boolean,
        jetwayMoving?: boolean,
        jetwayState?: boolean,
        lastRequestWasAttach?: boolean,
        boardingMusicPlaying?: boolean,
        welcomeAboardPlaying?: boolean,
        seatbeltSign?: boolean,
        beaconLight?: boolean,
        landingLights?: number,
        cameraPosition?: string,
        cameraViewType?: string,
        volumeLevel?: number,
        xPosition?: number,
        yPosition?: number,
        zPosition?: number,
        touchdownNormalVelocity?: number,
        touchdownBankDegrees?: number,
        touchdownPitchDegrees?: number,
        touchdownHeadingDegrees?: number,
        touchdownLateralVelocity?: number,
        touchdownLongitudinalVelocity?: number,
        gsxBypassPin?: boolean,
        wingLight?: boolean,
        aircraftType?: string // Added for aircraft detection
      };
      
      // Enhanced debugging for beacon light and seatbelt sign properties
      console.log('SIMCONNECT DEBUG - Specific property check:');
      console.log('  beaconLight property:', {
        value: data.beaconLight,
        type: typeof data.beaconLight,
        exists: 'beaconLight' in data
      });
      console.log('  seatbeltSign property:', {
        value: data.seatbeltSign,
        type: typeof data.seatbeltSign,
        exists: 'seatbeltSign' in data
      });
      
      // Debug for all property names in the payload
      console.log('SIMCONNECT DEBUG - All property names:', Object.keys(event.payload));

      // Handle altitude data
      if (typeof data.alt === 'number' && !isNaN(data.alt)) {
        const currentAlt = data.alt;
        const lastAlt = lastAltitudeRef.current;
        
        // Only process if altitude has actually changed
        if (currentAlt !== lastAlt) {
          console.log(`Altitude changed: ${lastAlt} -> ${currentAlt} feet`);
          
          // Update flight state with new altitude
          setFlightState(prev => ({
            ...prev,
            altitude: currentAlt
          }));
          
          // Check for 10k feet announcement during climb
          if (lastAlt < 10000 && currentAlt >= 10000 && !tenKAnnouncedRef.current) {
            console.log('Climbing through 10k feet - triggering announcement');
            tenKAnnouncedRef.current = true;
            hasDescendedThrough10kRef.current = false; // Reset descent flag
            
            // Play 10k feet announcement
            if (tenKFeetRef.current) {
              console.log('Playing 10k feet announcement');
              const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
              const zone = getCurrentZone([currentZ, 0, 0]);
              const baseVolume = getZoneVolume(zone);
              const logVolume = toLogVolume(baseVolume * 100);
              const positionVolume = (masterVolume / 100) * logVolume;
              
              tenKFeetRef.current.volume = positionVolume;
              tenKFeetRef.current.currentTime = 0;
              tenKFeetRef.current.play()
                .then(() => {
                  console.log('Successfully started playing 10k feet announcement');
                  setIsPlaying(true);
                  setCurrentAudioName('10k_feet');
                  setCurrentAudioVolume(positionVolume * 100);
                  setCurrentZone(zone);
                })
                .catch(error => {
                  console.error('Error playing 10k feet announcement:', error);
                });
            }
          }
          
          // Check for arrival announcements at 18,000 feet during descent
          if (lastAlt > 18000 && currentAlt <= 18000 && !arriveSoonAnnouncedRef.current) {
            console.log('Descending through 18,000 feet - triggering arrival soon announcement');
            arriveSoonAnnouncedRef.current = true;
            
            // Play arrive soon announcement
            if (arriveSoonRef.current) {
              console.log('Playing arrive soon announcement');
              const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
              const zone = getCurrentZone([currentZ, 0, 0]);
              const baseVolume = getZoneVolume(zone);
              const logVolume = toLogVolume(baseVolume * 100);
              const positionVolume = (masterVolume / 100) * logVolume;
              
              arriveSoonRef.current.volume = positionVolume;
              arriveSoonRef.current.currentTime = 0;
              arriveSoonRef.current.play()
                .then(() => {
                  console.log('Successfully started playing arrive soon announcement');
                  setIsPlaying(true);
                  setCurrentAudioName('arrive_soon');
                  setCurrentAudioVolume(positionVolume * 100);
                  setCurrentZone(zone);
                })
                .catch(error => {
                  console.error('Error playing arrive soon announcement:', error);
                });
            }
          }
          
          // Check if we're descending through 10k feet
          if (lastAlt > 10000 && currentAlt <= 10000) {
            console.log('Descending through 10k feet');
            hasDescendedThrough10kRef.current = true;
            setHasDescendedThrough10k(true);
            tenKAnnouncedRef.current = false; // Reset climb flag
            
            // Check for landing announcement at 10,000 feet during descent
            if (!landingSoonAnnouncedRef.current) {
              console.log('Below 10,000 feet - triggering landing soon announcement');
              landingSoonAnnouncedRef.current = true;
              
              // Play landing soon announcement using the playAnnouncementWithVolume function instead
              // which properly handles audio playback with cleanup
              if (landingSoonRef.current) {
                console.log('Playing landing soon announcement');
                // Use the helper function for consistent audio playback management
                playAnnouncementWithVolume(landingSoonRef, 'landing_soon', () => {
                  console.log('Landing soon announcement completed');
                  // Make sure the flag stays true even after playback ends
                  landingSoonAnnouncedRef.current = true;
                });
              }
            }
          }
          
          // Update last altitude
          lastAltitudeRef.current = currentAlt;
        }
      }
      
      // Handle landing lights state changes
      if (typeof data.landingLights === 'number') {
        console.log(`Received landing lights value: ${data.landingLights}`);
        // 2 = ON, 1 = OFF
        const newState = data.landingLights === 2;
        console.log(`Current landing lights state: ${lastLandingLightsStateRef.current}, New state: ${newState}`);
        handleLandingLightsChange(newState);
      }
      
      // Handle camera position updates
      if (typeof data.zPosition === 'number' && !isNaN(data.zPosition)) {
        const newZPosition = data.zPosition;
        const previousZPosition = lastCameraZRef.current || 0;
        const positionDelta = Math.abs(newZPosition - previousZPosition);
        
        // Only update if position has changed significantly
        if (positionDelta >= POSITION_THRESHOLD) {
          console.log(`Significant camera Z position change: ${previousZPosition} -> ${newZPosition}, delta: ${positionDelta}`);
          
          setFlightState(prevState => ({
            ...prevState,
            xPosition: data.xPosition ?? prevState.xPosition,
            yPosition: data.yPosition ?? prevState.yPosition,
            zPosition: newZPosition,
            speed: 0, // Default speed
            heading: 0, // Default heading
            altitude: data.alt ?? prevState.altitude,
            cameraViewType: data.cameraViewType ?? prevState.cameraViewType,
            beaconLight: data.beaconLight ?? prevState.beaconLight,
            seatbeltSign: data.seatbeltSign ?? prevState.seatbeltSign,
            jetwayMoving: data.jetwayMoving ?? prevState.jetwayMoving,
            jetwayState: data.jetwayState ? 1 : 0,
            wingLight: data.wingLight ?? prevState.wingLight
          }));
          
          // Update both position references to maintain consistency
          lastCameraZRef.current = newZPosition;
          
          // Call updateAllAudioVolumes which will do its own additional checks
          updateAllAudioVolumes();
        } else {
          // Position change too small, ignore it to avoid UI flicker
          console.log(`Ignoring small camera Z position change: ${previousZPosition} -> ${newZPosition}, delta: ${positionDelta}`);
        }
      }
      
      // Handle jetway state changes
      if (data.jetwayState === true || data.jetwayState === false) {
        const wasAttached = jetwayAttachedRef.current;
        const newJetwayState = data.jetwayState as boolean;
        
        if (wasAttached !== newJetwayState) {
          setTimeout(() => {
            if (jetwayAttachedRef.current !== newJetwayState) {
              jetwayAttachedRef.current = newJetwayState;
              handleJetwayStateChange(newJetwayState);
            }
          }, 500);
        }
      }
      
      // Update other states
      if (typeof data.seatbeltSign === 'boolean') {
        console.log('SIMCONNECT DEBUG - Received valid seatbelt sign state change:', data.seatbeltSign);
        console.log('Current seatbelt sign state:', seatbeltSign);
        console.log('Current seatbelt sign count:', seatbeltSignCountRef.current);
        handleSeatbeltSignChange(data.seatbeltSign);
      } else {
        console.log('SIMCONNECT DEBUG - Seatbelt sign data is not a boolean:', data.seatbeltSign);
      }
      
      if (typeof data.beaconLight === 'boolean') {
        console.log('=== SimConnect Beacon Light State ===');
        console.log('SimConnect: Received valid beacon light state change:', data.beaconLight ? 'ON' : 'OFF');
        console.log('SimConnect: Current cached beacon light state:', lastBeaconLightStateRef.current ? 'ON' : 'OFF');
        
        // Process the state change through the dedicated handler
        handleBeaconLightChange(data.beaconLight);
        console.log('=== End SimConnect Beacon Light State ===');
      } else {
        console.log('SimConnect: Beacon light data not a boolean:', data.beaconLight);
      }
      
      if (typeof data.gsxBypassPin === 'boolean') {
        // Skip if we've already played the safety video for this flight
        if (safetyVideoPlayedRef.current) {
          console.log('Skipping GSX bypass pin update - safety video already played for this flight');
          return;
        }

        const now = Date.now();
        if (now - lastGsxBypassPinUpdateRef.current < GSX_BYPASS_PIN_DEBOUNCE_TIME) {
          console.log('Skipping GSX bypass pin update - too soon since last update');
          return;
        }

        console.log('GSX bypass pin state changed:', data.gsxBypassPin);
        const oldState = gsxBypassPin;
        setGsxBypassPin(data.gsxBypassPin);
        lastGsxBypassPinUpdateRef.current = now;
        
        // If pin was just inserted, play safety video
        if (data.gsxBypassPin && !oldState) {
          console.log('GSX bypass pin inserted - preparing to play safety video');
          
          // Function to attempt playing the safety video
          const playSafetyVideo = () => {
            if (!safetyVideoRef.current) {
              console.error('Safety video audio element not found');
              return;
            }

            // Ensure audio is ready
            if (safetyVideoRef.current.readyState < 2) {
              console.log('Safety video audio not ready yet, waiting...');
              setTimeout(playSafetyVideo, 1000); // Retry after 1 second
              return;
            }

            // Stop any currently playing safety video
            safetyVideoRef.current.pause();
            safetyVideoRef.current.currentTime = 0;
            
            // Lower boarding music volume before playing safety video
            if (boardingMusicRef.current) {
              console.log('Lowering boarding music volume for safety video');
              boardingMusicRef.current.volume = 0.2;
            }
            
            // Set safety video volume based on current zone
            const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
            const zone = getCurrentZone([currentZ, 0, 0]);
            const baseVolume = getZoneVolume(zone);
            const logVolume = toLogVolume(baseVolume * 100);
            const positionVolume = (masterVolume / 100) * logVolume;
            
            console.log('Volume calculation:', {
              currentZ,
              zone,
              baseVolume,
              logVolume,
              positionVolume,
              masterVolume
            });
            
            safetyVideoRef.current.volume = positionVolume;
            safetyVideoRef.current.currentTime = 0; // Reset to start
            
            safetyVideoRef.current.play()
              .then(() => {
                console.log('Successfully started playing safety video');
                setIsPlaying(true);
                setCurrentAudioName('safety_video');
                setCurrentAudioVolume(positionVolume * 100);
                setCurrentZone(zone);
                safetyVideoPlayedRef.current = true; // Mark safety video as played
                
                // Add event listener for when the audio ends
                safetyVideoRef.current?.addEventListener('ended', () => {
                  console.log('Safety video finished playing');
                  setIsPlaying(false);
                  setCurrentAudioName('');
                  
                  // Restore boarding music volume after safety video finishes
                  if (boardingMusicRef.current) {
                    console.log('Restoring boarding music volume');
                    boardingMusicRef.current.volume = 1.0;
                  }
                }, { once: true });
              })
              .catch(error => {
                console.error('Error playing safety video:', error);
                setIsPlaying(false);
                setCurrentAudioName('');
                
                // Restore boarding music volume on error
                if (boardingMusicRef.current) {
                  console.log('Restoring boarding music volume after error');
                  boardingMusicRef.current.volume = 1.0;
                }
              });
          };

          // Start the playback process with a small delay to ensure everything is ready
          setTimeout(playSafetyVideo, 1000);
        }
      }

      // Handle touchdown detection
      if (typeof data.touchdownNormalVelocity === 'number' && data.touchdownNormalVelocity !== 0) {
        const now = Date.now();
        // Only trigger landing detection if it's been more than 5 seconds since last touchdown
        if (now - lastTouchdownRef.current > 5000) {
          const touchdownInfo = {
            normalVelocity: data.touchdownNormalVelocity,
            bankDegrees: data.touchdownBankDegrees || 0,
            pitchDegrees: data.touchdownPitchDegrees || 0,
            headingDegrees: data.touchdownHeadingDegrees || 0,
            lateralVelocity: data.touchdownLateralVelocity || 0,
            longitudinalVelocity: data.touchdownLongitudinalVelocity || 0
          };
          
          console.log('Touchdown detected!', touchdownInfo);
          setTouchdownData(touchdownInfo);
          setHasLanded(true);
          lastTouchdownRef.current = now;
          
          // If we've descended through 10k and landing lights are off, play "We've arrived"
          if (hasDescendedThrough10k && landingLightsOffCount >= 2) {
            console.log('Playing "We\'ve arrived" announcement after touchdown');
            handleAudioEvent({ name: 'weve-arrived', action: 'play' });
          }
        }
      }

      // Handle aircraft type detection
      if (data.aircraftType && data.aircraftType !== flightState.aircraftType) {
        console.log(`Aircraft type detected: ${data.aircraftType}`);
        
        // Update the flight state with the detected aircraft type
        setFlightState(prevState => ({
          ...prevState,
          aircraftType: data.aircraftType
        }));
        
        // If in auto-detection mode, attempt to select appropriate aircraft config
        if (aircraftDetectionMode === 'auto') {
          // Try direct match first
          const aircraftConfigs = getAircraftConfigs();
          if (aircraftConfigs[data.aircraftType]) {
            console.log(`Found exact match for aircraft: ${data.aircraftType}`);
            setSelectedAircraftType(data.aircraftType);
            localStorage.setItem('selectedAircraftType', data.aircraftType);
          } else {
            // Try fuzzy matching based on aircraft type name
            const typeLC = data.aircraftType.toLowerCase();
            
            // A320 family detection with specific variants
            if (typeLC.includes('a319')) {
              console.log('Detected Airbus A319 aircraft');
              setSelectedAircraftType('A319');
              localStorage.setItem('selectedAircraftType', 'A319');
            } else if (typeLC.includes('a321')) {
              console.log('Detected Airbus A321 aircraft');
              setSelectedAircraftType('A321');
              localStorage.setItem('selectedAircraftType', 'A321');
            } else if (typeLC.includes('a320')) {
              console.log('Detected Airbus A320 aircraft');
              setSelectedAircraftType('A320');
              localStorage.setItem('selectedAircraftType', 'A320');
            }
            
            // A350 family detection
            else if (typeLC.includes('a350-1000')) {
              console.log('Detected Airbus A350-1000 aircraft');
              setSelectedAircraftType('A350-1000');
              localStorage.setItem('selectedAircraftType', 'A350-1000');
            } else if (typeLC.includes('a350-900')) {
              console.log('Detected Airbus A350-900 aircraft');
              setSelectedAircraftType('A350-900');
              localStorage.setItem('selectedAircraftType', 'A350-900');
            } else if (typeLC.includes('a350')) {
              console.log('Detected Airbus A350 family aircraft (generic)');
              setSelectedAircraftType('A350');
              localStorage.setItem('selectedAircraftType', 'A350');
            }
            
            // 737 family detection with specific variants
            else if (typeLC.includes('737-700')) {
              console.log('Detected Boeing 737-700 aircraft');
              setSelectedAircraftType('B737-700');
              localStorage.setItem('selectedAircraftType', 'B737-700');
            } else if (typeLC.includes('737-800')) {
              console.log('Detected Boeing 737-800 aircraft');
              setSelectedAircraftType('B737-800');
              localStorage.setItem('selectedAircraftType', 'B737-800');
            } else if (typeLC.includes('737-900')) {
              console.log('Detected Boeing 737-900 aircraft');
              setSelectedAircraftType('B737-900');
              localStorage.setItem('selectedAircraftType', 'B737-900');
            } else if (typeLC.includes('737')) {
              console.log('Detected Boeing 737 family aircraft (generic)');
              setSelectedAircraftType('B737');
              localStorage.setItem('selectedAircraftType', 'B737');
            }
            
            // 787 family detection
            else if (typeLC.includes('787-8')) {
              console.log('Detected Boeing 787-8 aircraft');
              setSelectedAircraftType('B787-8');
              localStorage.setItem('selectedAircraftType', 'B787-8');
            } else if (typeLC.includes('787-9')) {
              console.log('Detected Boeing 787-9 aircraft');
              setSelectedAircraftType('B787-9');
              localStorage.setItem('selectedAircraftType', 'B787-9');
            } else if (typeLC.includes('787-10')) {
              console.log('Detected Boeing 787-10 aircraft');
              setSelectedAircraftType('B787-10');
              localStorage.setItem('selectedAircraftType', 'B787-10');
            } else if (typeLC.includes('787') || typeLC.includes('dreamliner')) {
              console.log('Detected Boeing 787 family aircraft (generic)');
              setSelectedAircraftType('B787');
              localStorage.setItem('selectedAircraftType', 'B787');
            }
            
            // Other aircraft families
            else if (typeLC.includes('crj')) {
              console.log('Detected CRJ family aircraft');
              setSelectedAircraftType('CRJ');
              localStorage.setItem('selectedAircraftType', 'CRJ');
            } else if (typeLC.includes('embraer') || typeLC.includes('e-jet') || 
                     typeLC.includes('e170') || typeLC.includes('e190')) {
              console.log('Detected Embraer family aircraft');
              setSelectedAircraftType('E-Jet');
              localStorage.setItem('selectedAircraftType', 'E-Jet');
            } else if (typeLC.includes('747')) {
              console.log('Detected Boeing 747 aircraft');
              setSelectedAircraftType('B747');
              localStorage.setItem('selectedAircraftType', 'B747');
            }
          }
        } else {
          console.log('Aircraft auto-detection disabled, using manually selected aircraft type');
        }
      }
    } catch (error) {
      console.error('Error processing simconnect data:', error);
    }
  });

  // Listen for landing lights changes
  const unlistenLandingLights = listen('landing-lights-changed', (event) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid landing lights event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('Landing lights event received:', data);
      handleLandingLightsChange(data.state);
    } catch (error) {
      console.error('Error processing landing lights change:', error);
    }
  });

  // Listen for beacon light changes
  const unlistenBeaconLight = listen('beacon-light-changed', (event) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid beacon light event:', event);
        return;
      }

      const data = event.payload as { state: boolean };
      console.log('Beacon light event received:', data);
      handleBeaconLightChange(data.state);
      
      // Also update the flight state
      setFlightState(prev => ({
        ...prev,
        beaconLight: data.state
      }));
    } catch (error) {
      console.error('Error processing beacon light change:', error);
    }
  });

  // Listen for seatbelt sign changes
  const unlistenSeatbeltSign = listen('seatbelt-switch-changed', (event) => {
    try {
      if (!event || !event.payload) {
        console.error('Invalid seatbelt sign event:', event);
        return;
      }

      const data = event.payload as { state: boolean, resetCount?: boolean };
      console.log('Seatbelt sign event received:', data);
      
      // Reset the count if needed (e.g., during flight reset or new flight)
      if (data.resetCount) {
        console.log('Resetting seatbelt sign count to 0');
        seatbeltSignCountRef.current = 0;
        setSeatbeltSignCount(0);
      }
      
      handleSeatbeltSignChange(data.state);
      
      // Also update the flight state
      setFlightState(prev => ({
        ...prev,
        seatbeltSign: data.state
      }));
    } catch (error) {
      console.error('Error processing seatbelt sign change:', error);
    }
  });

  // Helper function to handle jetway state changes
  const handleJetwayStateChange = (newJetwayState: boolean) => {
    if (newJetwayState) {
      // Jetway attached - start boarding sequence
      console.log('Jetway attached - starting boarding sequence');
      
      // Stop any existing audio and clear any existing timers
      if (welcomeAboardTimerRef.current) {
        console.log('Clearing existing welcome aboard timer');
        clearInterval(welcomeAboardTimerRef.current);
        welcomeAboardTimerRef.current = null;
      }
      
      [boardingMusicRef, welcomeAboardRef, doorsAutoRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      
      // Start boarding music
      if (boardingMusicRef.current) {
        boardingMusicRef.current.volume = 1.0;
        boardingMusicRef.current.play().catch(error => {
          console.error('Error playing boarding music:', error);
        });
      }

      // Play first welcome aboard after a delay
      setTimeout(() => {
        if (welcomeAboardRef.current && jetwayAttachedRef.current) {
          console.log('Playing first welcome aboard announcement');
          // Ensure audio is ready before playing
          if (welcomeAboardRef.current.readyState >= 2) {
            if (boardingMusicRef.current) {
              boardingMusicRef.current.volume = 0.05;
            }
            welcomeAboardRef.current.currentTime = 0;
            welcomeAboardRef.current.play()
              .then(() => {
                console.log('Successfully started playing first welcome aboard announcement');
                // Add event listener for when the audio ends
                welcomeAboardRef.current?.addEventListener('ended', () => {
                  console.log('First welcome aboard announcement finished playing');
                  // Restore boarding music volume after welcome aboard finishes
                  if (boardingMusicRef.current) {
                    boardingMusicRef.current.volume = 1.0;
                  }
                  
                  // Schedule next announcement only if the "Almost ready" is not playing
                  if (!isAlmostReadyPlayingRef.current) {
                    const nextInterval = Math.floor(Math.random() * (140000 - 30000) + 30000);
                    console.log(`Scheduling next welcome aboard announcement in ${nextInterval/1000} seconds`);
                    welcomeAboardTimerRef.current = window.setTimeout(() => {
                      if (welcomeAboardRef.current && jetwayAttachedRef.current) {
                        console.log('Playing welcome aboard announcement after "Almost ready" finished');
                        if (boardingMusicRef.current) {
                          boardingMusicRef.current.volume = 0.05;
                        }
                        welcomeAboardRef.current.currentTime = 0;
                        welcomeAboardRef.current.play()
                          .then(() => {
                            console.log('Successfully started playing welcome aboard announcement');
                            welcomeAboardRef.current?.addEventListener('ended', () => {
                              console.log('Welcome aboard announcement finished playing');
                              if (boardingMusicRef.current) {
                                boardingMusicRef.current.volume = 1.0;
                              }
                              
                              // Schedule next announcement only if the "Almost ready" is not playing
                              if (!isAlmostReadyPlayingRef.current) {
                                const nextInterval = Math.floor(Math.random() * (140000 - 30000) + 30000);
                                console.log(`Scheduling next welcome aboard announcement in ${nextInterval/1000} seconds`);
                                welcomeAboardTimerRef.current = window.setTimeout(() => {
                                  if (welcomeAboardRef.current && jetwayAttachedRef.current && !isAlmostReadyPlayingRef.current) {
                                    console.log('Playing subsequent welcome aboard announcement');
                                    if (boardingMusicRef.current) {
                                      boardingMusicRef.current.volume = 0.05;
                                    }
                                    welcomeAboardRef.current.currentTime = 0;
                                    welcomeAboardRef.current.play()
                                      .then(() => {
                                        console.log('Successfully started playing subsequent welcome aboard announcement');
                                        welcomeAboardRef.current?.addEventListener('ended', () => {
                                          console.log('Subsequent welcome aboard announcement finished playing');
                                          if (boardingMusicRef.current) {
                                            boardingMusicRef.current.volume = 1.0;
                                          }
                                        }, { once: true });
                                      })
                                      .catch(error => {
                                        console.error('Error playing subsequent welcome aboard:', error);
                                      });
                                  }
                                }, nextInterval);
                              }
                            }, { once: true });
                          })
                          .catch(error => {
                            console.error('Error playing first welcome aboard:', error);
                          });
                      }
                    }, nextInterval);
                  }
                }, { once: true });
              })
              .catch(error => {
                console.error('Error playing first welcome aboard:', error);
              });
          } else {
            console.log('Welcome aboard audio not ready yet. ReadyState:', welcomeAboardRef.current.readyState);
            // Wait for audio to be ready
            welcomeAboardRef.current.addEventListener('canplaythrough', () => {
              console.log('Welcome aboard audio is now ready to play');
              if (boardingMusicRef.current) {
                boardingMusicRef.current.volume = 0.05;
              }
              welcomeAboardRef.current?.play()
                .then(() => {
                  console.log('Successfully started playing first welcome aboard announcement after waiting');
                  // Add event listener for when the audio ends
                  welcomeAboardRef.current?.addEventListener('ended', () => {
                    console.log('First welcome aboard announcement finished playing');
                    // Restore boarding music volume after welcome aboard finishes
                    if (boardingMusicRef.current) {
                      boardingMusicRef.current.volume = 1.0;
                    }
                    
                    // Schedule next announcement only if the "Almost ready" is not playing
                    if (!isAlmostReadyPlayingRef.current) {
                      const nextInterval = Math.floor(Math.random() * (140000 - 30000) + 30000);
                      console.log(`Scheduling next welcome aboard announcement in ${nextInterval/1000} seconds`);
                      welcomeAboardTimerRef.current = window.setTimeout(() => {
                        if (welcomeAboardRef.current && jetwayAttachedRef.current && !isAlmostReadyPlayingRef.current) {
                          console.log('Playing welcome aboard announcement after "Almost ready" finished');
                          if (boardingMusicRef.current) {
                            boardingMusicRef.current.volume = 0.05;
                          }
                          welcomeAboardRef.current.currentTime = 0;
                          welcomeAboardRef.current.play()
                            .then(() => {
                              console.log('Successfully started playing welcome aboard announcement');
                              welcomeAboardRef.current?.addEventListener('ended', () => {
                                console.log('Welcome aboard announcement finished playing');
                                if (boardingMusicRef.current) {
                                  boardingMusicRef.current.volume = 1.0;
                                }
                                
                                // Schedule next announcement only if the "Almost ready" is not playing
                                if (!isAlmostReadyPlayingRef.current) {
                                  const nextInterval = Math.floor(Math.random() * (140000 - 30000) + 30000);
                                  console.log(`Scheduling next welcome aboard announcement in ${nextInterval/1000} seconds`);
                                  welcomeAboardTimerRef.current = window.setTimeout(() => {
                                    if (welcomeAboardRef.current && jetwayAttachedRef.current && !isAlmostReadyPlayingRef.current) {
                                      console.log('Playing subsequent welcome aboard announcement');
                                      if (boardingMusicRef.current) {
                                        boardingMusicRef.current.volume = 0.05;
                                      }
                                      welcomeAboardRef.current.currentTime = 0;
                                      welcomeAboardRef.current.play()
                                        .then(() => {
                                          console.log('Successfully started playing subsequent welcome aboard announcement');
                                          welcomeAboardRef.current?.addEventListener('ended', () => {
                                            console.log('Subsequent welcome aboard announcement finished playing');
                                            if (boardingMusicRef.current) {
                                              boardingMusicRef.current.volume = 1.0;
                                            }
                                          }, { once: true });
                                        })
                                        .catch(error => {
                                          console.error('Error playing subsequent welcome aboard:', error);
                                        });
                                    }
                                  }, nextInterval);
                                }
                              }, { once: true });
                            })
                            .catch(error => {
                              console.error('Error playing welcome aboard:', error);
                            });
                        }
                      }, nextInterval);
                    }
                  }, { once: true });
                })
                .catch(error => {
                  console.error('Error playing first welcome aboard after waiting:', error);
                });
            }, { once: true });
          }
        }
      }, 10000);
    } else {
      // Jetway detached - stop all audio and play doors auto
      console.log('Jetway detached - stopping welcome aboard announcements');
      
      // Clear any welcome aboard timers
      if (welcomeAboardTimerRef.current) {
        console.log('Clearing welcome aboard announcement timer');
        clearTimeout(welcomeAboardTimerRef.current);
        welcomeAboardTimerRef.current = null;
      }
      
      // Stop audio playback
      [boardingMusicRef, welcomeAboardRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      
      // Play doors auto after delay
      setTimeout(() => {
        if (doorsAutoRef.current) {
          console.log('Playing doors auto announcement');
          doorsAutoRef.current.currentTime = 0;
          doorsAutoRef.current.play().catch(error => {
            console.error('Error playing doors auto:', error);
          });
        }
      }, 15000);
    }
  };

  // Add function to handle volume changes
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(event.target.value);
    setMasterVolume(newVolume);
    updateAllAudioVolumes();
  };

  // Add altitude change logging
  useEffect(() => {
    if (flightState.altitude !== undefined) {
      console.log('Altitude changed:', flightState.altitude, 'feet');
    }
  }, [flightState.altitude]);

  // Initialize audio elements
  useEffect(() => {
    console.log('Initializing audio files...');
    
    // Add a 3-second delay before initializing audio files
    const initializeAudioWithDelay = () => {
      console.log('Starting audio initialization after delay...');
      
      const initAudio = (ref: React.MutableRefObject<HTMLAudioElement | null>, src: string, id: string, loop: boolean = false) => {
        if (ref.current) {
          console.log(`Audio element ${id} already initialized`);
          return;
        }

        console.log(`Initializing audio: ${src}`);
        ref.current = new Audio();
        ref.current.src = src;
        ref.current.preload = 'auto';
        ref.current.id = id;
        if (loop) ref.current.loop = true;
        
        // Add error handling with retry logic
        const handleError = (error: any) => {
          console.error(`Error loading audio file ${src}:`, error);
          // Try to load the file again after a short delay
          setTimeout(() => {
            if (ref.current) {
              console.log(`Retrying to load audio file: ${src}`);
              ref.current.load();
            }
          }, 1000);
        };
        
        ref.current.onerror = handleError;
        
        // Add load event listener
        ref.current.addEventListener('loadeddata', () => {
          console.log(`Audio file loaded: ${src}, readyState: ${ref.current?.readyState}`);
        });

        // Add error event listener
        ref.current.addEventListener('error', handleError);

        // Add abort event listener
        ref.current.addEventListener('abort', () => {
          console.log(`Loading of audio file ${src} was aborted`);
          // Try to load the file again after a short delay
          setTimeout(() => {
            if (ref.current) {
              console.log(`Retrying to load audio file: ${src}`);
              ref.current.load();
            }
          }, 1000);
        });

        // Add canplaythrough event listener
        ref.current.addEventListener('canplaythrough', () => {
          console.log(`Successfully loaded audio file: ${src}`);
        });
      };

      // Initialize all audio elements with proper paths
      initAudio(boardingMusicRef, '/sounds/announcements/Boarding-Music.mp3', 'boarding_music', true);
      initAudio(welcomeAboardRef, '/sounds/announcements/Welcome Aboard.wav', 'welcome_aboard');
      initAudio(doorsAutoRef, '/sounds/announcements/Doors-to-Auto.wav', 'doors_auto');
      initAudio(tenKFeetRef, '/sounds/announcements/10k-feet.wav', '10k_feet');
      initAudio(arriveSoonRef, '/sounds/announcements/Arrive-soon.wav', 'arrive_soon');
      initAudio(landingSoonRef, '/sounds/announcements/landing-soon.wav', 'landing_soon');
      initAudio(weveArrivedRef, '/sounds/announcements/We\'ve-arrvied.wav', 'weve_arrived');
      initAudio(almostReadyRef, '/sounds/announcements/Almost-ready-to-go.wav', 'almost_ready');
      initAudio(seatsForDepartureRef, '/sounds/announcements/Seats-For-Departure.wav', 'seats_for_departure');
      initAudio(safetyVideoRef, '/sounds/announcements/A319-Safety-Video.mp3', 'safety_video');
      initAudio(fastenSeatbeltRef, '/sounds/announcements/fasten-seatbelt.mp3', 'fasten_seatbelt');

      // Add a check to verify all audio elements are loaded
      const checkAudioElements = () => {
        const audioRefs = [
          { ref: boardingMusicRef, name: 'boarding music' },
          { ref: welcomeAboardRef, name: 'welcome aboard' },
          { ref: doorsAutoRef, name: 'doors auto' },
          { ref: tenKFeetRef, name: '10k feet' },
          { ref: arriveSoonRef, name: 'arrive soon' },
          { ref: landingSoonRef, name: 'landing soon' },
          { ref: weveArrivedRef, name: 'weve arrived' },
          { ref: almostReadyRef, name: 'almost ready' },
          { ref: seatsForDepartureRef, name: 'seats for departure' },
          { ref: safetyVideoRef, name: 'safety video' },
          { ref: fastenSeatbeltRef, name: 'fasten seatbelt' }
        ];

        audioRefs.forEach(({ ref, name }) => {
          if (ref.current) {
            console.log(`${name} audio element:`, {
              readyState: ref.current.readyState,
              error: ref.current.error,
              src: ref.current.src,
              volume: ref.current.volume,
              muted: ref.current.muted,
              paused: ref.current.paused,
              currentTime: ref.current.currentTime
            });
          } else {
            console.error(`${name} audio element not initialized`);
          }
        });
      };

      // Check audio elements after a short delay to allow for loading
      setTimeout(checkAudioElements, 2000);
    };

    // Set a 3-second delay before starting audio initialization
    const initializationTimer = setTimeout(initializeAudioWithDelay, 3000);

    // Return cleanup function
    return () => {
      clearTimeout(initializationTimer);
      // Cleanup all audio elements
      [
        boardingMusicRef,
        welcomeAboardRef,
        doorsAutoRef,
        tenKFeetRef,
        arriveSoonRef,
        landingSoonRef,
        weveArrivedRef,
        almostReadyRef,
        seatsForDepartureRef,
        safetyVideoRef,
        fastenSeatbeltRef
      ].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.src = '';
          ref.current = null;
        }
      });
    };
  }, []);

  // Cleanup listeners
  useEffect(() => {
    return () => {
      unlistenSimconnect.then(fn => fn());
      unlistenLandingLights.then(fn => fn());
      unlistenBeaconLight.then(fn => fn());
      unlistenSeatbeltSign.then(fn => fn());
    };
  }, []);

  // Listen for audio events
  useEffect(() => {
    const handleAudioEvent = async (event: any) => {
      try {
        if (!event || !event.payload) {
          console.error('Invalid audio event:', event);
          return;
        }

        const data = event.payload as {
          type: string;
          volume?: number;
        };

        console.log('Audio event received:', data);

        if (data.type === 'safety_video') {
          if (safetyVideoRef.current) {
            console.log('Attempting to play safety video');
            console.log('Safety video audio element state:', {
              readyState: safetyVideoRef.current.readyState,
              error: safetyVideoRef.current.error,
              src: safetyVideoRef.current.src,
              volume: safetyVideoRef.current.volume,
              muted: safetyVideoRef.current.muted,
              paused: safetyVideoRef.current.paused,
              currentTime: safetyVideoRef.current.currentTime
            });
            
            // Lower boarding music volume before playing safety video
            if (boardingMusicRef.current) {
              console.log('Lowering boarding music volume for safety video');
              boardingMusicRef.current.volume = 0.2;
            }
            
            // Set safety video volume based on current zone
            const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
            const zone = getCurrentZone([currentZ, 0, 0]);
            const baseVolume = getZoneVolume(zone);
            const logVolume = toLogVolume(baseVolume * 100);
            const positionVolume = (masterVolume / 100) * logVolume;
            
            console.log('Volume calculation:', {
              currentZ,
              zone,
              baseVolume,
              logVolume,
              positionVolume,
              masterVolume
            });
            
            safetyVideoRef.current.volume = positionVolume;
            safetyVideoRef.current.currentTime = 0; // Reset to start
            
            try {
              await safetyVideoRef.current.play();
              console.log('Successfully started playing safety video');
              setIsPlaying(true);
              setCurrentAudioName('safety_video');
              setCurrentAudioVolume(positionVolume * 100);
              setCurrentZone(zone);
              
              // Add event listener for when the audio ends
              safetyVideoRef.current.addEventListener('ended', () => {
                console.log('Safety video finished playing');
                setIsPlaying(false);
                setCurrentAudioName('');
                
                // Restore boarding music volume after safety video finishes
                if (boardingMusicRef.current) {
                  console.log('Restoring boarding music volume');
                  boardingMusicRef.current.volume = 1.0;
                }
              }, { once: true });
            } catch (error) {
              console.error('Error playing safety video:', error);
              setIsPlaying(false);
              setCurrentAudioName('');
              
              // Restore boarding music volume on error
              if (boardingMusicRef.current) {
                console.log('Restoring boarding music volume after error');
                boardingMusicRef.current.volume = 1.0;
              }
            }
          } else {
            console.error('Safety video audio element not found');
          }
        }
      } catch (error) {
        console.error('Error handling audio event:', error);
      }
    };

    // Set up event listener
    const unsubscribe = listen('audio-event', handleAudioEvent);
    
    // Cleanup
    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [flightState.zPosition, masterVolume]);

  // Function to handle SimConnect data
  const handleSimConnectData = useCallback((event: MessageEvent) => {
    // ... existing code ...
    
    if (event.data.type === 'simconnect') {
      // ... existing code ...
      
      // Update the state when wing light changes
      if (event.data.wing_light !== undefined) {
        const newWingLightState = event.data.wing_light;
        console.log(`[HANDLER] Received wing light state: ${newWingLightState}`);
        
        if (flightState.wingLight !== newWingLightState) {
          console.log(`[MAIN HANDLER] Updating wingLight state: ${flightState.wingLight} -> ${newWingLightState}`);
          setFlightState(prev => ({
            ...prev,
            wingLight: newWingLightState
          }));
        }
      }
      
      // ... existing code ...
    }
    // ... existing code ...
  }, [flightState]);
  
  // Remove the direct listener with manual override check
  useEffect(() => {
    const handleWingLightDirectEvent = (event: MessageEvent) => {
      if (event.data.type === 'wing_light') {
        const newWingLightState = event.data.value;
        console.log(`[DIRECT LISTENER] Received wing light state: ${newWingLightState}`);
        
        if (flightState.wingLight !== newWingLightState) {
          console.log(`[DIRECT LISTENER] Updating wingLight state: ${flightState.wingLight} -> ${newWingLightState}`);
          setFlightState(prev => ({
            ...prev,
            wingLight: newWingLightState
          }));
        }
      }
    };
    
    window.addEventListener('message', handleWingLightDirectEvent);
    return () => window.removeEventListener('message', handleWingLightDirectEvent);
  }, [flightState]);
  
  // Toggle wing light function without manual override
  const toggleWingLight = () => {
    console.log(`[USER] Toggle wing light clicked, current state: ${flightState.wingLight}`);
    
    setFlightState(prev => ({
      ...prev,
      wingLight: !prev.wingLight
    }));
    
    // Send message to backend to toggle the wing light
    // Safely access ipcRenderer if it exists
    const ipcRenderer = (window as any).ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.send('toggle-wing-light');
    }
  };

  // Add handler for aircraft type change events
  const handleAircraftTypeEvent = (event: any) => {
    const aircraftType = event.payload.type;
    console.log(`Aircraft type event received: ${aircraftType}`);
    
    setFlightState(prev => ({
      ...prev,
      aircraftType: aircraftType
    }));
    
    // If in auto mode, handle automatic aircraft type selection
    if (aircraftDetectionMode === 'auto' && aircraftType) {
      // Try direct match first
      const aircraftConfigs = getAircraftConfigs();
      if (aircraftConfigs[aircraftType]) {
        console.log(`Found exact match for aircraft: ${aircraftType}`);
        setSelectedAircraftType(aircraftType);
        localStorage.setItem('selectedAircraftType', aircraftType);
      } else {
        // Try fuzzy matching based on aircraft type name
        const typeLC = aircraftType.toLowerCase();
        
        if (typeLC.includes('a320') || typeLC.includes('a319') || typeLC.includes('a321')) {
          setSelectedAircraftType('A320');
          localStorage.setItem('selectedAircraftType', 'A320');
        } else if (typeLC.includes('737')) {
          setSelectedAircraftType('B737');
          localStorage.setItem('selectedAircraftType', 'B737');
        } else if (typeLC.includes('crj')) {
          setSelectedAircraftType('CRJ');
          localStorage.setItem('selectedAircraftType', 'CRJ');
        } else if (typeLC.includes('embraer') || typeLC.includes('e-jet') || 
                 typeLC.includes('e170') || typeLC.includes('e190')) {
          setSelectedAircraftType('E-Jet');
          localStorage.setItem('selectedAircraftType', 'E-Jet');
        } else if (typeLC.includes('747')) {
          setSelectedAircraftType('B747');
          localStorage.setItem('selectedAircraftType', 'B747');
        }
      }
    }
  };

  // Handler for manually changing aircraft type
  const handleManualAircraftTypeChange = (aircraftType: string) => {
    setSelectedAircraftType(aircraftType);
    localStorage.setItem('selectedAircraftType', aircraftType);
    
    // Also update the detection mode if changed manually
    if (aircraftDetectionMode === 'auto') {
      setAircraftDetectionMode('manual');
      localStorage.setItem('aircraftDetectionMode', 'manual');
    }
  };

  // Handler for changing aircraft detection mode
  const handleDetectionModeChange = (mode: string) => {
    setAircraftDetectionMode(mode);
    localStorage.setItem('aircraftDetectionMode', mode);
    
    // If switching to auto mode, try to detect the aircraft type immediately
    if (mode === 'auto' && flightState.aircraftType) {
      handleAircraftTypeEvent({ payload: { type: flightState.aircraftType } });
    }
  };

  // Add event listener for aircraft type change events
  useEffect(() => {
    const unlistenAircraftType = listen('aircraft-type-changed', handleAircraftTypeEvent);
    
    return () => {
      unlistenAircraftType.then(unlisten => unlisten());
    };
  }, [aircraftDetectionMode]);  // Depend on aircraftDetectionMode to re-apply logic when it changes

  // Add SimConnect connection state
  const [simConnectActive, setSimConnectActive] = useState<boolean>(false);

  // Add handlers for connect/disconnect
  const handleConnect = async () => {
    console.log("Connecting to SimConnect...");
    try {
      await invoke('start_simconnect_data_collection');
      // Connection state will be updated via event listeners
    } catch (error) {
      console.error("Failed to connect to SimConnect:", error);
    }
  };

  const handleDisconnect = async () => {
    console.log("Disconnecting from SimConnect...");
    try {
      await invoke('stop_simconnect_data_collection');
      // Connection state will be updated via event listeners
    } catch (error) {
      console.error("Failed to disconnect from SimConnect:", error);
    }
  };

  // Add SimConnect connection state listeners
  useEffect(() => {
    const unlistenSimconnectOpen = listen('simconnect-open', () => {
      console.log("SimConnect connection opened");
      setSimConnectActive(true);
    });

    const unlistenSimconnectQuit = listen('simconnect-quit', () => {
      console.log("SimConnect connection closed");
      setSimConnectActive(false);
    });

    const unlistenSimconnectError = listen('simconnect-error', (event) => {
      console.error("SimConnect error:", event);
      setSimConnectActive(false);
    });

    return () => {
      unlistenSimconnectOpen.then(unlisten => unlisten());
      unlistenSimconnectQuit.then(unlisten => unlisten());
      unlistenSimconnectError.then(unlisten => unlisten());
    };
  }, []);

  // Add landing lights toggle handler
  const toggleLandingLights = async () => {
    console.log("Toggling landing lights...");
    setLandingLights(!landingLights);
    
    // You can add any additional logic here for interacting with SimConnect
    // if needed for landing lights control
  };

  // Add state for custom aircraft configurations
  const [customAircraftConfigs, setCustomAircraftConfigs] = useState<AppTypes.AircraftConfigs>(() => {
    const savedConfigs = localStorage.getItem('customAircraftConfigs');
    return savedConfigs ? JSON.parse(savedConfigs) : {};
  });
  
  // Get the effective aircraft configs (custom configs override defaults)
  const getAircraftConfigs = (): AppTypes.AircraftConfigs => {
    return { ...DEFAULT_AIRCRAFT_CONFIGS, ...customAircraftConfigs };
  };
  
  // Handler for updating aircraft zone configurations
  const handleZoneConfigChange = (aircraftType: string, newConfig: AppTypes.AircraftConfig): void => {
    console.log(`Updating zone config for ${aircraftType}:`, newConfig);
    
    // Create a deep copy of the existing config
    const updatedConfigs = { ...DEFAULT_AIRCRAFT_CONFIGS };
    
    // Update with the new configuration
    updatedConfigs[aircraftType] = newConfig;
    
    // If you need to persist this, you might add it to localStorage or similar
    localStorage.setItem('aircraftConfigs', JSON.stringify(updatedConfigs));
  };

  // Add state for debug mode
  const [debugMode, setDebugMode] = useState(false);

  // Add a debugging useEffect to monitor the audio element state
  useEffect(() => {
    // Check the audio elements every 10 seconds
    const audioDebugInterval = setInterval(() => {
      console.log('===== AUDIO DEBUG CHECK =====');
      
      // Check landing-soon.wav state
      if (landingSoonRef.current) {
        console.log('landing-soon.wav:', {
          playing: !landingSoonRef.current.paused,
          currentTime: landingSoonRef.current.currentTime,
          duration: landingSoonRef.current.duration,
          volume: landingSoonRef.current.volume,
          readyState: landingSoonRef.current.readyState,
          error: landingSoonRef.current.error,
          announced: landingSoonAnnouncedRef.current
        });
      }
      
      // Check we've-arrived.wav state
      if (weveArrivedRef.current) {
        console.log('we\'ve-arrived.wav:', {
          playing: !weveArrivedRef.current.paused,
          currentTime: weveArrivedRef.current.currentTime,
          duration: weveArrivedRef.current.duration,
          volume: weveArrivedRef.current.volume,
          readyState: weveArrivedRef.current.readyState,
          error: weveArrivedRef.current.error
        });
      }
      
      // Check conditions for "We've arrived" announcement
      console.log('"We\'ve arrived" conditions:', {
        hasDescendedThrough10k: hasDescendedThrough10kRef.current,
        landingLightsOffCount: landingLightsOffCount,
        lastLandingLightsState: lastLandingLightsStateRef.current
      });
      
      console.log('===== END AUDIO DEBUG =====');
    }, 10000);
    
    return () => clearInterval(audioDebugInterval);
  }, [landingLightsOffCount]);

  // Add function to toggle seatbelt sign state
  // Add this after the toggleLandingLights function
  const toggleSeatbeltSign = async () => {
    console.log("Toggling seatbelt sign...");
    const newState = !seatbeltSign;
    setSeatbeltSign(newState);
    lastSeatbeltStateRef.current = newState;
    
    // Also update the flight state
    setFlightState(prev => ({
      ...prev,
      seatbeltSign: newState
    }));
    
    // Process the seatbelt sign change through the handler
    handleSeatbeltSignChange(newState);
  };

  // Add this function before the return statement
  const handleMasterVolumeChangeInNew = (volume: number) => {
    // Convert the volume (0-1) to the range expected by handleVolumeChange (0-100)
    const volumePercent = Math.round(volume * 100);
    setMasterVolume(volumePercent);
    // Also update the audio elements
    updateAllAudioVolumes();
  };

  return (
    <div className="App">
      <div className="dashboard">
        <Boeing737Interface
          flightState={flightState}
          cameraPosition={cameraPosition}
          currentZone={currentZone}
          simConnectActive={simConnectActive}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          landingLights={landingLights}
          onWingLightToggle={toggleWingLight}
          onLandingLightsToggle={toggleLandingLights}
          onSeatbeltSignToggle={toggleSeatbeltSign}
          selectedAircraftType={selectedAircraftType}
          aircraftDetectionMode={aircraftDetectionMode}
          onAircraftTypeChange={handleManualAircraftTypeChange}
          onDetectionModeChange={handleDetectionModeChange}
          getAircraftConfigs={getAircraftConfigs}
          onZoneConfigChange={handleZoneConfigChange}
          zoneVolumes={{
            outside: getZoneVolume('outside'),
            jetway: getZoneVolume('jetway'),
            cabin: getZoneVolume('cabin'),
            cockpit: getZoneVolume('cockpit')
          }}
          masterVolume={masterVolume / 100}
          onMasterVolumeChange={handleMasterVolumeChangeInNew}
        />
      </div>
      
      {/* Audio elements */}
      <audio ref={boardingMusicRef} id="boarding-music" loop preload="auto" />
      <audio ref={welcomeAboardRef} id="welcome-aboard" preload="auto" />
      <audio ref={doorsAutoRef} id="doors-auto" preload="auto" />
      <audio ref={tenKFeetRef} id="10k-feet" preload="auto" />
      <audio ref={arriveSoonRef} id="arrive-soon" preload="auto" />
      <audio ref={landingSoonRef} id="landing-soon" preload="auto" />
      <audio ref={weveArrivedRef} id="weve-arrived" preload="auto" />
      <audio ref={almostReadyRef} id="almost-ready" preload="auto" />
      <audio ref={seatsForDepartureRef} id="seats-for-departure" preload="auto" />
      <audio ref={safetyVideoRef} id="safety-video" preload="auto" />
      <audio ref={fastenSeatbeltRef} id="fasten-seatbelt" preload="auto" />
      <audio ref={beaconLightSoundRef} id="beacon-light-sound" preload="auto" />
      
      {/* Hidden components that manage logic */}
      <div style={{ display: 'none' }}>
        <FenixStylePA
          currentZone={currentZone}
          position={position}
          thresholds={thresholds}
        />
        
        <AudioControlPanel
          audioManager={audioManager}
          currentZone={currentZone}
          position={position}
          thresholds={thresholds}
        />
      </div>
    </div>
  );
}

export default App;
