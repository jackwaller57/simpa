# Audio Control Panel Implementation Notes

This document provides technical details about how the in-sim Audio Control Panel works.

## Architecture

The Audio Control Panel is implemented as an HTML Gauge in Microsoft Flight Simulator 2020. It consists of:

1. **HTML/CSS UI** - Provides the user interface for adjusting audio settings
2. **JavaScript Logic** - Manages audio processing, zone transitions, and interaction with MSFS
3. **Web Audio API** - Used for audio processing and spatial audio effects
4. **SimVars Integration** - Communicates with the simulator using local variables

## Core Components

### 1. BaseInstrument Integration

The `AudioControlPanel` class extends MSFS's `BaseInstrument`, which provides:
- Lifecycle management (initialization, updates, cleanup)
- SimVar access for reading/writing simulator variables
- Integration with the MSFS rendering system

### 2. Audio Processing

The panel uses Web Audio API to create a spatial audio experience:
- Master gain node for overall volume control
- Zone-specific gain nodes for area-based volume control
- Dynamic gain adjustment based on position within the aircraft
- Smooth transitions between zones using exponential ramps

### 3. Position Tracking

The current position in the aircraft is tracked using a custom SimVar:
- `L:AUDIO_POSITION` - A number from 0 (outside) to -24.3 (deep in cockpit)
- This value must be updated by the aircraft's JavaScript code based on camera position
- The audio panel reads this value and determines the current zone

### 4. Zone Management

Zones are defined with threshold values that map to positions:
```javascript
this.thresholds = {
  outside: { start: 0.0, end: -1.6 },
  jetway: { start: -1.6, end: -12.0 },
  cabin: { start: -12.0, end: -22.4 },
  cockpit: { start: -22.4, end: -24.3 }
};
```

The current zone is calculated by checking which threshold range contains the current position value.

### 5. Spatial Audio Algorithm

The panel uses a custom algorithm for smooth spatial transitions:
1. Calculate the center point of each zone
2. Determine how far the current position is from each zone center
3. Apply a non-linear falloff curve based on distance (quadratic)
4. Set gain values for each zone with smooth transitions

## State Management

State is persisted using SimVars:
- `L:AUDIO_MASTER_VOLUME` - Master volume level
- `L:AUDIO_FADE_DURATION` - Transition time between zones
- `L:AUDIO_OUTSIDE_VOLUME` - Volume for outside zone
- `L:AUDIO_JETWAY_VOLUME` - Volume for jetway zone
- `L:AUDIO_CABIN_VOLUME` - Volume for cabin zone
- `L:AUDIO_COCKPIT_VOLUME` - Volume for cockpit zone

This allows settings to persist between simulator sessions.

## Electrical Integration

The panel is tied to the aircraft's electrical system:
- Uses `ELECTRICAL MASTER BATTERY` SimVar to check power state
- Disables the panel when power is off
- Saves settings before power loss
- Resumes audio context when power is restored

## SimVar Updates

The Update() method is called on each simulator frame and performs these tasks:
- Checks electrical power state
- Reads position data on a throttled interval
- Updates the current zone based on position
- Applies spatial audio calculations
- Updates the UI with current values

## Web Audio API Usage

The implementation takes advantage of these Web Audio API features:
1. `GainNode` for volume control
2. `setTargetAtTime()` for smooth transitions
3. `AudioContext` for managing the audio graph
4. `AudioBufferSourceNode` for playing sounds

## Extension Points

The panel design includes several extension points:
1. **Audio Sample Loading** - Can be extended to load custom sounds
2. **Effects Processing** - Additional audio effects can be added
3. **Zone Configuration** - Thresholds can be customized per aircraft
4. **Custom Events** - Aircraft-specific audio events can be added

## Performance Considerations

To maintain good simulator performance:
- Audio processing is kept minimal
- Position updates are throttled (100ms)
- Audio nodes are created only once at initialization
- AudioContext is suspended when not in use

## Browser Compatibility

The code uses modern JavaScript features and Web Audio API, which are supported in the WebView used by MSFS 2020. No polyfills are required. 