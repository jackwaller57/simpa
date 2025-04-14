/**
 * Super simple zone determination with fixed boundaries
 */

// Zone boundaries
const ZONE_BOUNDARIES = {
  OUTSIDE_MIN: -1.60, // Zone is "outside" when z > -1.60
  JETWAY_MIN: -12.0,  // Zone is "jetway" when -12.0 < z <= -1.60
  CABIN_MIN: -22.4,   // Zone is "cabin" when -22.4 < z <= -12.0
  COCKPIT_MIN: -24.3, // Zone is "cockpit" when -24.3 < z <= -22.4
};

// Minimum change required to update zone (prevents tiny movements from triggering zone changes)
const MIN_POSITION_CHANGE = 0.3;

// Last processed position
let lastProcessedZ = 0;

// Last zone (only changes when significant position change occurs)
let currentZone = 'outside';

/**
 * Get zone from position with built-in noise filtering
 */
export function getZoneFromPosition(z: number): string {
  // Calculate position change
  const change = Math.abs(z - lastProcessedZ);
  
  // Only update if position changed significantly
  if (change > MIN_POSITION_CHANGE) {
    // Determine zone from position
    let newZone: string;
    
    if (z > ZONE_BOUNDARIES.OUTSIDE_MIN) {
      newZone = 'outside';
    } else if (z > ZONE_BOUNDARIES.JETWAY_MIN) {
      newZone = 'jetway';
    } else if (z > ZONE_BOUNDARIES.CABIN_MIN) {
      newZone = 'cabin';
    } else if (z > ZONE_BOUNDARIES.COCKPIT_MIN) {
      newZone = 'cockpit';
    } else {
      newZone = 'outside'; // Default fallback
    }
    
    // Update state
    console.log(`Zone change: ${currentZone} -> ${newZone} (position: ${z.toFixed(2)}, change: ${change.toFixed(2)})`);
    lastProcessedZ = z;
    currentZone = newZone;
  }
  
  // Return current zone
  return currentZone;
}

/**
 * Volume levels for each zone (0.0 - 1.0)
 */
export function getVolumeForZone(zone: string): number {
  switch (zone) {
    case 'outside': return 0.45;  // 45%
    case 'jetway': return 0.792;  // 79.2%
    case 'cabin': return 0.693;   // 69.3%
    case 'cockpit': return 0.65;  // 65%
    default: return 0.693;        // Default: 69.3%
  }
} 