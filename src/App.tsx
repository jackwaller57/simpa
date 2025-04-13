import './App.css';
import { MainPage } from './pages/MainPage';
import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AudioManager } from './components/AudioManager';
import FlightStatusPanel from './components/FlightStatusPanel';

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

function App() {
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
  const [currentZone, setCurrentZone] = useState<string>('outside');
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
    jetwayState: 0
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
 
  const positionHistoryRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);
  const MIN_UPDATE_INTERVAL = 1000; // Increased to 1 second to prevent rapid updates
  const POSITION_THRESHOLD = 0.1; // Minimum position change threshold
  const ZONE_CHANGE_THRESHOLD = 0.1; // Reduced from 0.3 to make zone changes more responsive
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
  const VOLUME_DEBOUNCE_TIME = 250; // Reduced from 500ms to make volume changes more responsive

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

  // Function to smoothly transition volume
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
  const getCurrentZone = (cameraZ: number): string => {
    // Ensure we're using the actual camera Z position
    const actualZ = cameraZ || lastCameraZRef.current || 0;
    
    // Get zone based on camera position 
    let newZone = "";
    // These values are based on camera position only
    if (actualZ > -1.60) {
      newZone = 'outside';
    } else if (actualZ > -12.0) {
      newZone = 'jetway';
    } else if (actualZ > -22.4) {
      newZone = 'cabin';
    } else if (actualZ > -24.3) {
      newZone = 'cockpit';
    } else {
      newZone = 'outside';
    }
    
    // Stability logic to prevent rapid zone changes
    const now = Date.now();
    const { lastZone, lastZoneZ, stableCounter, changeTime } = zoneStabilityRef.current;
    
    // If zone is different from last zone
    if (newZone !== lastZone) {
      // Check if the position change is significant enough to warrant a zone change
      if (Math.abs(actualZ - lastZoneZ) < ZONE_CHANGE_THRESHOLD) {
        // Too small a change, probably noise - keep the last zone
        console.log(`Ignoring small zone change from ${lastZone} to ${newZone}. Z diff: ${Math.abs(actualZ - lastZoneZ)}`);
        return lastZone;
      }
      
      // Check if enough time has passed since the last zone change
      if (now - changeTime < 500) { // Reduced from 3000ms to 500ms
        // Too soon since last change, keep the last zone to prevent rapid toggling
        console.log(`Ignoring rapid zone change from ${lastZone} to ${newZone}. Time since last change: ${now - changeTime}ms`);
        return lastZone;
      }
      
      // This looks like a legitimate zone change, update the ref
      console.log(`Zone change from ${lastZone} to ${newZone} at Z: ${actualZ}`);
      zoneStabilityRef.current = {
        lastZone: newZone,
        lastZoneZ: actualZ,
        stableCounter: 0,
        changeTime: now
      };
      
      return newZone;
    } else {
      // Same zone as before, increment stability counter
      zoneStabilityRef.current.stableCounter++;
      
      // Update the last Z position if we've been stable for a while
      if (stableCounter > 5) { // Reduced from 10 to 5 for faster updates
        zoneStabilityRef.current.lastZoneZ = actualZ;
      }
      
      return lastZone;
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

  // Function to update all audio volumes
  const updateAllAudioVolumes = () => {
    const now = Date.now();
    if (now - lastVolumeUpdateRef.current < VOLUME_DEBOUNCE_TIME) {
      console.log('Skipping volume update - too soon since last update');
      return; // Skip update if too soon
    }
    lastVolumeUpdateRef.current = now;

    // Get the current Z position, prioritizing the most recent value
    const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
    console.log('Current Z position for volume update:', currentZ);
    
    // Only update if position has changed significantly
    if (lastZPositionRef.current !== null && 
        Math.abs(currentZ - lastZPositionRef.current) < POSITION_THRESHOLD) {
      console.log('Skipping volume update - position change too small');
      return;
    }
    
    const zone = getCurrentZone(currentZ);
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
        console.log(`Updating ${name} volume to:`, finalVolume);
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

    // Update camera Z position and timestamp
    lastCameraZRef.current = currentZ;
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
      const zone = getCurrentZone(currentZ);
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
          const zone = getCurrentZone(currentZ);
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
    console.log(`Current count: ${landingLightsOffCount}`);
    
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
          console.log(`- Has descended through 10k: ${hasDescendedThrough10k}`);
          
          // Check if we should play "We've arrived" announcement
          if (newCount === 2 && hasDescendedThrough10k) {
            console.log('Conditions met! Playing "We\'ve arrived" announcement');
            if (weveArrivedRef.current) {
              const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
              const zone = getCurrentZone(currentZ);
              const baseVolume = getZoneVolume(zone);
              const logVolume = toLogVolume(baseVolume * 100);
              const positionVolume = (masterVolume / 100) * logVolume;
              
              weveArrivedRef.current.volume = positionVolume;
              weveArrivedRef.current.currentTime = 0;
              weveArrivedRef.current.play()
                .then(() => {
                  console.log('Successfully started playing "We\'ve arrived" announcement');
                  setIsPlaying(true);
                  setCurrentAudioName('weve_arrived');
                  setCurrentAudioVolume(positionVolume * 100);
                  setCurrentZone(zone);
                })
                .catch(error => {
                  console.error('Error playing "We\'ve arrived" announcement:', error);
                });
            }
          } else {
            console.log('Conditions not met for "We\'ve arrived" announcement');
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
      return;
    }
    
    const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
    const zone = getCurrentZone(currentZ);
    const baseVolume = getZoneVolume(zone);
    const logVolume = toLogVolume(baseVolume * 100);
    const positionVolume = (masterVolume / 100) * logVolume;
    
    audioRef.current.volume = positionVolume;
    audioRef.current.currentTime = 0;
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
          
          if (onEndCallback) {
            onEndCallback();
          }
        }, { once: true });
      })
      .catch(error => {
        console.error(`Error playing "${audioName}" announcement:`, error);
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
            const zone = getCurrentZone(currentZ);
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

      const data = event.payload as { x: number, y: number, z: number, isExternal: boolean };
      // Update camera position state
      setFlightState(prevState => ({
        ...prevState,
        xPosition: data.x,
        yPosition: data.y,
        zPosition: data.z,
        cameraViewType: data.isExternal ? 'external' : 'internal'
      }));
      
      // Update camera position ref
      lastCameraZRef.current = data.z;
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
      console.log('Beacon light event received:', data);
      handleBeaconLightChange(data.state);
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

    // Set up event listener
    const unsubscribe = listen('simconnect-data', handleSimConnectEvent);
    
    // Cleanup
    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [flightState.zPosition, masterVolume]);

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
        gsxBypassPin?: boolean
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
              const zone = getCurrentZone(currentZ);
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
              const zone = getCurrentZone(currentZ);
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
              
              // Play landing soon announcement
              if (landingSoonRef.current) {
                console.log('Playing landing soon announcement');
                const currentZ = flightState.zPosition || lastCameraZRef.current || 0;
                const zone = getCurrentZone(currentZ);
                const baseVolume = getZoneVolume(zone);
                const logVolume = toLogVolume(baseVolume * 100);
                const positionVolume = (masterVolume / 100) * logVolume;
                
                landingSoonRef.current.volume = positionVolume;
                landingSoonRef.current.currentTime = 0;
                landingSoonRef.current.play()
                  .then(() => {
                    console.log('Successfully started playing landing soon announcement');
                    setIsPlaying(true);
                    setCurrentAudioName('landing_soon');
                    setCurrentAudioVolume(positionVolume * 100);
                    setCurrentZone(zone);
                  })
                  .catch(error => {
                    console.error('Error playing landing soon announcement:', error);
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
        console.log('Camera Z position updated:', data.zPosition);
        setFlightState(prev => ({
          ...prev,
          xPosition: data.xPosition ?? prev.xPosition,
          yPosition: data.yPosition ?? prev.yPosition,
          zPosition: data.zPosition ?? prev.zPosition,
          speed: 0, // Default speed
          heading: 0, // Default heading
          altitude: data.alt ?? prev.altitude,
          cameraViewType: data.cameraViewType ?? prev.cameraViewType,
          beaconLight: data.beaconLight ?? prev.beaconLight,
          seatbeltSign: data.seatbeltSign ?? prev.seatbeltSign,
          jetwayMoving: data.jetwayMoving ?? prev.jetwayMoving,
          jetwayState: data.jetwayState ? 1 : 0
        }));
        
        lastCameraZRef.current = data.zPosition;
        updateAllAudioVolumes();
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
        console.log('SIMCONNECT DEBUG - Received valid beacon light state change:', data.beaconLight);
        console.log('Current beacon light state:', beaconLight);
        handleBeaconLightChange(data.beaconLight);
      } else {
        console.log('SIMCONNECT DEBUG - Beacon light data is not a boolean:', data.beaconLight);
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
            const zone = getCurrentZone(currentZ);
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
                            console.error('Error playing welcome aboard:', error);
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
      if (welcomeAboardTimerRef.current) {
        console.log('Clearing welcome aboard announcement timer');
        clearTimeout(welcomeAboardTimerRef.current);
        welcomeAboardTimerRef.current = null;
      }
      
      [boardingMusicRef, welcomeAboardRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      
      // Clear any pending timeouts
      const timeouts = window.setTimeout(() => {}, 0);
      while (timeouts > 0) {
        window.clearTimeout(timeouts);
      }
      
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
      initAudio(doorsAutoRef, '/sounds/announcements/Doors to Auto.wav', 'doors_auto');
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
            const zone = getCurrentZone(currentZ);
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
  const handleSimConnectData = (data: any) => {
    if (data && typeof data === 'object') {
      // Update position and flight data
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      
      // Only update if enough time has passed since the last update
      if (timeSinceLastUpdate > MIN_UPDATE_INTERVAL) {
        // Update the state
        setFlightState(prevState => {
          const newState = { ...prevState };
          
          // Update position only if values have changed significantly
          if (Math.abs((data.xPosition || 0) - (prevState.xPosition || 0)) > POSITION_THRESHOLD) {
            newState.xPosition = data.xPosition;
          }
          if (Math.abs((data.yPosition || 0) - (prevState.yPosition || 0)) > POSITION_THRESHOLD) {
            newState.yPosition = data.yPosition;
          }
          if (Math.abs((data.zPosition || 0) - (prevState.zPosition || 0)) > POSITION_THRESHOLD) {
            newState.zPosition = data.zPosition;
            lastZPositionRef.current = data.zPosition;
          }
          
          // Always update these values as they're discrete
          if (data.speed !== undefined) newState.speed = data.speed;
          if (data.heading !== undefined) newState.heading = data.heading;
          if (data.cameraViewType !== undefined) newState.cameraViewType = data.cameraViewType;
          
          // Process beacon light changes via dedicated handler
          if (data.beaconLight !== undefined) {
            console.log(`Received beacon light state: ${data.beaconLight ? 'ON' : 'OFF'}`);
            handleBeaconLightChange(data.beaconLight);
          }
          
          // Process seatbelt sign changes via dedicated handler
          if (data.seatbeltSign !== undefined) {
            console.log(`Received seatbelt sign state: ${data.seatbeltSign ? 'ON' : 'OFF'}`);
            handleSeatbeltSignChange(data.seatbeltSign);
          }
          
          // Handle jetway state
          if (data.jetwayState !== undefined) {
            newState.jetwayState = data.jetwayState;
            if (data.jetwayState === 1) {
              jetwayAttachedRef.current = true;
            } else {
              jetwayAttachedRef.current = false;
            }
          }
          
          if (data.jetwayMoving !== undefined) {
            newState.jetwayMoving = data.jetwayMoving;
          }
          
          return newState;
        });
        
        // Process altitude changes for announcements
        if (data.altitude !== undefined) {
          const altitude = data.altitude;
          if (lastAltitudeRef.current === 0) {
            lastAltitudeRef.current = altitude;
          } else {
            // Check for 10,000 feet announcements (in descent phase)
            if (!tenKAnnouncedRef.current && lastAltitudeRef.current > 10000 && altitude <= 10000) {
              console.log('Descended through 10,000 feet, playing announcement');
              tenKAnnouncedRef.current = true;
              hasDescendedThrough10kRef.current = true;
              if (tenKFeetRef.current) {
                playAltitudeAnnouncement(tenKFeetRef, '10k feet');
              }
            }
            
            // Check for "arrive soon" announcements (around 8,000 feet)
            if (!arriveSoonAnnouncedRef.current && lastAltitudeRef.current > 8000 && altitude <= 8000) {
              console.log('Descended through 8,000 feet, playing arrive soon announcement');
              arriveSoonAnnouncedRef.current = true;
              if (arriveSoonRef.current) {
                playAltitudeAnnouncement(arriveSoonRef, 'arrive soon');
              }
            }
            
            // Check for "landing soon" announcements (around 3,000 feet)
            if (!landingSoonAnnouncedRef.current && lastAltitudeRef.current > 3000 && altitude <= 3000) {
              console.log('Descended through 3,000 feet, playing landing soon announcement');
              landingSoonAnnouncedRef.current = true;
              if (landingSoonRef.current) {
                playAltitudeAnnouncement(landingSoonRef, 'landing soon');
              }
            }
            
            // Update last altitude
            lastAltitudeRef.current = altitude;
          }
        }
        
        // Process landing lights changes
        if (data.landingLights !== undefined) {
          handleLandingLightsChange(data.landingLights);
        }
        
        // Update timestamps
        lastUpdateTimeRef.current = now;
      }
      
      // Always update volume based on camera position if it has changed
      if (data.zPosition !== undefined) {
        // Update audio volume based on camera position
        const currentZ = data.zPosition || lastCameraZRef.current || 0;
        updateAudioVolumeBasedOnPosition(currentZ);
      }
    }
  };

  // Function to update audio volume based on camera position
  const updateAudioVolumeBasedOnPosition = (cameraZ: number) => {
    const now = Date.now();
    
    // Get zone based on camera position
    const zone = getCurrentZone(cameraZ);
    const baseVolume = getZoneVolume(zone);
    
    // Always update the UI zone immediately regardless of debounce
    if (zone !== currentZoneRef.current) {
      console.log(`Zone changed from ${currentZoneRef.current} to ${zone} - updating UI immediately`);
      setCurrentZone(zone);
      currentZoneRef.current = zone;
    }
    
    // Apply debounce to volume updates only
    if (now - lastVolumeUpdateRef.current < VOLUME_DEBOUNCE_TIME) {
      console.log(`Skipping volume update - too soon since last update (${now - lastVolumeUpdateRef.current}ms < ${VOLUME_DEBOUNCE_TIME}ms)`);
      return;
    }
    
    console.log(`Updating volume for zone: ${zone}, base volume: ${baseVolume}, master volume: ${masterVolume}`);
    
    // Update all audio elements with the appropriate volume
    const updateVolume = (ref: React.MutableRefObject<HTMLAudioElement | null>, name: string) => {
      if (ref.current) {
        // Calculate logarithmic volume for better perceived response
        const logVolume = toLogVolume(baseVolume * 100);
        // Apply master volume control
        const finalVolume = (masterVolume / 100) * logVolume;
        
        // Only update if the volume has actually changed
        if (ref.current.volume !== finalVolume) {
          console.log(`Setting ${name} volume to ${finalVolume} (base: ${baseVolume}, log: ${logVolume})`);
          ref.current.volume = finalVolume;
        }
      }
    };
    
    // Update all audio elements
    if (boardingMusicRef.current) updateVolume(boardingMusicRef, 'boarding music');
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
    
    // Update volume indicator for UI display
    setCurrentVolume(baseVolume * 100);
    
    // Update last volume update time and camera position
    lastVolumeUpdateRef.current = now;
    lastCameraZRef.current = cameraZ;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Flight Status Panel */}
          <div className="flex-1">
            <FlightStatusPanel
              flightState={flightState}
              currentVolume={currentVolume}
              masterVolume={masterVolume}
              currentZone={currentZone}
              isPlaying={isPlaying}
              currentAudioName={currentAudioName}
              currentAudioVolume={currentAudioVolume}
              cockpitDoorOpen={cockpitDoorOpen}
              cameraPosition={cameraPosition}
              landingLights={landingLights}
              landingLightsOffCount={landingLightsOffCount}
              hasDescendedThrough10k={hasDescendedThrough10k}
              gsxBypassPin={gsxBypassPin}
              seatbeltSignCount={seatbeltSignCount}
              touchdownData={touchdownData}
              onVolumeChange={handleVolumeChange}
              onResetSeatbeltCount={resetSeatbeltCount}
            />
          </div>

          {/* Controls Panel */}
          <div className="flex-1 bg-gray-800 rounded-lg shadow-lg p-6">
            <MainPage onDisconnect={stopAllAudio} />
            <AudioManager />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
