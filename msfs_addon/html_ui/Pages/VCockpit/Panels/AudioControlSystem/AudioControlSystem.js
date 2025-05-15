class AudioControlSystem extends TemplateElement {
    constructor() {
        super();
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
        
        // Update rate for position (ms)
        this.positionUpdateRate = 100;
        this.lastPositionUpdate = 0;
        
        // Aircraft position SimVar name
        this.positionSimVar = "L:AUDIO_POSITION";
        
        // Panel position tracking
        this.dragInfo = {
            isDragging: false,
            startX: 0,
            startY: 0,
            panelX: 0,
            panelY: 0
        };
        
        // Update interval handle
        this.updateInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.initialized = true;
        
        // Initialize system
        this.initializeAudioSystem();
        this.attachEventListeners();
        this.loadSettings();
        
        // Make panel draggable
        this.setupDraggablePanel();
        
        // Setup update interval for position
        this.updateInterval = setInterval(() => {
            this.updatePositionFromSim();
        }, this.positionUpdateRate);
    }

    disconnectedCallback() {
        // Save settings before close
        this.saveSettings();
        
        // Cleanup audio context
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
        
        // Clear update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        super.disconnectedCallback();
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
            
            console.log("Audio system initialized successfully");
            
            // Set initial values for UI
            this.updateUIValues();
            
            // Update audio status display
            this.updateAudioStatus();
        } catch (error) {
            console.error("Error initializing audio system:", error);
            this.updateAudioStatus("Error");
        }
    }

    // Make panel draggable
    setupDraggablePanel() {
        const panel = document.getElementById("AudioControlSystemPanel");
        const header = document.querySelector(".header");
        
        if (!panel || !header) return;
        
        header.addEventListener("mousedown", (e) => {
            // Only activate on header area, not controls
            if (e.target.classList.contains("window-control")) {
                return;
            }
            
            this.dragInfo.isDragging = true;
            this.dragInfo.startX = e.clientX;
            this.dragInfo.startY = e.clientY;
            this.dragInfo.panelX = panel.offsetLeft;
            this.dragInfo.panelY = panel.offsetTop;
            
            // Prevent text selection during drag
            e.preventDefault();
        });
        
        document.addEventListener("mousemove", (e) => {
            if (!this.dragInfo.isDragging) return;
            
            const dx = e.clientX - this.dragInfo.startX;
            const dy = e.clientY - this.dragInfo.startY;
            
            panel.style.left = (this.dragInfo.panelX + dx) + "px";
            panel.style.top = (this.dragInfo.panelY + dy) + "px";
        });
        
        document.addEventListener("mouseup", () => {
            this.dragInfo.isDragging = false;
        });
    }

    // Attach event listeners to UI controls
    attachEventListeners() {
        // Window controls
        const minimizeBtn = document.getElementById("minimize-btn");
        const closeBtn = document.getElementById("close-btn");
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener("click", () => {
                this.saveSettings();
                Coherent.call("MINIMIZE_WINDOW", 0);
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                this.saveSettings();
                Coherent.trigger("AUDIO_CONTROL_TOGGLE_DISPLAY", false);
            });
        }
        
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
        
        // Wake audio system button
        const wakeButton = document.getElementById("wake-button");
        if (wakeButton) {
            wakeButton.addEventListener("click", () => {
                this.wakeAudioSystem();
            });
        }
        
        // Force update button
        const forceUpdateButton = document.getElementById("force-update-button");
        if (forceUpdateButton) {
            forceUpdateButton.addEventListener("click", () => {
                this.forceVolumeUpdate();
            });
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
        
        // Update position marker in visualizer
        this.updatePositionMarker();
    }
    
    // Update the position marker in the zone visualizer
    updatePositionMarker() {
        const marker = document.getElementById("position-marker");
        if (!marker) return;
        
        // Calculate normalized position (0-100%)
        const normalizedPos = this.normalizePosition(this.position);
        marker.style.left = `${normalizedPos}%`;
    }
    
    // Normalize position value to percentage for visualizer
    normalizePosition(position) {
        try {
            // Find the min/max values across all thresholds
            const allThresholds = Object.values(this.thresholds);
            const minVal = Math.min(...allThresholds.map(t => Math.min(t.start, t.end)));
            const maxVal = Math.max(...allThresholds.map(t => Math.max(t.start, t.end)));
            const range = Math.abs(maxVal - minVal);
            
            // Normalize to 0-100% (reversed for negative values)
            return 100 - ((position - minVal) / range * 100);
        } catch (error) {
            console.error("Error normalizing position:", error);
            return 50; // Default to middle
        }
    }

    // Update audio context status display
    updateAudioStatus(status) {
        const statusElement = document.getElementById("audio-status");
        if (!statusElement) return;
        
        if (!status && this.audioContext) {
            status = this.audioContext.state;
        }
        
        statusElement.textContent = status || "Unknown";
        statusElement.className = "status-value " + (status || "").toLowerCase();
    }

    // Update position from simulator variable
    updatePositionFromSim() {
        try {
            // Get position from SimVar (L var)
            const newPosition = SimVar.GetSimVarValue(this.positionSimVar, "number");
            
            // Only update if the position is valid and has changed
            if (newPosition !== null && !isNaN(newPosition) && newPosition !== this.position) {
                this.position = newPosition;
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
        
        const currentTime = this.audioContext.currentTime;
        
        // Calculate transition factors for each zone
        let zoneFactors = {};
        
        for (const zone in this.thresholds) {
            const threshold = this.thresholds[zone];
            
            // Calculate how far the current position is from the zone center
            const zoneCenter = (threshold.start + threshold.end) / 2;
            const zoneWidth = Math.abs(threshold.end - threshold.start);
            const distanceFromCenter = Math.abs(this.position - zoneCenter);
            
            // Calculate a factor (0-1) based on proximity to center
            // 1 = at center, 0 = at edge or beyond
            let factor = 0;
            if (distanceFromCenter < zoneWidth / 2) {
                // Linear falloff from center to edge
                factor = 1 - (distanceFromCenter / (zoneWidth / 2));
                // Apply a smoother curve
                factor = Math.pow(factor, 2);
            }
            
            zoneFactors[zone] = factor;
        }
        
        // Apply the calculated factors to gain nodes
        for (const zone in zoneFactors) {
            if (this.gainNodes[zone]) {
                const targetGain = this.zoneVolumes[zone] * zoneFactors[zone];
                this.gainNodes[zone].gain.cancelScheduledValues(currentTime);
                this.gainNodes[zone].gain.setTargetAtTime(
                    targetGain,
                    currentTime, 
                    this.fadeDuration / 3 // Time constant
                );
            }
        }
    }

    // Set master volume
    setMasterVolume(volume) {
        if (!this.audioContext || !this.gainNodes.master) return;
        
        this.masterVolume = volume;
        this.gainNodes.master.gain.setValueAtTime(
            volume,
            this.audioContext.currentTime
        );
    }

    // Set zone volume
    setZoneVolume(zone, volume) {
        if (!this.audioContext || !this.gainNodes[zone]) return;
        
        this.zoneVolumes[zone] = volume;
        this.updateSpatialAudio(); // Recalculate spatial audio with new volume
    }

    // Reset all volumes to defaults
    resetDefaultVolumes() {
        this.masterVolume = 1.0;
        this.fadeDuration = 1.5;
        this.zoneVolumes = {
            outside: 0.45,
            jetway: 0.8,
            cabin: 0.7,
            cockpit: 0.65
        };
        
        // Apply these values
        if (this.audioContext) {
            this.setMasterVolume(this.masterVolume);
            for (const zone in this.zoneVolumes) {
                this.setZoneVolume(zone, this.zoneVolumes[zone]);
            }
        }
        
        this.updateUIValues();
    }

    // Wake up the audio system
    async wakeAudioSystem() {
        try {
            console.log("Manual wake up of audio system initiated");
            
            // Get audio context
            if (!this.audioContext) {
                await this.initializeAudioSystem();
            }
            
            // Resume audio context (important for browsers that suspend by default)
            if (this.audioContext.state !== 'running') {
                console.log(`Resuming AudioContext (current state: ${this.audioContext.state})`);
                await this.audioContext.resume();
                console.log(`AudioContext state after resume attempt: ${this.audioContext.state}`);
            }
            
            // Try to make a small sound to fully activate the audio system
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            // Set to a very quiet level
            gain.gain.value = 0.01;
            
            // Connect and play a short beep
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            osc.frequency.value = 440;
            osc.start();
            
            // Stop after 100ms
            setTimeout(() => {
                osc.stop();
                osc.disconnect();
                gain.disconnect();
                console.log("Wake-up sound completed");
                
                // After wake-up, force update all volume settings
                this.forceVolumeUpdate();
                
                // Update status immediately
                this.updateAudioStatus();
            }, 100);
            
        } catch (error) {
            console.error("Error during manual audio system wake-up:", error);
            this.updateAudioStatus("Error");
        }
    }

    // Force update all audio volumes and settings
    forceVolumeUpdate() {
        try {
            console.log("Force updating all audio volumes and settings...");
            
            // Get audio context
            if (!this.audioContext) {
                console.warn("Audio context not initialized");
                return;
            }
            
            // Ensure audio context is running
            if (this.audioContext.state !== 'running') {
                console.log(`AudioContext state is ${this.audioContext.state}, attempting to resume...`);
                this.audioContext.resume().catch(err => {
                    console.error("Failed to resume AudioContext:", err);
                });
            }
            
            // Apply master volume with direct node access
            const masterGain = this.gainNodes.master;
            if (masterGain) {
                // Cancel any scheduled ramps
                masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
                // Set value immediately
                masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
                console.log(`Applied master volume: ${this.masterVolume.toFixed(2)} directly to node`);
            }
            
            // Apply zone volumes with direct node access
            console.log("Directly applying zone volumes:");
            Object.entries(this.zoneVolumes).forEach(([zone, volume]) => {
                const gainNode = this.gainNodes[zone];
                if (gainNode) {
                    // Cancel any scheduled ramps
                    gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
                    // Set value immediately
                    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
                    console.log(`- ${zone}: ${volume.toFixed(2)}`);
                }
            });
            
            // Apply spatial audio
            console.log("Applying spatial audio for current position:", this.position);
            this.updateSpatialAudio();
            
            // Update status
            this.updateAudioStatus();
            
            console.log("All audio volumes and settings have been force updated");
        } catch (error) {
            console.error('Error force updating audio settings:', error);
        }
    }

    // Save settings to sim variables
    saveSettings() {
        // Save to sim variables
        SimVar.SetSimVarValue("L:AUDIO_MASTER_VOLUME", "number", this.masterVolume);
        SimVar.SetSimVarValue("L:AUDIO_FADE_DURATION", "number", this.fadeDuration);
        
        for (const zone in this.zoneVolumes) {
            SimVar.SetSimVarValue(`L:AUDIO_${zone.toUpperCase()}_VOLUME`, "number", this.zoneVolumes[zone]);
        }
        
        // Save panel position
        const panel = document.getElementById("AudioControlSystemPanel");
        if (panel) {
            SimVar.SetSimVarValue("L:AUDIO_PANEL_POS_X", "number", parseInt(panel.style.left) || 100);
            SimVar.SetSimVarValue("L:AUDIO_PANEL_POS_Y", "number", parseInt(panel.style.top) || 100);
        }
        
        console.log("Audio settings saved to sim variables");
    }

    // Load settings from sim variables
    loadSettings() {
        // Load volume settings if they exist
        const savedMasterVolume = SimVar.GetSimVarValue("L:AUDIO_MASTER_VOLUME", "number");
        if (savedMasterVolume !== null && !isNaN(savedMasterVolume)) {
            this.masterVolume = savedMasterVolume;
        }
        
        const savedFadeDuration = SimVar.GetSimVarValue("L:AUDIO_FADE_DURATION", "number");
        if (savedFadeDuration !== null && !isNaN(savedFadeDuration)) {
            this.fadeDuration = savedFadeDuration;
        }
        
        for (const zone in this.zoneVolumes) {
            const savedVolume = SimVar.GetSimVarValue(`L:AUDIO_${zone.toUpperCase()}_VOLUME`, "number");
            if (savedVolume !== null && !isNaN(savedVolume)) {
                this.zoneVolumes[zone] = savedVolume;
            }
        }
        
        // Load panel position
        const panel = document.getElementById("AudioControlSystemPanel");
        if (panel) {
            const savedPosX = SimVar.GetSimVarValue("L:AUDIO_PANEL_POS_X", "number");
            const savedPosY = SimVar.GetSimVarValue("L:AUDIO_PANEL_POS_Y", "number");
            
            if (savedPosX !== null && !isNaN(savedPosX)) {
                panel.style.left = `${savedPosX}px`;
            }
            
            if (savedPosY !== null && !isNaN(savedPosY)) {
                panel.style.top = `${savedPosY}px`;
            }
        }
        
        // Apply loaded settings
        if (this.audioContext) {
            this.setMasterVolume(this.masterVolume);
            this.updateSpatialAudio();
        }
        
        this.updateUIValues();
        console.log("Audio settings loaded from sim variables");
    }

    // Set tracking position manually (for testing)
    setTestPosition(position) {
        this.position = position;
        this.updateCurrentZone();
        this.updateSpatialAudio();
        this.updateUIValues();
    }

    // Override this method to allow it to run in a frame
    get templateID() { return "AudioControlSystemTemplate"; }
}

window.customElements.define("audio-control-system", AudioControlSystem);

// Toolbar-related code
class AudioControlButton extends TemplateElement {
    constructor() {
        super();
        this.isVisible = false;
    }

    connectedCallback() {
        super.connectedCallback();
        
        this.audioControlPanel = null;
        
        // Register to events
        Coherent.on("AUDIO_CONTROL_TOGGLE_DISPLAY", (show) => {
            this.toggleDisplay(show);
        });
        
        // Register for toolbar clicks
        const toolbar = document.getElementById("AudioControlButton");
        if (toolbar) {
            toolbar.addEventListener("mouseup", () => {
                this.toggleDisplay(!this.isVisible);
            });
        }
    }

    toggleDisplay(show) {
        if (show === this.isVisible) return;
        
        this.isVisible = show;
        
        if (show) {
            // Create and show panel
            if (!this.audioControlPanel) {
                this.createPanel();
            } else {
                this.showPanel();
            }
        } else {
            // Hide panel
            this.hidePanel();
        }
        
        // Update toolbar button state
        const btn = document.getElementById("AudioControlButton");
        if (btn) {
            btn.classList.toggle("active", show);
        }
    }

    createPanel() {
        // Create panel window
        Coherent.trigger("PANEL_WINDOW_CREATE", {
            id: "AudioControlPanel",
            path: "VCockpit/Panels/AudioControlSystem/AudioControlSystem.html",
            width: 400,
            height: 600,
            transparent: true,
            zOrder: 10,
            visible: true,
            resizable: false
        });
        
        this.isVisible = true;
    }

    showPanel() {
        Coherent.trigger("PANEL_WINDOW_SHOW", "AudioControlPanel");
        this.isVisible = true;
    }

    hidePanel() {
        Coherent.trigger("PANEL_WINDOW_HIDE", "AudioControlPanel");
        this.isVisible = false;
    }

    get templateID() { return "AudioControlButtonTemplate"; }
}

window.customElements.define("audio-control-button", AudioControlButton);

// Toolbar button registration
function registerToolbarButton() {
    ToolBar.addButton({
        id: "AudioControlButton",
        label: "Audio Control",
        icon: "/Pages/VCockpit/Panels/AudioControlSystem/Icon_Audio.svg",
        template: `<button id="AudioControlButton" class="toolbar-button"></button>`,
        visible: true,
        callback: () => {
            Coherent.trigger("AUDIO_CONTROL_TOGGLE_DISPLAY", true);
        }
    });
    
    console.log("Audio Control System toolbar button registered");
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    registerToolbarButton();
}); 