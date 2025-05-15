// Standalone Audio Control System
class StandaloneAudioControl {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.gainNodes = {};
        this.audioSources = {};
        this.currentZone = "outside";
        this.position = 0.0;
        this.masterVolume = 1.0;
        this.fadeDuration = 1.5;
        this.zoneVolumes = {
            outside: 0.45,
            jetway: 0.8,
            cabin: 0.7,
            cockpit: 0.65
        };
        this.thresholds = {
            outside: { start: 0.0, end: -1.6 },
            jetway: { start: -1.6, end: -12.0 },
            cabin: { start: -12.0, end: -22.4 },
            cockpit: { start: -22.4, end: -24.3 }
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Audio effects state
        this.audioEffects = {
            reverb: false,
            delay: false,
            compression: false
        };
        
        // Update rates
        this.positionUpdateRate = 100; // ms
        
        // Aircraft position SimVar name - can be customized per aircraft
        this.positionSimVar = "L:AUDIO_POSITION";
        
        // Interval IDs for timers
        this.updateIntervalId = null;
    }

    initialize() {
        // Initialize UI elements once DOM is loaded
        this.initialized = true;
        this.initializeAudioSystem();
        this.attachEventListeners();
        
        // Start position update interval
        this.updateIntervalId = setInterval(() => {
            this.updatePositionFromSim();
        }, this.positionUpdateRate);
        
        // Load settings from storage
        this.loadSettings();
        
        console.log("Standalone Audio Control initialized");
    }

    // Initialize Web Audio API system
    async initializeAudioSystem() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.gainNodes.master = this.audioContext.createGain();
            this.gainNodes.master.gain.value = this.masterVolume;
            this.gainNodes.master.connect(this.audioContext.destination);
            
            // Create zone gain nodes
            for (const zone in this.zoneVolumes) {
                this.gainNodes[zone] = this.audioContext.createGain();
                this.gainNodes[zone].gain.value = this.zoneVolumes[zone];
                this.gainNodes[zone].connect(this.gainNodes.master);
            }
            
            // Initialize effects
            await this.initializeEffects();
            
            // Set audio context status display
            this.updateAudioContextStatus();
            
            // Check context status periodically
            setInterval(() => {
                this.updateAudioContextStatus();
            }, 2000);
            
            console.log("Audio system initialized successfully");
            
