use serde_json::json;
use std::sync::{ Arc, Mutex };
use std::thread;
use std::time::Duration;
use simconnect::{ DispatchResult, SimConnector };
use tauri::{ Window, State, Emitter };
use rand;

/// Holds a mutex-guarded `running: bool` to signal if SimConnect is active.
pub struct SimConnectState {
    pub running: Mutex<bool>,
}

impl SimConnectState {
    pub fn new() -> Self {
        SimConnectState {
            running: Mutex::new(false),
        }
    }
}

// Add a struct to hold our flight data state
#[derive(Clone)]
struct FlightDataState {
    jetway_state: bool,
    last_toggle_time: std::time::Instant,
    last_request_was_attach: bool,  // Track if last request was to attach
    // Add cached flight data
    last_alt: f64,
    // Add jetway state tracking
    jetway_attached: bool,
    jetway_moving: bool,
    // Add audio state tracking
    boarding_music_playing: bool,
    welcome_aboard_playing: bool,
    last_welcome_aboard_time: std::time::Instant,
    next_welcome_aboard_delay: Duration,
    ten_k_announced: bool,  // Add this field
    arrive_soon_announced: bool,  // Add this field
    landing_soon_announced: bool,  // Add this field
    camera_position: String,  // Add this field
    x_position: f64,
    y_position: f64,
    camera_view_type: String,
    volume_level: f64,
    z_position: f64,
    last_x_position: f64,
    last_y_position: f64,
    last_z_position: f64,
    last_substate_update: std::time::Instant,
    last_jetway_update: std::time::Instant,  // Add this field
    gsx_bypass_pin: bool,  // Add GSX bypass pin state
}

impl FlightDataState {
    fn new() -> Self {
        FlightDataState {
            jetway_state: false,
            last_toggle_time: std::time::Instant::now(),
            last_request_was_attach: false,
            last_alt: 0.0,
            jetway_attached: false,
            jetway_moving: false,
            boarding_music_playing: false,
            welcome_aboard_playing: false,
            last_welcome_aboard_time: std::time::Instant::now(),
            next_welcome_aboard_delay: Duration::from_secs(30),
            ten_k_announced: false,  // Initialize the new field
            arrive_soon_announced: false,  // Initialize the new field
            landing_soon_announced: false,  // Initialize the new field
            camera_position: String::from("exterior"),
            x_position: 0.0,
            y_position: 0.0,
            camera_view_type: String::from("exterior"),
            volume_level: 0.0,
            z_position: 0.0,
            last_x_position: 0.0,
            last_y_position: 0.0,
            last_z_position: 0.0,
            last_substate_update: std::time::Instant::now(),
            last_jetway_update: std::time::Instant::now(),  // Initialize the new field
            gsx_bypass_pin: false,  // Initialize GSX bypass pin state
        }
    }

    fn toggle_jetway(&mut self, _window: &Window) {
        let now = std::time::Instant::now();
        if now.duration_since(self.last_toggle_time).as_secs() >= 5 {
            self.last_toggle_time = now;
            self.jetway_moving = true;
            
            if self.jetway_attached {
                // Detaching
                self.last_request_was_attach = false;
                self.jetway_attached = false;
                self.boarding_music_playing = false;
            } else {
                // Attaching
                self.last_request_was_attach = true;
                self.jetway_attached = true;
                self.boarding_music_playing = true;
            }
            
            println!("Jetway state changed: {} (Request was to {})", 
                    if self.jetway_attached { "ATTACHED" } else { "DETACHED" },
                    if self.last_request_was_attach { "ATTACH" } else { "DETACH" });
        }
    }

    fn handle_welcome_aboard_complete(&mut self, window: &Window) {
        self.welcome_aboard_playing = false;
        self.last_welcome_aboard_time = std::time::Instant::now();
        
        // Generate random delay between 30 seconds and 2 minutes
        let random_seconds = rand::random::<u64>() % 90 + 30; // 30-120 seconds
        let delay = Duration::from_secs(random_seconds);
        
        // Schedule next welcome aboard
        let window_clone = window.clone();
        thread::spawn(move || {
            thread::sleep(delay);
            let _ = window_clone.emit("audio-event", json!({
                "type": "welcome_aboard"
            }));
        });
    }

