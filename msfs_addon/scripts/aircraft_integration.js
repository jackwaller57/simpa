/**
 * Audio Control System - Aircraft Integration Script
 * 
 * This script helps aircraft developers integrate the Audio Control System
 * by automatically updating the L:AUDIO_POSITION variable based on camera position.
 * 
 * HOW TO USE:
 * 1. Copy this file to your aircraft's panel/scripts folder
 * 2. Load it in your panel.xml by adding:
 *    <script src="scripts/aircraft_integration.js" />
 * 3. Initialize in your aircraft's main script:
 *    audioPositionTracker.initialize({
 *      // Customize with your aircraft's specific settings
 *    });
 */

const audioPositionTracker = (function() {
    // Default configuration
    let config = {
        // Reference point (usually main door or entrance)
        referencePoint: { x: 0, y: 0, z: 0 },
        
        // Aircraft dimensions
        length: 30,      // Aircraft length in meters
        cabinLength: 20, // Length of passenger cabin
        
        // Zone thresholds (position values)
        zones: {
            outside: { start: 0.0, end: -1.6 },
            jetway: { start: -1.6, end: -12.0 },
            cabin: { start: -12.0, end: -22.4 },
            cockpit: { start: -22.4, end: -24.3 }
        },
        
        // Update frequency (ms)
        updateRate: 500,
        
        // Debug mode
        debug: false
    };
    
    // Internal state
    let state = {
        initialized: false,
        updateInterval: null,
        lastPosition: 0,
        lastCamera: { x: 0, y: 0, z: 0 }
    };
    
    /**
     * Initialize the audio position tracker with custom configuration
     * @param {Object} customConfig - Custom configuration to override defaults
     */
    function initialize(customConfig = {}) {
        // Merge custom config with defaults
        config = { ...config, ...customConfig };
        
        if (state.initialized) {
            console.log("Audio position tracker already initialized");
            return;
        }
        
        // Start update loop
        state.updateInterval = setInterval(updateAudioPosition, config.updateRate);
        state.initialized = true;
        
        console.log("Audio position tracker initialized with config:", config);
    }
    
    /**
     * Update the L:AUDIO_POSITION variable based on camera position
     */
    function updateAudioPosition() {
        try {
            // Get camera position
            const cameraX = SimVar.GetSimVarValue("CAMERA POSITION X", "meters");
            const cameraY = SimVar.GetSimVarValue("CAMERA POSITION Y", "meters");
            const cameraZ = SimVar.GetSimVarValue("CAMERA POSITION Z", "meters");
            
            // Skip if camera hasn't moved
            if (cameraX === state.lastCamera.x && 
                cameraY === state.lastCamera.y && 
                cameraZ === state.lastCamera.z) {
                return;
            }
            
            // Store last camera position
            state.lastCamera = { x: cameraX, y: cameraY, z: cameraZ };
            
            // Check if using a virtual cockpit view
            const viewId = SimVar.GetSimVarValue("CAMERA STATE", "number");
            const isInterior = isInteriorView(viewId);
            
            // Calculate position value based on distance from reference
            let position;
            
            if (!isInterior) {
                // Outside the aircraft
                position = 0.0;
            } else {
                // Calculate distance from reference point
                const dx = cameraX - config.referencePoint.x;
                const dy = cameraY - config.referencePoint.y;
                const dz = cameraZ - config.referencePoint.z;
                
                // Use distance as position factor
                // Negative values mean we're moving deeper into the aircraft
                position = calculatePositionValue(dx, dy, dz, viewId);
            }
            
            // Only update if position has changed significantly
            if (Math.abs(position - state.lastPosition) > 0.05) {
                state.lastPosition = position;
                
                // Update the SimVar
                SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", position);
                
                if (config.debug) {
                    console.log(`Updated audio position: ${position.toFixed(2)}`);
                }
            }
        } catch (error) {
            console.error("Error updating audio position:", error);
        }
    }
    
    /**
     * Calculate position value based on camera location
     * @param {number} dx - X distance from reference
     * @param {number} dy - Y distance from reference
     * @param {number} dz - Z distance from reference
     * @param {number} viewId - Camera view ID
     * @returns {number} Position value (0 to -24.3)
     */
    function calculatePositionValue(dx, dy, dz, viewId) {
        // Check if we're using a cockpit view
        if (isCockpitView(viewId)) {
            // In cockpit view, use a value in the cockpit zone
            return randomInRange(config.zones.cockpit.start, config.zones.cockpit.end);
        }
        
        // Simple distance-based calculation (negative means inside)
        // Scaled to match the zones
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const normalizedDistance = distance / config.length;
        
        // Map to position value (0 to -24.3)
        let position;
        
        if (normalizedDistance < 0.1) {
            // Near entrance (jetway)
            position = randomInRange(config.zones.jetway.start, config.zones.jetway.end * 0.3);
        } else if (normalizedDistance < 0.5) {
            // In cabin (front half)
            position = randomInRange(config.zones.cabin.start, 
                (config.zones.cabin.start + config.zones.cabin.end) / 2);
        } else if (normalizedDistance < 0.8) {
            // In cabin (back half)
            position = randomInRange((config.zones.cabin.start + config.zones.cabin.end) / 2, 
                config.zones.cabin.end);
        } else {
            // In cockpit
            position = randomInRange(config.zones.cockpit.start, config.zones.cockpit.end);
        }
        
        return position;
    }
    
    /**
     * Check if current view is an interior view
     * @param {number} viewId - Camera view ID
     * @returns {boolean} True if interior view
     */
    function isInteriorView(viewId) {
        // Interior view IDs (may vary by simulator version)
        const interiorViews = [1, 2, 3, 4, 5, 7, 8, 9, 23, 24, 25, 26, 27, 28, 29, 30];
        return interiorViews.includes(viewId);
    }
    
    /**
     * Check if current view is a cockpit view
     * @param {number} viewId - Camera view ID
     * @returns {boolean} True if cockpit view
     */
    function isCockpitView(viewId) {
        // Cockpit view IDs (may vary by simulator version)
        const cockpitViews = [1, 4, 23, 24, 25, 26, 27, 28, 29, 30];
        return cockpitViews.includes(viewId);
    }
    
    /**
     * Generate a random number in a range (for slight variations)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random value in range
     */
    function randomInRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
            state.updateInterval = null;
        }
        state.initialized = false;
    }
    
    /**
     * Set a fixed position for testing
     * @param {number} position - Position value
     */
    function setTestPosition(position) {
        SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", position);
        state.lastPosition = position;
        console.log(`Manually set audio position: ${position}`);
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration values
     */
    function updateConfig(newConfig) {
        config = { ...config, ...newConfig };
        console.log("Updated audio position tracker config:", config);
    }
    
    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether debug is enabled
     */
    function setDebug(enabled) {
        config.debug = enabled;
        console.log(`Audio position tracker debug mode: ${enabled}`);
    }
    
    // Public API
    return {
        initialize,
        cleanup,
        setTestPosition,
        updateConfig,
        setDebug
    };
})();