            // Set initial values for UI
            this.updateUIValues();
        } catch (error) {
            console.error("Error initializing audio system:", error);
        }
    }
    
    // Update audio context status display
    updateAudioContextStatus() {
        try {
            if (!this.audioContext) return;
            
            const statusElement = document.getElementById("audio-context-status");
            if (statusElement) {
                const status = this.audioContext.state;
                statusElement.textContent = status;
                
                // Update class for styling
                statusElement.className = "status-text " + status;
                
                // Show/hide wake button
                const wakeButtonContainer = document.getElementById("wake-button-container");
                if (wakeButtonContainer) {
                    wakeButtonContainer.style.display = status !== "running" ? "block" : "none";
                }
            }
        } catch (error) {
            console.error("Error updating audio context status:", error);
        }
    }

    // Wake up audio context (needed for browsers that require user interaction)
    async wakeAudioContext() {
        try {
            if (!this.audioContext) return;
            
            // Resume the audio context
            await this.audioContext.resume();
            console.log("Audio context resumed:", this.audioContext.state);
            
            // Create a short silent sound to fully activate audio
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            gain.gain.value = 0.001; // Nearly silent
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.start();
            
            setTimeout(() => {
                osc.stop();
                osc.disconnect();
                gain.disconnect();
                
                // Update status display
                this.updateAudioContextStatus();
                
                // Force update volumes
                this.forceVolumeUpdate();
            }, 100);
        } catch (error) {
            console.error("Error waking audio context:", error);
        }
    }

    // Initialize audio effects
    async initializeEffects() {
        try {
            // Create compressor
            this.effects = {
                compressor: this.audioContext.createDynamicsCompressor(),
                delay: this.audioContext.createDelay(1.0),
                reverb: null
            };
            
            // Configure compressor
            if (this.effects.compressor) {
                this.effects.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
                this.effects.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
                this.effects.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
                this.effects.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
                this.effects.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);
            }
            
            // Configure delay
            if (this.effects.delay) {
                this.effects.delay.delayTime.setValueAtTime(0.3, this.audioContext.currentTime);
                
                // Create delay feedback gain
                this.effects.delayFeedback = this.audioContext.createGain();
                this.effects.delayFeedback.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                
                // Connect delay feedback loop
                this.effects.delay.connect(this.effects.delayFeedback);
                this.effects.delayFeedback.connect(this.effects.delay);
            }
            
            // Create convolver for reverb (we'll load impulse response later)
            this.effects.reverb = this.audioContext.createConvolver();
            
            // Create a simple impulse response for reverb
            const reverbBuffer = await this.createReverbBuffer();
            if (this.effects.reverb && reverbBuffer) {
                this.effects.reverb.buffer = reverbBuffer;
            }
            
            console.log("Audio effects initialized");
        } catch (error) {
            console.error("Error initializing audio effects:", error);
        }
    }

    // Create a simple reverb impulse response buffer
    async createReverbBuffer() {
        try {
            const sampleRate = this.audioContext.sampleRate;
            const length = 2 * sampleRate; // 2 seconds
            const buffer = this.audioContext.createBuffer(2, length, sampleRate);
            
            // Fill buffer with noise and apply exponential decay
            for (let channel = 0; channel < 2; channel++) {
                const data = buffer.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
                }
            }
            
            return buffer;
        } catch (error) {
            console.error("Error creating reverb buffer:", error);
            return null;
        }
    }

    // Update UI values from internal state
    updateUIValues() {
        if (!this.initialized) return;
        
        // Update master volume slider and text
        const masterVolumeSlider = document.getElementById("master-volume");
        const masterVolumeDisplay = document.getElementById("master-volume-display");
        if (masterVolumeSlider && masterVolumeDisplay) {
            masterVolumeSlider.value = this.masterVolume * 100;
            masterVolumeDisplay.textContent = `${Math.round(this.masterVolume * 100)}%`;
        }
        
        // Update fade duration slider and text
        const fadeDurationSlider = document.getElementById("fade-duration");
        const fadeDurationDisplay = document.getElementById("fade-duration-display");
        if (fadeDurationSlider && fadeDurationDisplay) {
            fadeDurationSlider.value = this.fadeDuration;
            fadeDurationDisplay.textContent = `${this.fadeDuration.toFixed(1)}s`;
        }
        
        // Update zone volume sliders and text
        for (const zone in this.zoneVolumes) {
            const volumeSlider = document.getElementById(`${zone}-volume`);
            const volumeDisplay = document.getElementById(`${zone}-volume-display`);
            if (volumeSlider && volumeDisplay) {
                volumeSlider.value = this.zoneVolumes[zone] * 100;
                volumeDisplay.textContent = `${Math.round(this.zoneVolumes[zone] * 100)}%`;
            }
        }
        
        // Update current zone and position display
        const currentZoneElement = document.getElementById("current-zone");
        const positionElement = document.getElementById("aircraft-position");
        if (currentZoneElement && positionElement) {
            currentZoneElement.textContent = this.currentZone;
            positionElement.textContent = this.position.toFixed(2);
        }
        
        // Update debug toggle
        const debugToggle = document.getElementById("debug-toggle");
        if (debugToggle) {
            debugToggle.checked = this.debugMode;
        }
        
        // Show/hide debug section
        const debugSection = document.getElementById("debug-section");
        if (debugSection) {
            debugSection.style.display = this.debugMode ? "block" : "none";
        }
        
        // Update effect toggles
        for (const effect in this.audioEffects) {
            const toggle = document.getElementById(`${effect}-toggle`);
            if (toggle) {
                toggle.checked = this.audioEffects[effect];
            }
        }
    }

    // Attach event listeners to UI controls
    attachEventListeners() {
        // Master volume slider
        const masterVolumeSlider = document.getElementById("master-volume");
        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener("input", (e) => {
                this.masterVolume = parseFloat(e.target.value) / 100;
                this.setMasterVolume(this.masterVolume);
                this.updateUIValues();
            });
        }
        
        // Fade duration slider
        const fadeDurationSlider = document.getElementById("fade-duration");
        if (fadeDurationSlider) {
            fadeDurationSlider.addEventListener("input", (e) => {
                this.fadeDuration = parseFloat(e.target.value);
                this.updateUIValues();
            });
        }
        
        // Zone volume sliders
        for (const zone in this.zoneVolumes) {
            const volumeSlider = document.getElementById(`${zone}-volume`);
            if (volumeSlider) {
                volumeSlider.addEventListener("input", (e) => {
                    this.zoneVolumes[zone] = parseFloat(e.target.value) / 100;
                    this.setZoneVolume(zone, this.zoneVolumes[zone]);
                    this.updateUIValues();
                });
            }
        }
        
        // Reset button
        const resetButton = document.getElementById("reset-button");
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                this.resetDefaultVolumes();
            });
        }
        
        // Debug mode toggle
        const debugToggle = document.getElementById("debug-toggle");
        if (debugToggle) {
            debugToggle.addEventListener("change", (e) => {
                this.debugMode = e.target.checked;
                this.updateUIValues();
            });
        }
        
        // Effect toggles
        for (const effect in this.audioEffects) {
            const toggle = document.getElementById(`${effect}-toggle`);
            if (toggle) {
                toggle.addEventListener("change", (e) => {
                    this.toggleEffect(effect, e.target.checked);
                });
            }
        }
        
        // Force update button
        const forceUpdateButton = document.getElementById("force-update-button");
        if (forceUpdateButton) {
            forceUpdateButton.addEventListener("click", () => {
                this.forceVolumeUpdate();
            });
        }
        
        // Wake audio system button
        const wakeButton = document.getElementById("wake-button");
        if (wakeButton) {
            wakeButton.addEventListener("click", () => {
                this.wakeAudioContext();
            });
        }
        
        // Save settings button
        const saveButton = document.getElementById("save-button");
        if (saveButton) {
            saveButton.addEventListener("click", () => {
                this.saveSettings();
            });
        }
        
        // Test position sliders
        const testPositionSlider = document.getElementById("test-position");
        if (testPositionSlider) {
            testPositionSlider.addEventListener("input", (e) => {
                const newPosition = parseFloat(e.target.value);
                this.position = newPosition;
                
                // Update volume based on new position
                this.updateCurrentZone();
                this.updateSpatialAudio();
                this.updateUIValues();
            });
        }
    }

    // Toggle audio effect
    toggleEffect(effect, enabled) {
        if (!this.audioContext || !this.effects) return;
        
        this.audioEffects[effect] = enabled;
        
        // Reconnect audio path with or without the effect
        this.reconnectAudioNodes();
        
        console.log(`${effect} effect ${enabled ? 'enabled' : 'disabled'}`);
        this.updateUIValues();
    }

    // Reconnect audio nodes based on current effects state
    reconnectAudioNodes() {
        if (!this.audioContext || !this.effects || !this.gainNodes.master) return;
        
        try {
            // Disconnect all nodes first
            for (const zone in this.gainNodes) {
                if (zone !== 'master') {
                    this.gainNodes[zone].disconnect();
                }
            }
            
            if (this.effects.reverb) this.effects.reverb.disconnect();
            if (this.effects.delay) this.effects.delay.disconnect();
            if (this.effects.compressor) this.effects.compressor.disconnect();
            
            // Reconnect based on enabled effects
            // Start with zone gain nodes
            let lastNode = null;
            
            // Connect zone nodes to first effect or master
            for (const zone in this.gainNodes) {
                if (zone !== 'master') {
                    // Connect to first effect or master
                    if (this.audioEffects.reverb && this.effects.reverb) {
                        this.gainNodes[zone].connect(this.effects.reverb);
                        lastNode = this.effects.reverb;
                    } else if (this.audioEffects.delay && this.effects.delay) {
                        this.gainNodes[zone].connect(this.effects.delay);
                        lastNode = this.effects.delay;
                    } else if (this.audioEffects.compression && this.effects.compressor) {
                        this.gainNodes[zone].connect(this.effects.compressor);
                        lastNode = this.effects.compressor;
                    } else {
                        this.gainNodes[zone].connect(this.gainNodes.master);
                    }
                }
            }
            
            // Connect effects chain
            if (lastNode === this.effects.reverb && this.audioEffects.delay && this.effects.delay) {
                this.effects.reverb.connect(this.effects.delay);
                lastNode = this.effects.delay;
            }
            
            if ((lastNode === this.effects.reverb || lastNode === this.effects.delay) && 
                this.audioEffects.compression && this.effects.compressor) {
                lastNode.connect(this.effects.compressor);
                lastNode = this.effects.compressor;
            }
            
            // Connect last effect to master if not already connected
            if (lastNode && lastNode !== this.gainNodes.master) {
                lastNode.connect(this.gainNodes.master);
            }
            
            console.log("Audio nodes reconnected");
        } catch (error) {
            console.error("Error reconnecting audio nodes:", error);
        }
    }

    // Get electrical power status from sim
    getElectricalStatus() {
        // This could be customized per aircraft to use the right electrical bus
        try {
            return SimVar.GetSimVarValue("ELECTRICAL MASTER BATTERY", "bool");
        } catch (error) {
            // In standalone mode, we default to true if there's an error
            console.warn("Error getting electrical status:", error);
            return true;
        }
    }

    // Update position from simulator variable
    updatePositionFromSim() {
        try {
            // Only proceed if we have electrical power in the airplane
            if (!this.getElectricalStatus()) {
                return;
            }
            
            // Get position from SimVar (aircraft-specific L var)
            let newPosition;
            
            try {
                newPosition = SimVar.GetSimVarValue(this.positionSimVar, "number");
            } catch (error) {
                console.warn(`Error reading SimVar ${this.positionSimVar}:`, error);
                return;
            }
            
            // Check if value is valid
            if (newPosition === null || newPosition === undefined || isNaN(newPosition)) {
                return;
            }
            
            // Only update if the position has changed
            if (newPosition !== this.position) {
                this.position = newPosition;
                
                // Update display, zones, and audio
                this.updateCurrentZone();
                this.updateSpatialAudio();
                this.updateUIValues();
            }
        } catch (error) {
            console.error("Error updating position from sim:", error);
        }
    }

    // Determine current zone based on position
    updateCurrentZone() {
        // Find which zone the current position falls within
        let newZone = "outside"; // Default
        
        for (const zone in this.thresholds) {
            const threshold = this.thresholds[zone];
            // Check if position is between start and end (accounting for negative values)
            const isInZone = threshold.start >= threshold.end 
                ? this.position <= threshold.start && this.position > threshold.end
                : this.position >= threshold.start && this.position < threshold.end;
                
            if (isInZone) {
                newZone = zone;
                break;
            }
        }
        
        // Update the current zone if it changed
        if (newZone !== this.currentZone) {
            this.currentZone = newZone;
        }
    }

    // Update spatial audio volumes based on position
    updateSpatialAudio() {
        if (!this.audioContext) return;
        
        try {
            const currentTime = this.audioContext.currentTime;
            
            // Calculate volume for each zone based on position
            const zoneVolumes = this.calculateSpatialZoneVolumes(this.position);
            
            // Apply calculated volumes with fade
            for (const zone in zoneVolumes) {
                if (this.gainNodes[zone]) {
                    const targetVolume = zoneVolumes[zone];
                    this.smoothlyTransitionZoneVolume(zone, targetVolume, this.fadeDuration);
                }
            }
            
            if (this.debugMode) {
                console.log("Spatial audio updated for position:", this.position, zoneVolumes);
            }
        } catch (error) {
            console.error("Error updating spatial audio:", error);
        }
    }
    
    // Calculate zone volumes based on position
    calculateSpatialZoneVolumes(position) {
        const volumes = {};
        
        try {
            // Loop through each zone
            for (const zone in this.thresholds) {
                const threshold = this.thresholds[zone];
                
                // Default to zero volume
                volumes[zone] = 0;
                
                // Calculate zone center and width
                const zoneCenter = (threshold.start + threshold.end) / 2;
                const zoneWidth = Math.abs(threshold.end - threshold.start);
                
                // Calculate distance from zone center (normalized)
                const distance = Math.abs(position - zoneCenter) / (zoneWidth / 2);
                
                // Calculate volume based on distance (inverse relationship)
                // 1.0 at center, 0.0 at edge or beyond
                if (distance <= 1.0) {
                    // Using cosine curve for smooth falloff
                    volumes[zone] = Math.cos(distance * Math.PI / 2);
                    
                    // Apply zone-specific base volume
                    volumes[zone] *= this.zoneVolumes[zone];
                }
            }
            
            // Find total volume to normalize (prevent excessive gain)
            const totalVolume = Object.values(volumes).reduce((sum, vol) => sum + vol, 0);
            
            // Normalize volumes if total exceeds 1.0
            if (totalVolume > 1.0) {
                for (const zone in volumes) {
                    volumes[zone] /= totalVolume;
                }
            }
        } catch (error) {
            console.error("Error calculating spatial volumes:", error);
        }
        
        return volumes;
    }
    
    // Smoothly transition zone volume
    smoothlyTransitionZoneVolume(zone, targetVolume, fadeDuration) {
        if (!this.audioContext || !this.gainNodes[zone]) return;
        
        try {
            const gainNode = this.gainNodes[zone];
            const currentTime = this.audioContext.currentTime;
            
            // Cancel any scheduled volume changes
            gainNode.gain.cancelScheduledValues(currentTime);
            
            // Get current value
            const currentValue = gainNode.gain.value;
            
            // Set immediate value (needed for smooth transition)
            gainNode.gain.setValueAtTime(currentValue, currentTime);
            
            // Transition to new value
            gainNode.gain.linearRampToValueAtTime(
                targetVolume,
                currentTime + fadeDuration
            );
        } catch (error) {
            console.error(`Error transitioning volume for ${zone}:`, error);
        }
    }

    // Set master volume
    setMasterVolume(volume) {
        if (!this.audioContext || !this.gainNodes.master) return;
        
        try {
            this.masterVolume = volume;
            this.gainNodes.master.gain.setValueAtTime(volume, this.audioContext.currentTime);
            console.log(`Master volume set to ${volume}`);
        } catch (error) {
            console.error("Error setting master volume:", error);
        }
    }

    // Set zone volume
    setZoneVolume(zone, volume) {
        if (!this.audioContext || !this.gainNodes[zone]) return;
        
        try {
            this.zoneVolumes[zone] = volume;
            
            // Update spatial audio to apply new base volume
            this.updateSpatialAudio();
            
            console.log(`${zone} volume set to ${volume}`);
        } catch (error) {
            console.error(`Error setting ${zone} volume:`, error);
        }
    }

    // Reset all volumes to default values
    resetDefaultVolumes() {
        try {
            // Default values
            this.masterVolume = 1.0;
            this.zoneVolumes = {
                outside: 0.45,
                jetway: 0.8,
                cabin: 0.7,
                cockpit: 0.65
            };
            this.fadeDuration = 1.5;
            
            // Apply to audio system
            if (this.audioContext && this.gainNodes.master) {
                this.gainNodes.master.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
            }
            
            // Update spatial audio to apply new volumes
            this.updateSpatialAudio();
            
            // Update UI
            this.updateUIValues();
            
            console.log("All volumes reset to default values");
        } catch (error) {
            console.error("Error resetting volumes:", error);
        }
    }

    // Force update of all audio volumes
    forceVolumeUpdate() {
        try {
            console.log("Force updating all audio volumes...");
            
            // Apply master volume
            if (this.audioContext && this.gainNodes.master) {
                this.gainNodes.master.gain.cancelScheduledValues(this.audioContext.currentTime);
                this.gainNodes.master.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
            }
            
            // Update spatial audio
            this.updateSpatialAudio();
            
            console.log("All audio volumes have been force updated");
        } catch (error) {
            console.error("Error force updating volumes:", error);
        }
    }

    // Save settings to local storage
    saveSettings() {
        try {
            const settings = {
                masterVolume: this.masterVolume,
                zoneVolumes: this.zoneVolumes,
                fadeDuration: this.fadeDuration,
                debugMode: this.debugMode,
                audioEffects: this.audioEffects
            };
            
            localStorage.setItem("audioControlSettings", JSON.stringify(settings));
            console.log("Audio settings saved");
            
            // Show confirmation message
            const saveConfirmation = document.getElementById("save-confirmation");
            if (saveConfirmation) {
                saveConfirmation.style.display = "block";
                setTimeout(() => {
                    saveConfirmation.style.display = "none";
                }, 2000);
            }
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    }

    // Load settings from local storage
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem("audioControlSettings");
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                // Apply loaded settings
                if (settings.masterVolume !== undefined) this.masterVolume = settings.masterVolume;
                if (settings.zoneVolumes) this.zoneVolumes = settings.zoneVolumes;
                if (settings.fadeDuration !== undefined) this.fadeDuration = settings.fadeDuration;
                if (settings.debugMode !== undefined) this.debugMode = settings.debugMode;
                if (settings.audioEffects) this.audioEffects = settings.audioEffects;
                
                // Update audio system with loaded settings
                if (this.audioContext && this.gainNodes.master) {
                    this.gainNodes.master.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
                }
                
                this.updateUIValues();
                this.updateSpatialAudio();
                
                console.log("Audio settings loaded");
            }
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    }

    // Clean up resources before closing
    cleanup() {
        try {
            // Save settings
            this.saveSettings();
            
            // Clear update interval
            if (this.updateIntervalId) {
                clearInterval(this.updateIntervalId);
                this.updateIntervalId = null;
            }
            
            // Close audio context
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            console.log("Audio control system cleaned up");
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    }
}

// Create instance when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create and initialize the audio control
    window.audioControl = new StandaloneAudioControl();
    window.audioControl.initialize();
    
    // Set up cleanup on window unload
    window.addEventListener('beforeunload', () => {
        if (window.audioControl) {
            window.audioControl.cleanup();
        }
    });
}); 