    fn update_flight_data(&mut self, alt: f64) {
        // Log altitude changes for debugging
        println!("Altitude update: {:.2} feet (Previous: {:.2} feet)", alt, self.last_alt);
        
        // Check if we're ascending through 10k feet
        if self.last_alt < 10000.0 && alt >= 10000.0 && !self.ten_k_announced {
            println!("Passing through 10k feet during ascent - triggering announcement");
            self.ten_k_announced = true;
        }
        
        // Reset the announcement flags when descending below their thresholds
        if alt < 10000.0 {
            println!("Descending below 10k feet, resetting announcement flags");
            self.ten_k_announced = false;
            self.landing_soon_announced = false;
        }
        
        // Check for arrival announcement at 18,000 feet
        if alt < 18000.0 && !self.arrive_soon_announced {
            println!("Descending below 18,000 feet - triggering arrival soon announcement");
            self.arrive_soon_announced = true;
        }
        
        // Check for landing announcement at 10,000 feet
        if alt < 10000.0 && !self.landing_soon_announced {
            println!("Descending below 10,000 feet - triggering landing soon announcement");
            self.landing_soon_announced = true;
        }
        
        self.last_alt = alt;
    }

    fn get_payload(&self) -> serde_json::Value {
        json!({
            "alt": format_number(self.last_alt, 0),
            "jetwayMoving": self.jetway_moving,
            "jetwayState": self.jetway_attached,
            "lastRequestWasAttach": self.last_request_was_attach,
            "boardingMusicPlaying": self.boarding_music_playing,
            "welcomeAboardPlaying": self.welcome_aboard_playing,
            "tenKAnnounced": self.ten_k_announced,
            "arriveSoonAnnounced": self.arrive_soon_announced,
            "landingSoonAnnounced": self.landing_soon_announced,
            "cameraPosition": self.camera_position,
            "xPosition": self.x_position,
            "yPosition": self.y_position,
            "zPosition": self.z_position,
            "cameraViewType": self.camera_view_type,
            "volumeLevel": self.volume_level,
            "gsxBypassPin": self.gsx_bypass_pin
        })
    }
}

/// Helper to round floating values to `decimals` places.
fn format_number(value: f64, decimals: usize) -> f64 {
    let multiplier = (10f64).powi(decimals as i32);
    (value * multiplier).round() / multiplier
}

/// Attempts to establish a SimConnect connection with retries
fn try_connect_with_retry(max_attempts: u32, delay_ms: u64) -> Option<SimConnector> {
    for attempt in 1..=max_attempts {
        println!("Attempting to connect to SimConnect (attempt {}/{})", attempt, max_attempts);
        
        let mut conn = SimConnector::new();
        if conn.connect("SIMPA") {
            println!("Successfully connected to SimConnect on attempt {}", attempt);
            return Some(conn);
        }
        
        println!("Connection attempt {} failed, waiting {}ms before retry", attempt, delay_ms);
        if attempt < max_attempts {
            thread::sleep(Duration::from_millis(delay_ms));
        }
    }
    
    println!("Failed to connect to SimConnect after {} attempts", max_attempts);
    None
}

