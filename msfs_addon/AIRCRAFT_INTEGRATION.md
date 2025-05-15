# Aircraft Audio Control Panel Integration Guide

This document provides detailed instructions for aircraft developers who want to integrate the Audio Control Panel into their aircraft.

## 1. Panel Configuration

Add the following to your aircraft's `panel.cfg` file to include the Audio Control Panel:

```
[VCockpit##] // Use the next available number for your aircraft
size_mm=250,400
pixel_size=1
texture=$AUDIO_CONTROL_PANEL
background_color=0,0,0
htmlgauge00=AudioControl/AudioControl, 0,0,250,400

// Position the panel where you want it to appear
position=8  // Change this to position it appropriately
visible=1
zorder=10
```

## 2. SimVars Setup

The Audio Control Panel uses Local Variables (L:vars) to function correctly. You'll need to set these variables in your aircraft code:

### Required SimVar:

- `L:AUDIO_POSITION` - Sets the current position in the aircraft
  - Range: 0 (outside) to -24.3 (deepest in cockpit)
  - Update this value based on passenger camera position

### Saved Settings:

These are managed by the panel but can be pre-configured:

- `L:AUDIO_MASTER_VOLUME` - Master volume (0-1)
- `L:AUDIO_FADE_DURATION` - Transition time in seconds (0.1-3.0)
- `L:AUDIO_OUTSIDE_VOLUME` - Volume for outside zone (0-1)
- `L:AUDIO_JETWAY_VOLUME` - Volume for jetway zone (0-1)
- `L:AUDIO_CABIN_VOLUME` - Volume for cabin zone (0-1)
- `L:AUDIO_COCKPIT_VOLUME` - Volume for cockpit zone (0-1)

## 3. Updating Position SimVar

Add code to your aircraft to update the position SimVar based on camera location:

### Example in Aircraft JavaScript:

```javascript
// Example function to update audio position based on camera
function updateAudioPosition() {
  // Get camera position (this is just an example, implement based on your specific setup)
  const cameraX = SimVar.GetSimVarValue("CAMERA POSITION X", "meters");
  const cameraY = SimVar.GetSimVarValue("CAMERA POSITION Y", "meters");
  const cameraZ = SimVar.GetSimVarValue("CAMERA POSITION Z", "meters");
  
  // Calculate position value (-24.3 to 0) based on camera location
  // This is a simplified example - you'll need to adapt for your aircraft
  let position = 0; // Default to outside
  
  // Example calculation (you should adapt this to your specific aircraft model)
  const distanceFromEntry = calculateDistanceFromEntryPoint(cameraX, cameraY, cameraZ);
  
  if (distanceFromEntry > 0) {
    // Camera is outside
    position = 0;
  } else {
    // Camera is inside, set position based on distance
    position = distanceFromEntry;
  }
  
  // Update the position SimVar
  SimVar.SetSimVarValue("L:AUDIO_POSITION", "number", position);
}

// Add this to an update loop in your aircraft code
```

## 4. Customizing Audio Zones

The default zones are:
- Outside: 0.0 to -1.6
- Jetway: -1.6 to -12.0
- Cabin: -12.0 to -22.4
- Cockpit: -22.4 to -24.3

If you need to customize these zones for your specific aircraft, you can either:

1. Modify the audio panel JS file directly
2. Add a `modelConfiguration.xml` file to your aircraft that overrides the default settings

### Custom Configuration Example:

```xml
<ModelBehaviors>
  <Component ID="AUDIO_CONTROL">
    <Configuration Name="AUDIO_ZONES">
      <Threshold Name="Outside" Start="0.0" End="-2.0" />
      <Threshold Name="Jetway" Start="-2.0" End="-10.0" />
      <Threshold Name="Cabin" Start="-10.0" End="-18.0" />
      <Threshold Name="Cockpit" Start="-18.0" End="-22.0" />
    </Configuration>
  </Component>
</ModelBehaviors>
```

## 5. Testing

To test the integration:
1. Install both your aircraft and this add-on
2. Start the simulator and load your aircraft
3. Verify the audio panel appears in the designated position
4. Move the camera in and out of the aircraft to test zone transitions
5. Adjust volumes to confirm the panel is functional

## Troubleshooting

- Panel doesn't appear: Check panel.cfg configuration
- No sound transitions: Verify L:AUDIO_POSITION is being updated
- Panel unresponsive: Check for electrical power (panel requires battery power) 