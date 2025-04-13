import './App.css';
import { MainPage } from './pages/MainPage';
import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AudioManager } from './components/AudioManager';

interface FlightState {
  zPosition: number;
  cameraPosition: string;
  cameraViewType: string;
  volumeLevel: number;
  xPosition: number;
  yPosition: number;
  altitude: number;
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
    zPosition: 0,
    cameraPosition: 'exterior',
    cameraViewType: 'external',
    volumeLevel: 0.0,
    xPosition: 0.0,
    yPosition: 0.0,
    altitude: 0
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
  const POSITION_THRESHOLD = 0.5; // Minimum position change required to trigger update
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
  const VOLUME_DEBOUNCE_TIME = 500; // Reduced to 500ms

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
    console.log(`Checking zone for camera Z position: ${actualZ}`);
    
    // These values are based on camera position only
    if (actualZ > -1.60) {
      console.log('Zone: outside');
      return 'outside';
    }
    if (actualZ > -12.0) {
      console.log('Zone: jetway');
      return 'jetway';
    }
    if (actualZ > -22.4) {
      console.log('Zone: cabin');
      return 'cabin';
    }
    if (actualZ > -24.3) {
      console.log('Zone: cockpit');
      return 'cockpit';
    }
    console.log('Zone: outside (default)');
    return 'outside';
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
    console.log(`Seatbelt sign state changed: ${newState}`);
    console.log(`Current seatbelt sign count: ${seatbeltSignCountRef.current}`);
    console.log(`Almost ready audio element state:`, {
      readyState: almostReadyRef.current?.readyState,
      error: almostReadyRef.current?.error,
      src: almostReadyRef.current?.src,
      volume: almostReadyRef.current?.volume,
      muted: almostReadyRef.current?.muted
    });
    
    setSeatbeltSign(newState);
    