/// Starts the SimConnect data collection in a background thread.
#[tauri::command]
pub fn start_simconnect_data_collection(
    window: Window,
    state: State<Arc<SimConnectState>>
) {
    // Check if already running
    {
        let mut running_flag = state.running.lock().unwrap();
        if *running_flag {
            let _ = window.emit("simconnect-error", json!({
                "message": "SimConnect is already running"
            }));
            return;
        }
        *running_flag = true;
    }

    // Clone the Arc<SimConnectState> so the thread can own it
    let arc_state = state.inner().clone();

    thread::spawn(move || {
        // Try to connect with 5 attempts, 2 seconds between attempts
        let conn = match try_connect_with_retry(5, 2000) {
            Some(conn) => conn,
            None => {
                println!("Failed to connect to SimConnect after multiple attempts.");
                *arc_state.running.lock().unwrap() = false;
                let _ = window.emit("simconnect-error", json!({
                    "message": "Failed to connect to MSFS. Please ensure the simulator is running and try again."
                }));
                return;
            }
        };

        println!("Connected to SimConnect.");
        let _ = window.emit("simconnect-open", json!({}));

        // Create flight data state tracker
        let mut flight_state = FlightDataState::new();

        // Add data definitions with error handling
        let setup_result = || -> Result<(), String> {
            // Define a structure for flight data
            conn.add_data_definition(
                0,
                "PLANE ALTITUDE",
                "Feet",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0,
                0.0
            );

            // Request flight data with a more reasonable frequency
            conn.request_data_on_sim_object(
                0,
                0,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,
                0,
                0,
                0,
                0
            );

            // Add beacon light state definition
            conn.add_data_definition(
                1,
                "LIGHT BEACON",
                "Bool",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            conn.request_data_on_sim_object(
                1,
                1,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,
                0,
                0,
                0,
                0
            );

            // Add seatbelt sign state definition
            conn.add_data_definition(
                2,
                "CABIN SEATBELTS ALERT SWITCH",
                "Bool",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            conn.request_data_on_sim_object(
                2,
                2,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,
                0,
                0,
                0,
                0
            );

            // Add jetway state definition
            conn.add_data_definition(
                3,
                "EXIT OPEN:0",
                "Percent",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0,
                0.0
            );

            conn.request_data_on_sim_object(
                3,
                3,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SIM_FRAME,
                0,
                0,
                0,
                0
            );

            // Add landing lights state definition
            conn.add_data_definition(
                4,  // New ID for landing lights
                "LIGHT LANDING",
                "Bool",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            conn.request_data_on_sim_object(
                4,  // Same ID as above
                4,  // Same ID as above
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,
                0,
                0,
                0,
                0
            );

            // Add camera view definition
            conn.add_data_definition(
                5,
                "CAMERA STATE",
                "Number",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            // Add camera X position definition
            conn.add_data_definition(
                7,
                "L:P42_cp_x",  // Changed to L: prefix for L-var
                "Number",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0,
                0.0
            );

            // Add camera Y position definition
            conn.add_data_definition(
                8,
                "L:P42_cp_y",  // Changed to L: prefix for L-var
                "Number",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0,
                0.0
            );

            // Add camera Z position definition
            conn.add_data_definition(
                9,
                "L:P42_cp_z",  // Changed to L: prefix for L-var
                "Number",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_FLOAT64,
                0,
                0.0
            );

            // Request data with a slower frequency
            conn.request_data_on_sim_object(
                7,
                7,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,  // Changed to SECOND for slower updates
                0,
                0,
                0,
                0
            );

            conn.request_data_on_sim_object(
                8,
                8,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,  // Changed to SECOND for slower updates
                0,
                0,
                0,
                0
            );

            conn.request_data_on_sim_object(
                9,
                9,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,  // Changed to SECOND for slower updates
                0,
                0,
                0,
                0
            );

            // Add camera substate definition
            conn.add_data_definition(
                6,
                "CAMERA SUBSTATE",
                "Number",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            // Request camera substate data with a slower frequency
            conn.request_data_on_sim_object(
                6,
                6,
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SECOND,  // Changed to once per second
                0,
                0,
                0,
                0
            );

            // Add GSX bypass pin definition
            conn.add_data_definition(
                11,  // New ID for GSX bypass pin
                "FSDT_GSX_BYPASS_PIN",
                "Bool",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            // Add alternative GSX bypass pin definition
            conn.add_data_definition(
                12,  // New ID for alternative GSX bypass pin
                "L:FSDT_GSX_BYPASS_PIN",  // Try with L: prefix
                "Bool",
                simconnect::SIMCONNECT_DATATYPE_SIMCONNECT_DATATYPE_INT32,
                0,
                0.0
            );

            conn.request_data_on_sim_object(
                11,  // Same ID as above
                11,  // Same ID as above
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SIM_FRAME,
                0,
                0,
                0,
                0
            );

            conn.request_data_on_sim_object(
                12,  // Same ID as above
                12,  // Same ID as above
                0,
                simconnect::SIMCONNECT_PERIOD_SIMCONNECT_PERIOD_SIM_FRAME,
                0,
                0,
                0,
                0
            );

            println!("GSX bypass pin data definitions and requests set up");

            // Map the TOGGLE_JETWAY event
            conn.map_client_event_to_sim_event(3, "TOGGLE_JETWAY");
            conn.add_client_event_to_notification_group(0, 3, false);
            conn.set_notification_group_priority(0, simconnect::SIMCONNECT_GROUP_PRIORITY_HIGHEST);
            conn.set_system_event_state(3, simconnect::SIMCONNECT_STATE_SIMCONNECT_STATE_ON);

            // Subscribe to frame events
            conn.subscribe_to_system_event(7, "Frame");

            println!("SimConnect data definitions and requests set up successfully");
            println!("Waiting for altitude data...");

            Ok(())
        };

        if let Err(e) = setup_result() {
            println!("Failed to set up SimConnect data definitions: {}", e);
            *arc_state.running.lock().unwrap() = false;
            let _ = window.emit("simconnect-error", json!({
                "message": format!("Failed to initialize SimConnect data: {}", e)
            }));
            return;
        }

        let mut consecutive_errors = 0;
        let _max_consecutive_errors = 10;
        let _simulator_ready = false;
        let _last_valid_data_time = std::time::Instant::now();
        let mut last_error_time = std::time::Instant::now();

        // Read data in a loop while running is true
        let mut prev_beacon_state = -1;
        let mut prev_seatbelt_state = -1;
        let mut prev_landing_lights_state = -1;  // Add this line
        
        while *arc_state.running.lock().unwrap() {
            match conn.get_next_message() {
                Ok(DispatchResult::SimObjectData(data)) => {
                    consecutive_errors = 0; // Reset error counter on successful data
                    unsafe {
                        let define_id = std::ptr::read_unaligned(std::ptr::addr_of!(data.dwDefineID));
                        println!("[DEBUG] Received SimObjectData with DefineID: {}", define_id);
                        
                        // Log raw data for debugging
                        let data_ptr = std::ptr::addr_of!(data.dwData);
                        let data_size = std::mem::size_of::<i32>();
                        println!("[DEBUG] Data size: {} bytes", data_size);
                        
                        match define_id {
                            0 => { // Flight data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const f64;
                                let alt = *data_ptr;

                                // Update flight state with altitude
                                flight_state.update_flight_data(alt);
                                
                                // Check for 10k feet announcement
                                if flight_state.last_alt < 10000.0 && alt >= 10000.0 && !flight_state.ten_k_announced {
                                    println!("Passing through 10k feet - triggering announcement");
                                    flight_state.ten_k_announced = true;
                                    let _ = window.emit("audio-event", json!({
                                        "type": "10k-feet"
                                    }));
                                }
                                
                                // Always emit the data
                                let _ = window.emit("simconnect-data", flight_state.get_payload());
                                
                                // Debug logging
                                println!("Altitude data received: {:.2} feet", alt);
                            },
                            1 => { // Beacon light data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let beacon_state = *data_ptr;
                                
                                if beacon_state != prev_beacon_state {
                                    prev_beacon_state = beacon_state;
                                    let _ = window.emit("beacon-light-changed", json!({
                                        "state": beacon_state == 1
                                    }));
                                }
                            },
                            2 => { // Seatbelt sign data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let seatbelt_state = *data_ptr;
                                
                                if seatbelt_state != prev_seatbelt_state {
                                    prev_seatbelt_state = seatbelt_state;
                                    let _ = window.emit("seatbelt-switch-changed", json!({
                                        "state": seatbelt_state == 1
                                    }));
                                }
                            },
                            3 => { // Jetway state data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const f64;
                                let exit_open = *data_ptr;
                                
                                // Only process jetway updates if enough time has passed
                                let now = std::time::Instant::now();
                                if now.duration_since(flight_state.last_jetway_update).as_secs() >= 1 {
                                    flight_state.last_jetway_update = now;
                                    
                                    let was_attached = flight_state.jetway_attached;
                                    let is_attached = exit_open > 0.0;
                                    
                                    // Process state changes and initial state
                                    if is_attached != was_attached {
                                        // Update jetway state based on exit door position
                                        flight_state.jetway_attached = is_attached;
                                        flight_state.jetway_moving = false;
                                        flight_state.last_request_was_attach = is_attached;
                                        
                                        // Handle state changes
                                        if is_attached {
                                            // Jetway just attached
                                            println!("Jetway is now fully attached");
                                            flight_state.boarding_music_playing = true;
                                            
                                            // Start boarding music immediately at full volume
                                            let _ = window.emit("audio-event", json!({
                                                "type": "boarding_music",
                                                "volume": 100
                                            }));
                                            
                                            // Schedule first welcome aboard after 30 seconds
                                            let window_clone = window.clone();
                                            thread::spawn(move || {
                                                thread::sleep(Duration::from_secs(30));
                                                println!("Lowering boarding music volume and playing welcome aboard");
                                                
                                                // Smooth fade out over 2 seconds before welcome aboard starts
                                                for i in (0..=100).rev().step_by(5) {
                                                    let _ = window_clone.emit("audio-event", json!({
                                                        "type": "boarding_music",
                                                        "volume": i
                                                    }));
                                                    thread::sleep(Duration::from_millis(40));
                                                }
                                                
                                                // Wait for fade to complete before playing welcome aboard
                                                thread::sleep(Duration::from_millis(100));
                                                
                                                let _ = window_clone.emit("audio-event", json!({
                                                    "type": "welcome_aboard"
                                                }));
                                                
                                                // Wait for welcome aboard to finish before scheduling next one
                                                let window_clone2 = window_clone.clone();
                                                thread::spawn(move || {
                                                    // Wait for welcome aboard to finish (assuming it's about 5 seconds)
                                                    thread::sleep(Duration::from_secs(5));
                                                    
                                                    // Smooth fade in over 2 seconds after welcome aboard finishes
                                                    for i in (0..=100).step_by(5) {
                                                        let _ = window_clone2.emit("audio-event", json!({
                                                            "type": "boarding_music",
                                                            "volume": i
                                                        }));
                                                        thread::sleep(Duration::from_millis(40));
                                                    }
                                                    
                                                    // Start the random interval loop for subsequent announcements
                                                    while flight_state.jetway_attached {
                                                        // Generate random delay between 30 seconds and 2 minutes
                                                        let random_seconds = rand::random::<u64>() % 90 + 30; // 30-120 seconds
                                                        thread::sleep(Duration::from_secs(random_seconds));
                                                        
                                                        // Check if jetbridge is still attached before proceeding
                                                        if !flight_state.jetway_attached {
                                                            break;
                                                        }
                                                        
                                                        // Smooth fade out over 2 seconds before welcome aboard starts
                                                        for i in (0..=100).rev().step_by(5) {
                                                            let _ = window_clone2.emit("audio-event", json!({
                                                                "type": "boarding_music",
                                                                "volume": i
                                                            }));
                                                            thread::sleep(Duration::from_millis(40));
                                                        }
                                                        
                                                        // Wait for fade to complete before playing welcome aboard
                                                        thread::sleep(Duration::from_millis(100));
                                                        
                                                        let _ = window_clone2.emit("audio-event", json!({
                                                            "type": "welcome_aboard"
                                                        }));
                                                        
                                                        // Wait for welcome aboard to finish before next loop
                                                        thread::sleep(Duration::from_secs(5));
                                                        
                                                        // Smooth fade in over 2 seconds after welcome aboard finishes
                                                        for i in (0..=100).step_by(5) {
                                                            let _ = window_clone2.emit("audio-event", json!({
                                                                "type": "boarding_music",
                                                                "volume": i
                                                            }));
                                                            thread::sleep(Duration::from_millis(40));
                                                        }
                                                    }
                                                });
                                            });
                                        } else {
                                            // Jetway just detached
                                            println!("Jetway is now fully detached");
                                            flight_state.boarding_music_playing = false;
                                            
                                            // Stop all audio immediately
                                            let _ = window.emit("audio-event", json!({
                                                "type": "boarding_music",
                                                "volume": 0
                                            }));
                                            
                                            // Schedule doors to auto announcement after 15 seconds
                                            let window_clone = window.clone();
                                            thread::spawn(move || {
                                                thread::sleep(Duration::from_secs(15));
                                                println!("Playing doors to auto announcement");
                                                let _ = window_clone.emit("audio-event", json!({
                                                    "type": "doors_auto"
                                                }));
                                            });
                                        }
                                    }
                                    
                                    let _ = window.emit("simconnect-data", flight_state.get_payload());
                                }
                            },
                            4 => { // Landing lights data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let landing_lights_state = *data_ptr;
                                
                                if landing_lights_state != prev_landing_lights_state {
                                    println!("Landing lights state changed: {} -> {}", 
                                        if prev_landing_lights_state == 1 { "ON" } else { "OFF" },
                                        if landing_lights_state == 1 { "ON" } else { "OFF" }
                                    );
                                    prev_landing_lights_state = landing_lights_state;
                                    let _ = window.emit("landing-lights-changed", json!({
                                        "state": landing_lights_state == 1
                                    }));
                                }
                            },
                            5 => { // Camera state data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let camera_state = *data_ptr;
                                
                                // For debugging - show camera state
                                println!("Camera state: {} (Raw value)", camera_state);
                                
                                // Map camera states to view types based on MSFS SDK
                                let (position, view_type, volume_level) = match camera_state {
                                    0 => ("cockpit", "internal", 1.0),      // Cockpit view
                                    1 => ("exterior", "external", 0.0),     // External view
                                    2 => ("exterior", "external", 0.0),     // Fly-by view
                                    3 => ("exterior", "external", 0.0),     // Spot view
                                    4 => ("exterior", "external", 0.0),     // Tower view
                                    5 => ("exterior", "external", 0.0),     // Runway view
                                    6 => ("exterior", "external", 0.0),     // Approach view
                                    7 => ("exterior", "external", 0.0),     // Map view
                                    _ => {
                                        println!("Unknown camera state: {}", camera_state);
                                        ("exterior", "unknown", 0.0)
                                    }
                                };
                                
                                // Only update if the view type has changed
                                if flight_state.camera_view_type != view_type {
                                    flight_state.camera_view_type = view_type.to_string();
                                    flight_state.volume_level = volume_level;
                                    println!("Camera view type changed to: {} (State: {})", view_type, camera_state);
                                    
                                    // Emit view type update
                                    let _ = window.emit("camera-position-changed", json!({
                                        "position": position,
                                        "viewType": view_type,
                                        "volumeLevel": volume_level,
                                        "xPosition": flight_state.x_position,
                                        "yPosition": flight_state.y_position,
                                        "zPosition": flight_state.z_position
                                    }));
                                }
                            },
                            6 => { // Camera substate data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let camera_substate = *data_ptr;
                                
                                // Only log if enough time has passed since the last update
                                let now = std::time::Instant::now();
                                if now.duration_since(flight_state.last_substate_update).as_secs() >= 1 {
                                    flight_state.last_substate_update = now;
                                    println!("Camera substate: {} (Raw value)", camera_substate);
                                }
                            },
                            7 => { // Camera X position
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const f64;
                                let camera_x = *data_ptr;
                                
                                // For debugging - show X position with more detail
                                println!("ChasePlane X position update - Raw value: {:.2}", camera_x);
                                
                                // Update flight state with X position
                                flight_state.x_position = camera_x;
                                
                                // Only emit position update if position has changed significantly
                                if (camera_x - flight_state.last_x_position).abs() > 0.1 {
                                    flight_state.last_x_position = camera_x;
                                    
                                    // Emit combined position update with more detailed logging
                                    println!("Emitting camera position event - X: {:.2}, Y: {:.2}, Z: {:.2}", 
                                        camera_x, flight_state.y_position, flight_state.z_position);
                                        
                                    let _ = window.emit("camera-position-changed", json!({
                                        "position": flight_state.camera_position,
                                        "viewType": flight_state.camera_view_type,
                                        "volumeLevel": flight_state.volume_level,
                                        "xPosition": camera_x,
                                        "yPosition": flight_state.y_position,
                                        "zPosition": flight_state.z_position
                                    }));
                                }
                            },
                            8 => { // Camera Y position
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const f64;
                                let camera_y = *data_ptr;
                                
                                // For debugging - show Y position with more detail
                                println!("ChasePlane Y position update - Raw value: {:.2}", camera_y);
                                
                                // Update flight state with Y position
                                flight_state.y_position = camera_y;
                                
                                // Only emit position update if position has changed significantly
                                if (camera_y - flight_state.last_y_position).abs() > 0.1 {
                                    flight_state.last_y_position = camera_y;
                                    
                                    // Emit combined position update with more detailed logging
                                    println!("Emitting camera position event - X: {:.2}, Y: {:.2}, Z: {:.2}", 
                                        flight_state.x_position, camera_y, flight_state.z_position);
                                        
                                    let _ = window.emit("camera-position-changed", json!({
                                        "position": flight_state.camera_position,
                                        "viewType": flight_state.camera_view_type,
                                        "volumeLevel": flight_state.volume_level,
                                        "xPosition": flight_state.x_position,
                                        "yPosition": camera_y,
                                        "zPosition": flight_state.z_position
                                    }));
                                }
                            },
                            9 => { // Camera Z position
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const f64;
                                let camera_z = *data_ptr;
                                
                                // For debugging - show Z position with more detail
                                println!("ChasePlane Z position update - Raw value: {:.2}", camera_z);
                                
                                // Update flight state with Z position
                                flight_state.z_position = camera_z;
                                
                                // Only emit position update if position has changed significantly
                                if (camera_z - flight_state.last_z_position).abs() > 0.1 {
                                    flight_state.last_z_position = camera_z;
                                    
                                    // Emit combined position update with more detailed logging
                                    println!("Emitting camera position event - X: {:.2}, Y: {:.2}, Z: {:.2}", 
                                        flight_state.x_position, flight_state.y_position, camera_z);
                                        
                                    let _ = window.emit("camera-position-changed", json!({
                                        "position": flight_state.camera_position,
                                        "viewType": flight_state.camera_view_type,
                                        "volumeLevel": flight_state.volume_level,
                                        "xPosition": flight_state.x_position,
                                        "yPosition": flight_state.y_position,
                                        "zPosition": camera_z
                                    }));
                                }
                            },
                            10 => { // Frame event - do nothing special here
                            },
                            11 => { // GSX bypass pin data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let gsx_bypass_pin_state = *data_ptr;
                                
                                // Log raw state value
                                println!("GSX bypass pin raw state: {}", gsx_bypass_pin_state);
                                
                                // Update GSX bypass pin state
                                let new_state = gsx_bypass_pin_state == 1;
                                if flight_state.gsx_bypass_pin != new_state {
                                    println!("GSX bypass pin state changed: {} -> {}", 
                                        if flight_state.gsx_bypass_pin { "INSERTED" } else { "REMOVED" },
                                        if new_state { "INSERTED" } else { "REMOVED" }
                                    );
                                    flight_state.gsx_bypass_pin = new_state;
                                    
                                    // If pin was just inserted, play safety video
                                    if new_state {
                                        println!("GSX bypass pin inserted - playing safety video");
                                        let _ = window.emit("audio-event", json!({
                                            "type": "safety_video",
                                            "volume": flight_state.volume_level
                                        }));
                                    }
                                    
                                    // Emit the updated state
                                    let _ = window.emit("simconnect-data", flight_state.get_payload());
                                }
                            },
                            12 => { // Alternative GSX bypass pin data
                                let data_ptr = std::ptr::addr_of!(data.dwData) as *const i32;
                                let gsx_bypass_pin_state = *data_ptr;
                                
                                // Log raw state value
                                println!("Alternative GSX bypass pin raw state: {}", gsx_bypass_pin_state);
                                
                                // Update GSX bypass pin state
                                let new_state = gsx_bypass_pin_state == 1;
                                if flight_state.gsx_bypass_pin != new_state {
                                    println!("Alternative GSX bypass pin state changed: {} -> {}", 
                                        if flight_state.gsx_bypass_pin { "INSERTED" } else { "REMOVED" },
                                        if new_state { "INSERTED" } else { "REMOVED" }
                                    );
                                    flight_state.gsx_bypass_pin = new_state;
                                    
                                    // Emit the updated state
                                    let _ = window.emit("simconnect-data", flight_state.get_payload());
                                }
                            },
                            _ => {
                                // Only log unknown DefineIDs if we're in debug mode
                                #[cfg(debug_assertions)]
                                {
                                    let define_id = std::ptr::read_unaligned(std::ptr::addr_of!(data.dwDefineID));
                                println!("Received data with unknown DefineID: {}", define_id);
                                }
                            }
                        }
                    }
                },
                Ok(DispatchResult::Event(event)) => {
                    if event.uEventID == 3 { // TOGGLE_JETWAY event
                        println!("TOGGLE_JETWAY event received");
                        let now = std::time::Instant::now();
                        if now.duration_since(flight_state.last_toggle_time).as_secs() >= 5 {
                            flight_state.last_toggle_time = now;
                            flight_state.jetway_moving = true;
                            
                            if flight_state.jetway_attached {
                                // Detaching
                                flight_state.last_request_was_attach = false;
                                flight_state.jetway_attached = false;
                                flight_state.boarding_music_playing = false;
                        } else {
                                // Attaching
                                flight_state.last_request_was_attach = true;
                                flight_state.jetway_attached = true;
                                flight_state.boarding_music_playing = true;
                            }
                            
                            println!("Jetway state changed: {} (Request was to {})", 
                                    if flight_state.jetway_attached { "ATTACHED" } else { "DETACHED" },
                                    if flight_state.last_request_was_attach { "ATTACH" } else { "DETACH" });
                            
                            let _ = window.emit("simconnect-data", flight_state.get_payload());
                        }
                    }
                },
                Ok(DispatchResult::Open(_)) => {
                    println!("SimConnect connection opened. Waiting for simulator to be ready...");
                    let _ = window.emit("simconnect-open", json!({}));
                    consecutive_errors = 0;
                },
                Ok(DispatchResult::Quit(_)) => {
                    println!("SimConnect connection closed.");
                    let _ = window.emit("simconnect-quit", json!({}));
                    break;
                },
                Ok(DispatchResult::Exception(exception)) => {
                    // Only log exceptions if enough time has passed since the last error
                    if last_error_time.elapsed().as_secs() >= 1 {
                        consecutive_errors += 1;
                        println!("SimConnect exception ({}): {:?}", consecutive_errors, exception);
                        last_error_time = std::time::Instant::now();
                    }
                    // Add a small sleep to prevent CPU spinning
                    std::thread::sleep(std::time::Duration::from_millis(2));
                },
                Ok(_) => {
                    // Add a small sleep for other message types to prevent CPU spinning
                    std::thread::sleep(std::time::Duration::from_millis(2));
                },
                Err(e) => {
                    // Check if this is just a "no data" message
                    if e.to_string().contains("Failed getting data") {
                        // This is normal - just sleep briefly and continue
                        std::thread::sleep(std::time::Duration::from_millis(2));
                        continue;
                    }
                    
                    // Only log actual errors if enough time has passed since the last error
                    if last_error_time.elapsed().as_secs() >= 1 {
                        consecutive_errors += 1;
                        println!("SimConnect error ({}): {}", consecutive_errors, e);
                        last_error_time = std::time::Instant::now();
                    }
                    
                    // Add a small sleep to prevent CPU spinning
                    std::thread::sleep(std::time::Duration::from_millis(2));
                }
            }

            // Add a small sleep at the end of each loop iteration
            std::thread::sleep(std::time::Duration::from_millis(2));
        }

        println!("SimConnect data collection stopped.");
        *arc_state.running.lock().unwrap() = false;
        let _ = window.emit("simconnect-quit", json!({}));
    });
}

/// Stops the SimConnect data collection.
#[tauri::command]
pub fn stop_simconnect_data_collection(
    window: Window,
    state: State<Arc<SimConnectState>>
) {
    let mut running_flag = state.running.lock().unwrap();
    *running_flag = false;
    let _ = window.emit("simconnect-quit", json!({}));
    println!("SimConnect stopped.");
}



