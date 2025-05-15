# Audio Sample Integration Guide

This guide explains how to add and configure audio samples for use with the Audio Control Panel. You can add these code snippets to the `AudioControl.js` file or create a custom extension.

## Loading Audio Samples

Add the following method to the `AudioControlPanel` class to load audio samples:

```javascript
// Method to load audio samples
async loadAudioSamples() {
  try {
    // Define the base path for audio files
    const basePath = "/Pages/VCockpit/Instruments/AudioControl/sounds/";
    
    // Define audio samples with their zones
    const audioSamples = [
      { name: "ambient_outside", url: `${basePath}ambient_outside.mp3`, zone: "outside", loop: true },
      { name: "ambient_jetway", url: `${basePath}ambient_jetway.mp3`, zone: "jetway", loop: true },
      { name: "ambient_cabin", url: `${basePath}ambient_cabin.mp3`, zone: "cabin", loop: true },
      { name: "ambient_cockpit", url: `${basePath}ambient_cockpit.mp3`, zone: "cockpit", loop: true },
      { name: "door_open", url: `${basePath}door_open.mp3`, zone: "jetway", loop: false },
      { name: "door_close", url: `${basePath}door_close.mp3`, zone: "jetway", loop: false },
      { name: "button_click", url: `${basePath}button_click.mp3`, zone: "cockpit", loop: false }
    ];
    
    // Create storage for audio buffers and sources
    this.audioBuffers = {};
    
    // Load each audio sample
    for (const sample of audioSamples) {
      await this.loadAudioSample(sample.name, sample.url, sample.zone, sample.loop);
    }
    
    console.log("All audio samples loaded successfully");
    
    // Start looping ambient sounds
    this.playAmbientSounds();
    
  } catch (error) {
    console.error("Error loading audio samples:", error);
  }
}

// Helper method to load a single audio sample
async loadAudioSample(name, url, zone, loop = false) {
  try {
    // Fetch the audio file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
    }
    
    // Get the array buffer from the response
    const arrayBuffer = await response.arrayBuffer();
    
    // Decode the audio data
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Store the decoded buffer with its configuration
    this.audioBuffers[name] = {
      buffer: audioBuffer,
      zone: zone,
      loop: loop
    };
    
    console.log(`Loaded audio sample: ${name} for zone: ${zone}`);
    return true;
    
  } catch (error) {
    console.error(`Error loading audio sample ${name}:`, error);
    return false;
  }
}

// Play a specific audio sample
playAudioSample(name, options = {}) {
  if (!this.audioContext || !this.audioBuffers[name]) {
    console.warn(`Cannot play audio sample ${name}: not loaded`);
    return null;
  }
  
  try {
    const sampleConfig = this.audioBuffers[name];
    const zone = options.zone || sampleConfig.zone;
    
    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = sampleConfig.buffer;
    source.loop = options.loop !== undefined ? options.loop : sampleConfig.loop;
    
    // Create gain node for this specific sound
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0;
    
    // Connect to the appropriate zone
    source.connect(gainNode);
    gainNode.connect(this.gainNodes[zone] || this.gainNodes.master);
    
    // Apply fade-in if specified
    if (options.fadeIn) {
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        options.volume || 1.0,
        this.audioContext.currentTime + options.fadeIn
      );
    }
    
    // Start playback
    source.start();
    
    // Set up stop time with fade-out if needed
    if (options.duration) {
      const stopTime = this.audioContext.currentTime + options.duration;
      
      if (options.fadeOut) {
        const fadeStartTime = stopTime - options.fadeOut;
        gainNode.gain.setValueAtTime(options.volume || 1.0, fadeStartTime);
        gainNode.gain.linearRampToValueAtTime(0, stopTime);
      }
      
      source.stop(stopTime);
    }
    
    // Store reference and return it
    const sourceId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    this.audioSources[sourceId] = {
      source: source,
      gainNode: gainNode,
      name: name
    };
    
    // Clean up after playback ends
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
      delete this.audioSources[sourceId];
    };
    
    return sourceId;
    
  } catch (error) {
    console.error(`Error playing audio sample ${name}:`, error);
    return null;
  }
}

// Stop a specific audio source
stopAudioSample(sourceId, fadeOut = 0) {
  if (!this.audioSources[sourceId]) {
    return false;
  }
  
  try {
    const sourceData = this.audioSources[sourceId];
    const currentTime = this.audioContext.currentTime;
    
    if (fadeOut > 0) {
      // Apply fade-out
      sourceData.gainNode.gain.setValueAtTime(
        sourceData.gainNode.gain.value,
        currentTime
      );
      sourceData.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOut);
      
      // Stop the source after fade-out
      setTimeout(() => {
        if (sourceData.source) {
          sourceData.source.stop();
        }
      }, fadeOut * 1000);
    } else {
      // Stop immediately
      sourceData.source.stop();
    }
    
    return true;
  } catch (error) {
    console.error(`Error stopping audio sample ${sourceId}:`, error);
    return false;
  }
}

// Play ambient sounds for each zone
playAmbientSounds() {
  // Start ambient sounds for each zone with proper looping
  this.ambientSources = {
    outside: this.playAudioSample("ambient_outside", { loop: true, fadeIn: this.fadeDuration }),
    jetway: this.playAudioSample("ambient_jetway", { loop: true, fadeIn: this.fadeDuration }),
    cabin: this.playAudioSample("ambient_cabin", { loop: true, fadeIn: this.fadeDuration }),
    cockpit: this.playAudioSample("ambient_cockpit", { loop: true, fadeIn: this.fadeDuration })
  };
}
```

## Integration with Aircraft Events

Add this method to trigger aircraft-specific sounds:

```javascript
// Trigger sound for a specific aircraft event
triggerEventSound(eventName, options = {}) {
  switch (eventName) {
    case "DOOR_OPEN":
      return this.playAudioSample("door_open", options);
      
    case "DOOR_CLOSE":
      return this.playAudioSample("door_close", options);
      
    case "BUTTON_CLICK":
      return this.playAudioSample("button_click", {
        volume: options.volume || 0.5,
        ...options
      });
      
    default:
      console.warn(`Unknown event sound: ${eventName}`);
      return null;
  }
}
```

## Calling From Aircraft Code

To trigger sounds from your aircraft code:

```javascript
// Example aircraft code for triggering sounds
function onDoorOpen() {
  // This assumes you've set up a way to access the AudioControlPanel instrument
  const audioPanel = getAudioControlPanel(); // Implement this to get the audio panel instance
  
  if (audioPanel) {
    audioPanel.triggerEventSound("DOOR_OPEN", {
      volume: 0.8,
      fadeOut: 2.0
    });
  }
}

// Example of how to get the audio panel
function getAudioControlPanel() {
  // Get the instrument by ID (methods will vary based on your setup)
  const panelElement = document.getElementById("AudioControlPanel");
  if (panelElement && panelElement.instrument) {
    return panelElement.instrument;
  }
  return null;
}
```

## Folder Structure

Create this folder structure for your audio files:

```
msfs_addon/
  html_ui/
    Pages/
      VCockpit/
        Instruments/
          AudioControl/
            sounds/
              ambient_outside.mp3
              ambient_jetway.mp3
              ambient_cabin.mp3
              ambient_cockpit.mp3
              door_open.mp3
              door_close.mp3
              button_click.mp3
```

## Audio Format Recommendations

For best compatibility in MSFS:

- Format: MP3 or OGG
- Sample Rate: 44.1 kHz
- Bit Rate: 128-192 kbps
- Channels: Stereo

Keep files small to minimize loading time and memory usage. Ambient loops should be 15-30 seconds in length with seamless looping. 