// Register to sim events if we're in a simulator context
if (typeof SimVar !== 'undefined') {
    // Check for simulator start
    document.addEventListener('onSimStart', function() {
        console.log("Audio Position Tracker detected simulator start");
        // Auto-initialize with defaults after a delay
        setTimeout(() => {
            if (!audioPositionTracker.initialized) {
                audioPositionTracker.initialize();
            }
        }, 5000);
    });
    
    // Clean up on simulator stop
    document.addEventListener('onSimStop', function() {
        audioPositionTracker.cleanup();
    });
}

/**
 * Aircraft Audio System Integration
 * 
 * This script demonstrates how to set the L:AUDIO_POSITION variable 
 * that controls the Audio Control System. Aircraft developers
 * can use this as a reference for integrating the audio system
 * into their aircraft.
 */

// The audio zones are defined as follows:
// outside: { start: 0.0, end: -1.6 }
// jetway: { start: -1.6, end: -12.0 }
// cabin: { start: -12.0, end: -22.4 }
// cockpit: { start: -22.4, end: -24.3 }

// Position values (in meters):
//  0.0: Outside the aircraft, far from the doors
// -1.6: At the aircraft door
// -12.0: Inside the cabin, midway through
// -22.4: At the cockpit door
// -24.3: Inside the cockpit, pilot seat

class AudioPositionSystem {
    constructor() {
        this.position = 0.0; // Default to outside position
        this.isInitialized = false;
        this.lastUpdate = 0;
        this.updateInterval = 500; // ms
        
        // Camera index to position mapping
        this.cameraPositions = {
            // External views
            "0": 0.0,    // External view
            "1": 0.0,    // External view with panel
            "2": -0.5,   // Close external view
            "3": -1.6,   // Door view
            
            // Internal views 
            "4": -12.0,  // Passenger view
            "5": -22.4,  // Cockpit view (looking forward)
            "6": -23.0,  // Cockpit view (looking backward)
            "7": -24.0,  // Pilot view
            "8": -24.3,  // Co-pilot view
            
            // Custom views (these will be different for each aircraft)
            "9": -15.0,  // Back of cabin
            "10": -8.0,  // Mid cabin
            
            // Add more mappings as needed for your aircraft's camera views
        };
        
        // Track if custom position is being used (from button/switch in VC)
        this.usingCustomPosition = false;
        this.customPosition = 0.0;
    }
    
    /**
     * Initialize the system 
     */
    initialize() {
        try {
            if (this.isInitialized) return;
            
            // Create initial L var
            SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", this.position);
            console.log("[Audio System] Initialized audio position system");
            
            // Set up event listener for custom position changes
            this.setupCustomEvents();
            
            this.isInitialized = true;
        } catch (error) {
            console.error("[Audio System] Error initializing audio position system:", error);
        }
    }
    
