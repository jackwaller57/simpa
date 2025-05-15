import { useState, useEffect, useRef } from "react"
import { ChevronUp, ChevronDown, ChevronLeft, Play, Square, Volume2, Volume1, VolumeX, Sun } from "lucide-react"
import Image from "next/image"

export default function AircraftControlInterface() {
  const [activeTab, setActiveTab] = useState<"manual" | "maintenance">("manual")
  const [volume, setVolume] = useState(5) // Volume level from 0 to 10
  const [isMuted, setIsMuted] = useState(false)
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false)
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Brightness control states
  const [brightness, setBrightness] = useState(7) // Brightness level from 1 to 10
  const [showBrightnessControl, setShowBrightnessControl] = useState(false)
  const brightnessTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [lastActiveButton, setLastActiveButton] = useState<"dim" | "bright" | null>(null) // Track which button was last pressed

  // United Airlines overlay state
  const [showUnitedOverlay, setShowUnitedOverlay] = useState(false)

  // Function to show volume indicator and set timeout to hide it
  const showVolumeIndicatorTemporarily = () => {
    // Clear any existing timeout
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current)
    }

    // Show the indicator
    setShowVolumeIndicator(true)

    // Set timeout to hide it after 5 seconds
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolumeIndicator(false)
    }, 5000)
  }

  // Function to show brightness control and set timeout to hide it
  const showBrightnessControlTemporarily = () => {
    // Clear any existing timeout
    if (brightnessTimeoutRef.current) {
      clearTimeout(brightnessTimeoutRef.current)
    }

    // Show the control
    setShowBrightnessControl(true)

    // Set timeout to hide it after 5 seconds
    brightnessTimeoutRef.current = setTimeout(() => {
      setShowBrightnessControl(false)
    }, 5000)
  }

  // Handle volume increase
  const increaseVolume = () => {
    if (volume < 10) {
      setVolume(volume + 1)
      setIsMuted(false)
      showVolumeIndicatorTemporarily()
    }
  }

  // Handle volume decrease
  const decreaseVolume = () => {
    if (volume > 0) {
      setVolume(volume - 1)
      if (volume === 1) {
        setIsMuted(true)
      }
      showVolumeIndicatorTemporarily()
    }
  }

  // Toggle mute and show United Airlines overlay
  const toggleMute = () => {
    setIsMuted(!isMuted)
    showVolumeIndicatorTemporarily()

    // Show United Airlines overlay when clicking Off
    if (!isMuted) {
      setShowUnitedOverlay(true)
    }
  }

  // Decrease brightness (dim)
  const decreaseBrightness = () => {
    if (brightness > 1) {
      setBrightness(brightness - 1)
      setLastActiveButton("dim")
      showBrightnessControlTemporarily()
    }
  }

  // Increase brightness (brighten)
  const increaseBrightness = () => {
    if (brightness < 10) {
      setBrightness(brightness + 1)
      setLastActiveButton("bright")
      showBrightnessControlTemporarily()
    }
  }

  // Toggle brightness control
  const toggleBrightnessControl = () => {
    setShowBrightnessControl(!showBrightnessControl)
    setLastActiveButton(null) // Reset the active button when toggling
    showBrightnessControlTemporarily()
  }

  // Handle click on United overlay to dismiss it
  const dismissUnitedOverlay = () => {
    setShowUnitedOverlay(false)
  }

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current)
      }
      if (brightnessTimeoutRef.current) {
        clearTimeout(brightnessTimeoutRef.current)
      }
    }
  }, [])

  // Get the appropriate volume icon based on current volume
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <VolumeX className="h-5 w-5 mr-1" />
    } else if (volume < 5) {
      return <Volume1 className="h-5 w-5 mr-1" />
    } else {
      return <Volume2 className="h-5 w-5 mr-1" />
    }
  }

  // Calculate brightness overlay opacity
  const brightnessOverlayOpacity = () => {
    // Map brightness from 1-10 to opacity from 0.8-0
    // Lower brightness = higher opacity of dark overlay
    // At max brightness (10), opacity is 0 (no overlay)
    return Math.max(0, 0.8 - (brightness - 1) * 0.09)
  }

  return (
    <div className="w-full h-screen max-w-4xl mx-auto overflow-hidden bg-gradient-to-b from-gray-600 to-gray-800 text-white relative">
      {/* Brightness overlay - darker at low brightness */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-50 transition-opacity duration-300"
        style={{ opacity: brightnessOverlayOpacity() }}
      ></div>

      {/* United Airlines overlay - appears when "Off" is clicked */}
      {showUnitedOverlay && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300 bg-[#0055aa]"
          onClick={dismissUnitedOverlay}
        >
          {/* Full-screen United Airlines background image - now scaled to show the entire image */}
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full">
              <Image
                src="/images/united-background.png"
                alt="United Airlines"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Tap anywhere to continue message */}
          <div className="absolute bottom-10 left-0 right-0 text-white text-lg text-center animate-pulse z-10 bg-[#0055aa]/70 py-2">
            Tap anywhere to continue
          </div>
        </div>
      )}

      {/* Top border */}
      <div className="h-6 bg-gradient-to-r from-gray-800 to-gray-700"></div>

      {/* Header with logo */}
      <div className="relative h-20 bg-gradient-to-b from-gray-700 to-gray-600 flex items-center">
        {/* 737 MAX Logo */}
        <div className="absolute top-0 right-0 w-1/4 h-full">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-gray-500/30 to-gray-300/50 clip-corner"></div>
          <div className="absolute bottom-1 right-4 text-right">
            <div
              className="text-4xl font-bold text-gray-400 drop-shadow-md"
              style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.3), -1px -1px 2px rgba(0,0,0,0.5)" }}
            >
              737
            </div>
            <div
              className="text-3xl font-bold italic text-gray-400 -mt-2 drop-shadow-md"
              style={{ textShadow: "1px 1px 2px rgba(255,255,255,0.3), -1px -1px 2px rgba(0,0,0,0.5)" }}
            >
              MAX
            </div>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex items-center ml-4 h-full pt-2">
          <div className="text-lg mr-2 text-gray-200">Mode:</div>
          <div className="flex h-full relative">
            <button
              className={`px-3 py-1 rounded-t-md text-center relative text-sm ${
                activeTab === "manual"
                  ? "bg-indigo-300/30 border-2 border-b-0 border-cyan-400 text-white z-10"
                  : "bg-indigo-900/40 text-gray-300"
              }`}
              onClick={() => setActiveTab("manual")}
              style={{ marginBottom: activeTab === "manual" ? "-1px" : "0" }}
            >
              <span className="font-semibold">M</span>ANUAL
            </button>
            <button
              className={`px-3 py-1 rounded-t-md text-center relative text-sm ${
                activeTab === "maintenance"
                  ? "bg-indigo-300/30 border-2 border-b-0 border-cyan-400 text-white z-10"
                  : "bg-indigo-900/40 text-gray-300"
              }`}
              onClick={() => setActiveTab("maintenance")}
              style={{ marginBottom: activeTab === "maintenance" ? "-1px" : "0" }}
            >
              MAINTENANCE
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        className="bg-indigo-300/30 min-h-[calc(100vh-180px)]"
        style={{ background: "linear-gradient(to bottom, rgba(149, 150, 184, 0.4), rgba(120, 121, 164, 0.4))" }}
      >
        {activeTab === "manual" && <ManualTab />}
        {activeTab === "maintenance" && <MaintenanceTab />}
      </div>

      {/* Footer controls */}
      <div className="h-16 bg-gray-700 flex items-center justify-between px-4">
        <div className="w-1/4 flex items-center justify-center">
          {getVolumeIcon()}
          <div className="text-xs">Cabin</div>
        </div>

        <div className="flex flex-col items-center">
          {/* Volume level indicator - now above the buttons as a progress bar */}
          <div
            className={`w-full h-2.5 mb-1.5 bg-gray-500 rounded-sm overflow-hidden transition-opacity duration-300 ${
              showVolumeIndicator ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className="h-full bg-cyan-400 transition-all duration-200"
              style={{ width: `${isMuted ? 0 : volume * 10}%` }}
            ></div>
          </div>

          <div className="flex items-center border-2 border-cyan-400 rounded-md overflow-hidden">
            <button className={`bg-gray-700 px-4 py-1 ${isMuted ? "text-cyan-400" : ""}`} onClick={toggleMute}>
              Off
            </button>
            <div className="flex bg-gray-600">
              <button className="px-2 py-1 border-r-2 border-cyan-400 active:bg-gray-500" onClick={decreaseVolume}>
                −
              </button>
              <button className="px-2 py-1 active:bg-gray-500" onClick={increaseVolume}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="w-1/4 flex items-center justify-end gap-2 relative">
          {/* Brightness level indicator - appears above the brightness control */}
          <div
            className={`absolute -top-28 right-4 transition-opacity duration-300 ${
              showBrightnessControl ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <div className="w-full h-2.5 bg-gray-500 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-200"
                  style={{ width: `${brightness * 10}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* New brightness control panel - styled like the reference image */}
          <div
            className={`absolute -top-24 right-4 transition-opacity duration-300 ${
              showBrightnessControl ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex flex-col w-14 rounded-md overflow-hidden border border-gray-600">
              <button
                className={`flex items-center justify-center py-2 ${
                  lastActiveButton === "dim" ? "bg-blue-500" : "bg-blue-900"
                }`}
                onClick={decreaseBrightness}
              >
                <Sun className="h-6 w-6 text-white" />
              </button>
              <button
                className={`flex items-center justify-center py-2 ${
                  lastActiveButton === "bright" ? "bg-blue-500" : "bg-blue-900"
                }`}
                onClick={increaseBrightness}
              >
                {/* Filled sun icon for brighten mode */}
                <div className="relative h-6 w-6 flex items-center justify-center">
                  <Sun className="h-6 w-6 text-white" />
                  <div className="absolute inset-[4px] rounded-full bg-white"></div>
                </div>
              </button>
            </div>
          </div>

          <button className="bg-cyan-400/40 border-2 border-cyan-400 rounded-md px-2 py-1 text-xs text-center">
            Load
            <br />
            Status
          </button>

          <button
            className="bg-cyan-400/40 border-2 border-cyan-400 rounded-md px-2 py-1 text-xs text-center"
            onClick={toggleBrightnessControl}
          >
            Display
            <br />
            Brightness
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualTab() {
  // Sample music programs
  const allMusicPrograms = [
    { id: 1, name: "Classical Collection", duration: "45:30" },
    { id: 2, name: "Jazz Essentials", duration: "38:15" },
    { id: 3, name: "Ambient Sounds", duration: "60:00" },
    { id: 4, name: "Pop Hits 2025", duration: "42:20" },
    { id: 5, name: "Relaxation Suite", duration: "55:10" },
    { id: 6, name: "World Music", duration: "37:45" },
    { id: 7, name: "Movie Soundtracks", duration: "51:30" },
    { id: 8, name: "Electronic Mix", duration: "40:00" },
    { id: 9, name: "Classical Piano", duration: "48:15" },
    { id: 10, name: "Rock Classics", duration: "52:40" },
    { id: 11, name: "Meditation Music", duration: "65:00" },
    { id: 12, name: "Country Hits", duration: "41:30" },
  ]

  // Calculate how many items can fit in the window based on item height
  const itemHeight = 41 // Height of each item in pixels (including margin)
  const containerHeight = 80 * 4 // Approximate height of the container in pixels (h-80 = 20rem = 320px)
  const maxItemsVisible = Math.floor(containerHeight / itemHeight)

  // State for visible items and current position
  const [startIndex, setStartIndex] = useState(0)
  const itemsPerPage = maxItemsVisible // Number of visible items

  // Calculate visible programs
  const visiblePrograms = allMusicPrograms.slice(startIndex, startIndex + itemsPerPage)

  // State management
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [nowPlayingId, setNowPlayingId] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Get the currently selected and playing programs
  const selectedProgram = allMusicPrograms.find((p) => p.id === selectedProgramId)
  const nowPlayingProgram = allMusicPrograms.find((p) => p.id === nowPlayingId)

  // Keep selection visible when navigating
  useEffect(() => {
    if (selectedProgramId !== null) {
      const selectedIndex = allMusicPrograms.findIndex((p) => p.id === selectedProgramId)

      // If selected item is above the visible range, adjust startIndex
      if (selectedIndex < startIndex) {
        setStartIndex(selectedIndex)
      }
      // If selected item is below the visible range, adjust startIndex
      else if (selectedIndex >= startIndex + itemsPerPage) {
        setStartIndex(selectedIndex - itemsPerPage + 1)
      }
    }
  }, [selectedProgramId, startIndex, itemsPerPage, allMusicPrograms])

  // Navigation functions - now moves the list AND changes selection
  const navigateUp = () => {
    if (selectedProgramId === null) {
      // If nothing is selected, select the first visible item
      if (visiblePrograms.length > 0) {
        setSelectedProgramId(visiblePrograms[0].id)
      }
    } else {
      const currentIndex = allMusicPrograms.findIndex((p) => p.id === selectedProgramId)
      if (currentIndex > 0) {
        // Select the previous item
        setSelectedProgramId(allMusicPrograms[currentIndex - 1].id)

        // Move the list if needed
        if (currentIndex - 1 < startIndex) {
          setStartIndex(Math.max(0, startIndex - 1))
        }
      }
    }
  }

  const navigateDown = () => {
    if (selectedProgramId === null) {
      // If nothing is selected, select the first visible item
      if (visiblePrograms.length > 0) {
        setSelectedProgramId(visiblePrograms[0].id)
      }
    } else {
      const currentIndex = allMusicPrograms.findIndex((p) => p.id === selectedProgramId)
      if (currentIndex < allMusicPrograms.length - 1) {
        // Select the next item
        setSelectedProgramId(allMusicPrograms[currentIndex + 1].id)

        // Move the list if needed
        if (currentIndex + 1 >= startIndex + itemsPerPage) {
          setStartIndex(Math.min(allMusicPrograms.length - itemsPerPage, startIndex + 1))
        }
      }
    }
  }

  // Playback functions
  const playSelected = () => {
    if (selectedProgramId !== null) {
      setNowPlayingId(selectedProgramId)
      setIsPlaying(true)
    }
  }

  // Modified to clear the Now Playing section when stopping
  const stopPlayback = () => {
    setIsPlaying(false)
    setNowPlayingId(null) // Clear the now playing program
  }

  return (
    <div className="p-4">
      {/* Back button and title */}
      <div className="flex items-center mb-4">
        <button className="bg-cyan-400/40 border-2 border-cyan-400 rounded-md px-4 py-1 flex items-center mr-4">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Back</span>
        </button>
        <h2 className="text-2xl">Boarding Music</h2>
      </div>

      <div className="flex gap-4">
        {/* Left panel - Restructured to have arrows on the right */}
        <div className="flex-1">
          <div className="text-sm mb-2">Select Program</div>

          {/* Container for the program box and arrows */}
          <div className="flex gap-4">
            {/* Program selection box with content */}
            <div className="flex-1 bg-gray-600 border border-gray-800 h-80 rounded-sm overflow-hidden">
              <div className="h-full p-1 flex flex-col">
                {/* Only show the visible programs */}
                {visiblePrograms.map((program) => (
                  <div
                    key={program.id}
                    className={`p-2 mb-1 cursor-pointer ${
                      selectedProgramId === program.id
                        ? "bg-cyan-400/30 border border-cyan-400"
                        : "hover:bg-gray-500/50"
                    }`}
                    onClick={() => setSelectedProgramId(program.id)}
                  >
                    <div className="flex justify-between">
                      <div>{program.name}</div>
                      <div className="text-gray-300 text-sm">{program.duration}</div>
                    </div>
                  </div>
                ))}

                {/* Fill empty space if there are fewer items than itemsPerPage */}
                {visiblePrograms.length < itemsPerPage && <div className="flex-grow bg-gray-600"></div>}
              </div>
            </div>

            {/* Up/Down arrows positioned to the right and vertically centered */}
            <div className="flex flex-col justify-center gap-4">
              <button
                className="bg-cyan-400/40 border-2 border-cyan-400 rounded-md w-12 h-10 flex items-center justify-center"
                onClick={navigateUp}
              >
                <ChevronUp className="h-6 w-6" />
              </button>
              <button
                className="bg-cyan-400/40 border-2 border-cyan-400 rounded-md w-12 h-10 flex items-center justify-center"
                onClick={navigateDown}
              >
                <ChevronDown className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-full bg-gray-400"></div>

        {/* Right panel */}
        <div className="w-1/3">
          <div className="text-sm mb-2">Now Playing</div>
          <div className="bg-gray-600 border border-gray-800 h-24 rounded-sm relative p-2">
            {nowPlayingProgram ? (
              <div>
                <div className="font-medium">{nowPlayingProgram.name}</div>
                <div className="text-sm text-gray-300 mt-1">Duration: {nowPlayingProgram.duration}</div>
                <div className="text-sm text-cyan-300 mt-2">Status: {isPlaying ? "Playing" : "Paused"}</div>
              </div>
            ) : (
              <div className="text-gray-400 h-full flex items-center justify-center">No program selected</div>
            )}

            {/* Position the controls at the bottom of the Now Playing box - moved 20px to the right */}
            <div
              className="absolute bottom-[-20px] left-1/2 flex justify-center gap-2"
              style={{ transform: "translateX(calc(-50% + 20px))" }}
            >
              <button
                className={`bg-cyan-400/40 border-2 ${
                  !nowPlayingId ? "border-gray-400 text-gray-400" : "border-cyan-400"
                } rounded-md w-12 h-10 flex items-center justify-center`}
                onClick={stopPlayback}
                disabled={!nowPlayingId}
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                className={`bg-cyan-400/40 border-2 ${
                  selectedProgramId === null ? "border-gray-400 text-gray-400" : "border-cyan-400"
                } rounded-md w-12 h-10 flex items-center justify-center`}
                onClick={playSelected}
                disabled={selectedProgramId === null}
              >
                <Play className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MaintenanceTab() {
  return (
    <div className="p-8">
      <div className="bg-gray-600 border border-gray-800 h-80 rounded-sm"></div>
    </div>
  )
}