    if (newState) {
      // Increment the seatbelt sign count
      seatbeltSignCountRef.current++;
      console.log(`Seatbelt sign count: ${seatbeltSignCountRef.current}`);
      
      // Play appropriate announcement based on count
      if (seatbeltSignCountRef.current === 1) {
        // First time - play "Almost ready to go"
        if (almostReadyRef.current) {
          console.log('Playing "Almost ready to go" announcement');
          
          // Stop welcome aboard announcements
          if (welcomeAboardTimerRef.current) {
            console.log('Clearing welcome aboard announcement timer');
            clearTimeout(welcomeAboardTimerRef.current);
            welcomeAboardTimerRef.current = null;
          }
          
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
          
          almostReadyRef.current.volume = positionVolume;
          almostReadyRef.current.currentTime = 0;
          almostReadyRef.current.play()
            .then(() => {
              console.log('Successfully started playing "Almost ready to go" announcement');
              setIsPlaying(true);
              setCurrentAudioName('almost_ready');
              setCurrentAudioVolume(positionVolume * 100);
              setCurrentZone(zone);
              
              // Add event listener for when the audio ends
              almostReadyRef.current?.addEventListener('ended', () => {
                console.log('"Almost ready to go" announcement finished playing');
                setIsPlaying(false);
                setCurrentAudioName('');
                
                // Restart welcome aboard announcements with random timer
                if (jetwayAttachedRef.current) {
                  console.log('Restarting welcome aboard announcements');
                  const randomInterval = Math.floor(Math.random() * (140000 - 30000) + 30000); // Random between 30-140 seconds
                  console.log(`Scheduling next welcome aboard announcement in ${randomInterval/1000} seconds`);
                  welcomeAboardTimerRef.current = window.setTimeout(() => {
                    if (welcomeAboardRef.current && jetwayAttachedRef.current) {
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
                            // Schedule next announcement
                            const nextInterval = Math.floor(Math.random() * (140000 - 30000) + 30000);
                            console.log(`Scheduling next welcome aboard announcement in ${nextInterval/1000} seconds`);
                            welcomeAboardTimerRef.current = window.setTimeout(() => {
                              if (welcomeAboardRef.current && jetwayAttachedRef.current) {
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
                          }, { once: true });
                        })
                        .catch(error => {
                          console.error('Error playing subsequent welcome aboard:', error);
                        });
                    }
                  }, randomInterval);
                }
              }, { once: true });
            })
            .catch(error => {
              console.error('Error playing "Almost ready to go" announcement:', error);
            });
        } else {
          console.error('Almost ready audio element not found');
        }
      } else {
        // Subsequent times - play "Fasten seatbelts"
        if (fastenSeatbeltRef.current) {
          console.log('Playing "Fasten seatbelts" announcement');
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
          
          fastenSeatbeltRef.current.volume = positionVolume;
          fastenSeatbeltRef.current.currentTime = 0;
          fastenSeatbeltRef.current.play()
            .then(() => {
              console.log('Successfully started playing "Fasten seatbelts" announcement');
              setIsPlaying(true);
              setCurrentAudioName('fasten_seatbelt');
              setCurrentAudioVolume(positionVolume * 100);
              setCurrentZone(zone);
            })
            .catch(error => {
              console.error('Error playing "Fasten seatbelts" announcement:', error);
            });
        } else {
          console.error('Fasten seatbelt audio element not found');
        }
      }
    } else {
      // Reset count when seatbelt sign is turned off
      seatbeltSignCountRef.current = 0;
      console.log('Seatbelt sign turned off - resetting count');
    }
  };

  // Function to handle GSX bypass pin changes
  const handleGsxBypassPinChange = (newState: boolean) => {
    console.log(`GSX bypass pin state changed: ${newState}`);
    const now = Date.now();
    
    // Skip if we've already played the safety video for this flight
    if (safetyVideoPlayedRef.current) {
      console.log('Skipping GSX bypass pin update - safety video already played for this flight');
      return;
    }

    if (now - lastGsxBypassPinUpdateRef.current < GSX_BYPASS_PIN_DEBOUNCE_TIME) {
      console.log('Skipping GSX bypass pin update - too soon since last update');
      return;
    }

    setGsxBypassPin(newState);
    lastGsxBypassPinUpdateRef.current = now;
    
    // If pin was just inserted, play safety video
    if (newState) {
      console.log('GSX bypass pin inserted - playing safety video');
      if (safetyVideoRef.current) {
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
      } else {
        console.error('Safety video audio element not found');
      }
    }
  };

  // Listen for simconnect data
  const unlistenSimconnect = listen('simconnect-data', (event) => {
    try {
      // Ensure we have a valid payload
      if (!event || !event.payload) {
        console.error('Invalid simconnect data event:', event);
        return;
      }

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
          zPosition: data.zPosition as number,
          cameraPosition: data.cameraPosition || prev.cameraPosition,
          cameraViewType: data.cameraViewType || prev.cameraViewType,
          volumeLevel: data.volumeLevel || prev.volumeLevel,
          xPosition: data.xPosition || prev.xPosition,
          yPosition: data.yPosition || prev.yPosition
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
        console.log('Received seatbelt sign state change:', data.seatbeltSign);
        handleSeatbeltSignChange(data.seatbeltSign);
      }
      if (typeof data.beaconLight === 'boolean') {
        setBeaconLight(data.beaconLight);
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
          console.log('GSX bypass pin inserted - playing safety video');
          if (safetyVideoRef.current) {
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
          } else {
            console.error('Safety video audio element not found');
          }
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
                  
                  // Start timer for subsequent announcements with random interval
                  const scheduleNextAnnouncement = () => {
                    const randomInterval = Math.floor(Math.random() * (140000 - 30000) + 30000); // Random between 30-140 seconds
                    console.log(`Scheduling next welcome aboard announcement in ${randomInterval/1000} seconds`);
                    welcomeAboardTimerRef.current = window.setTimeout(() => {
                      if (welcomeAboardRef.current && jetwayAttachedRef.current) {
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
                              // Schedule next announcement
                              scheduleNextAnnouncement();
                            }, { once: true });
                          })
                          .catch(error => {
                            console.error('Error playing subsequent welcome aboard:', error);
                            // Schedule next announcement even if there was an error
                            scheduleNextAnnouncement();
                          });
                      }
                    }, randomInterval);
                  };
                  
                  // Start the first random interval
                  scheduleNextAnnouncement();
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
                    
                    // Start timer for subsequent announcements with random interval
                    const scheduleNextAnnouncement = () => {
                      const randomInterval = Math.floor(Math.random() * (140000 - 30000) + 30000); // Random between 30-140 seconds
                      console.log(`Scheduling next welcome aboard announcement in ${randomInterval/1000} seconds`);
                      welcomeAboardTimerRef.current = window.setTimeout(() => {
                        if (welcomeAboardRef.current && jetwayAttachedRef.current) {
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
                                // Schedule next announcement
                                scheduleNextAnnouncement();
                              }, { once: true });
                            })
                            .catch(error => {
                              console.error('Error playing subsequent welcome aboard:', error);
                              // Schedule next announcement even if there was an error
                              scheduleNextAnnouncement();
                            });
                        }
                      }, randomInterval);
                    };
                    
                    // Start the first random interval
                    scheduleNextAnnouncement();
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

    // Return cleanup function
    return () => {
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

  return (
    <div className="container">
      <div className="status-panel">
        <h3>Flight Status</h3>
        <div className="status-item">
          <span className="status-label">View Type:</span>
          <span className="status-value">{flightState.cameraViewType}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Volume Level:</span>
          <span className="status-value">{Math.round(currentVolume)}%</span>
        </div>
        <div className="status-item">
          <span className="status-label">Master Volume:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
          <span className="status-value">{masterVolume}%</span>
        </div>
        <div className="status-item">
          <span className="status-label">Cockpit Door:</span>
          <span className="status-value">{cockpitDoorOpen ? 'Open' : 'Closed'}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Camera Position:</span>
          <span className="status-value">{cameraPosition}</span>
        </div>
        <div className="status-item">
          <span className="status-label">X:</span>
          <span className="status-value">{flightState.xPosition.toFixed(2)}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Y:</span>
          <span className="status-value">{flightState.yPosition.toFixed(2)}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Z:</span>
          <span className="status-value">{flightState.zPosition.toFixed(2)}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Altitude:</span>
          <span className="status-value">{flightState.altitude?.toFixed(0) ?? 'N/A'} ft</span>
        </div>
        <div className="status-item">
          <span className="status-label">Current Zone:</span>
          <span className="status-value">{currentZone}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Audio Status:</span>
          <span className="status-value">{isPlaying ? `Playing: ${currentAudioName}` : 'No audio playing'}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Audio Volume:</span>
          <span className="status-value">{Math.round(currentAudioVolume)}%</span>
        </div>
      </div>
      <MainPage onDisconnect={stopAllAudio} />
      <div style={{ position: 'fixed', bottom: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', color: 'white', zIndex: 1000 }}>
        <div style={{ fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>System Status</div>
        <div>Landing Lights: {landingLights ? 'ON' : 'OFF'}</div>
        <div>Landing Lights Off Count: {landingLightsOffCount}</div>
        <div>Descended Through 10k: {hasDescendedThrough10k ? 'YES' : 'NO'}</div>
        <div>GSX Bypass Pin: {gsxBypassPin ? 'INSERTED' : 'REMOVED'}</div>
        {touchdownData && (
          <div style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '5px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Touchdown Data:</div>
            <div>Vertical Speed: {touchdownData.normalVelocity.toFixed(1)} ft/s</div>
            <div>Bank Angle: {touchdownData.bankDegrees.toFixed(1)}°</div>
            <div>Pitch Angle: {touchdownData.pitchDegrees.toFixed(1)}°</div>
            <div>Heading: {touchdownData.headingDegrees.toFixed(1)}°</div>
            <div>Lateral Speed: {touchdownData.lateralVelocity.toFixed(1)} ft/s</div>
            <div>Longitudinal Speed: {touchdownData.longitudinalVelocity.toFixed(1)} ft/s</div>
          </div>
        )}
        
      </div>
      <style>{`
        .status-panel {
          background-color: #2c3e50;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .status-item {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        .status-label {
          color: #ecf0f1;
          font-weight: bold;
          margin-right: 10px;
          min-width: 120px;
        }
        .status-value {
          color: #3498db;
        }
        .volume-slider {
          width: 150px;
          margin: 0 10px;
        }
      `}</style>
      <AudioManager />
    </div>
  );
}

export default App;