    /**
     * Set up custom event listeners for any aircraft-specific events
     * that may change the audio position
     */
    setupCustomEvents() {
        // Example: Listen for door open/close events
        RegisterViewListener("JS_LISTENER_CAMERAS");
        
        // Example: Door switch
        this.monitorDoorState();
    }
    
    /**
     * Update function to be called regularly by the aircraft gauge
     */
    update() {
        try {
            // Check if it's time to update
            const now = Date.now();
            if (now - this.lastUpdate < this.updateInterval) return;
            this.lastUpdate = now;
            
            // Check if we're using a custom position (set by cockpit interaction)
            if (!this.usingCustomPosition) {
                // Update position based on camera view
                this.updatePositionFromCamera();
            }
            
            // Set the position L var for the audio system to use
            SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", this.position);
        } catch (error) {
            console.error("[Audio System] Error updating audio position:", error);
        }
    }
    
    /**
     * Update position based on the current camera view
     */
    updatePositionFromCamera() {
        try {
            // Get current camera index
            const cameraIndex = Simplane.getCameraIndex().toString();
            
            // Look up position for this camera view
            if (this.cameraPositions.hasOwnProperty(cameraIndex)) {
                this.position = this.cameraPositions[cameraIndex];
            } else {
                // Default to outside view if camera not recognized
                this.position = 0.0;
            }
        } catch (error) {
            console.error("[Audio System] Error updating position from camera:", error);
        }
    }
    
    /**
     * Monitor door state (example integration)
     */
    monitorDoorState() {
        try {
            // Example of custom door state monitoring
            // In a real aircraft, you would use the specific door SimVars
            
            // If main door is open, and we're in an external view, adjust position
            // to be closer to the door
            setInterval(() => {
                try {
                    const doorOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:0", "percent") > 50;
                    const cameraIndex = Simplane.getCameraIndex();
                    
                    // If in external view (0, 1, 2) and door is open, position near door
                    if (doorOpen && (cameraIndex === 0 || cameraIndex === 1 || cameraIndex === 2)) {
                        // Only override if not using custom position
                        if (!this.usingCustomPosition) {
                            this.position = -1.0; // Position close to the door from outside
                        }
                    }
                } catch (error) {
                    // Ignore errors in interval
                }
            }, 1000);
        } catch (error) {
            console.error("[Audio System] Error setting up door monitoring:", error);
        }
    }
    
    /**
     * Set a custom position (called from cockpit controls)
     */
    setCustomPosition(position) {
        this.customPosition = position;
        this.position = position;
        this.usingCustomPosition = true;
        
        // Update immediately
        SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", this.position);
    }
    
    /**
     * Clear custom position and return to automatic camera-based positioning
     */
    clearCustomPosition() {
        this.usingCustomPosition = false;
        // The next update() call will set based on camera
    }
}

/**
 * ---- INTEGRATION EXAMPLE ----
 * This shows how to integrate into an aircraft gauge
 */

// Example gauge to integrate with aircraft system
class AudioSystemGauge extends BaseInstrument {
    constructor() {
        super();
        this.audioPositionSystem = new AudioPositionSystem();
    }
    
    connectedCallback() {
        super.connectedCallback();
        this.audioPositionSystem.initialize();
    }
    
    Update() {
        super.Update();
        
        // Update audio position
        this.audioPositionSystem.update();
        
        return true;
    }
    
    // Example method to be called from an aircraft panel button
    setCockpitPosition() {
        this.audioPositionSystem.setCustomPosition(-24.0);
    }
    
    // Example method to be called from an aircraft panel button
    setCabinPosition() {
        this.audioPositionSystem.setCustomPosition(-12.0);
    }
    
    // Example method to be called from an aircraft panel button
    setOutsidePosition() {
        this.audioPositionSystem.setCustomPosition(0.0);
    }
    
    // Example method to return to automatic mode
    setAutoPosition() {
        this.audioPositionSystem.clearCustomPosition();
    }
}

registerInstrument("audio-system-gauge", AudioSystemGauge);

/**
 * ---- USAGE DOCUMENTATION ----
 * 
 * Aircraft developers can integrate this system by:
 * 
 * 1. Including this script in their aircraft, adjusting as needed
 * 2. Adding the gauge to a panel:
 *    <audio-system-gauge></audio-system-gauge>
 * 
 * 3. Setting the L:AUDIO_POSITION SimVar through actions or HTML events:
 *    - For custom buttons that move to a specific location:
 *      <button id="btn_cockpit" on:click="onEvent('setCockpitPosition')"></button>
 * 
 * 4. Customizing the camera position mapping in AudioPositionSystem.cameraPositions
 *    to match your aircraft's specific camera views
 * 
 * 5. Adding custom logic for monitoring doors, passenger positions, etc.
 */ 