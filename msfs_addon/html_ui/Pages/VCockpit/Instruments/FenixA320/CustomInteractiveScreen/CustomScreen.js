class CustomScreen extends BaseInstrument {
    constructor() {
        super();
        this.isInitialized = false;
    }

    get templateID() {
        return "CustomScreenTemplate";
    }

    connectedCallback() {
        super.connectedCallback();
        this.initialize();
    }

    initialize() {
        if (this.isInitialized) return;

        // Set up button event listeners
        const btn1 = this.querySelector("#btn1");
        const btn2 = this.querySelector("#btn2");
        const btn3 = this.querySelector("#btn3");

        if (btn1) {
            btn1.addEventListener("click", () => {
                console.log("Button 1 clicked");
                // Example: Toggle Landing Lights
                SimVar.SetSimVarValue("L:LANDING_LIGHTS_TOGGLE", "Bool", 1);
            });
        }

        if (btn2) {
            btn2.addEventListener("click", () => {
                console.log("Button 2 clicked");
                // Example: Toggle Taxi Lights
                SimVar.SetSimVarValue("L:TAXI_LIGHTS_TOGGLE", "Bool", 1);
            });
        }

        if (btn3) {
            btn3.addEventListener("click", () => {
                console.log("Button 3 clicked");
                // Example: Toggle Nav Lights
                SimVar.SetSimVarValue("L:NAV_LIGHTS_TOGGLE", "Bool", 1);
            });
        }

        this.isInitialized = true;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    // This function will be called at each frame
    Update() {
        if (!this.isInitialized) return;

        // Get flight data from SimVars
        const altitude = SimVar.GetSimVarValue("INDICATED ALTITUDE", "feet");
        const airspeed = SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots");
        const heading = SimVar.GetSimVarValue("HEADING INDICATOR", "degrees");

        // Update the display
        this.updateDisplay(altitude, airspeed, heading);
    }

    // Update the display with flight data
    updateDisplay(altitude, airspeed, heading) {
        const altitudeElement = this.querySelector("#altitude-value");
        const airspeedElement = this.querySelector("#airspeed-value");
        const headingElement = this.querySelector("#heading-value");

        if (altitudeElement) {
            altitudeElement.textContent = Math.round(altitude);
        }

        if (airspeedElement) {
            airspeedElement.textContent = Math.round(airspeed);
        }

        if (headingElement) {
            headingElement.textContent = Math.round(heading);
        }
    }

    // Inform the sim that this gauge is interactive
    get isInteractive() {
        return true;
    }
}

registerInstrument("custom-screen-element", CustomScreen); 