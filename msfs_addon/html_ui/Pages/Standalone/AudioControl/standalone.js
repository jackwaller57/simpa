// Aircraft Audio Control - Standalone Launcher
// Based on the ChasePane pattern for standalone windows

/**
 * Register the Audio Control window with MSFS
 */
const registerStandaloneWindow = () => {
    try {
        const popupWindowOptions = {
            url: "/Pages/Standalone/AudioControl/AudioControl.html",
            width: 500,
            height: 600,
            resizable: true,
            title: "Aircraft Audio Control"
        };

        // Register window with MSFS
        window.sessionStorage.setItem("PopupWindowOptions", JSON.stringify(popupWindowOptions));
        window.sessionStorage.setItem("LaunchPopup", "1");
        
        // Handle window opening/closing logic
        const windowState = {
            isOpen: false
        };
        
        // Create a UI element to show status
        const createStatusUI = () => {
            const statusContainer = document.createElement("div");
            statusContainer.id = "audio-control-status";
            statusContainer.style.position = "fixed";
            statusContainer.style.bottom = "10px";
            statusContainer.style.right = "10px";
            statusContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            statusContainer.style.padding = "5px 10px";
            statusContainer.style.borderRadius = "5px";
            statusContainer.style.color = "white";
            statusContainer.style.fontSize = "12px";
            statusContainer.style.fontFamily = "Arial, sans-serif";
            statusContainer.style.zIndex = "9999";
            statusContainer.style.display = "none";
            
            document.body.appendChild(statusContainer);
            
            return statusContainer;
        };
        
        // Toolbar button setup
        Coherent.on("OnInteractionEvent", (id) => {
            if (id === "TOGGLE_AUDIO_CONTROL") {
                if (!windowState.isOpen) {
                    // Open window
                    window.sessionStorage.setItem("LaunchPopup", "1");
                    windowState.isOpen = true;
                    
                    // Show status message
                    const statusContainer = document.getElementById("audio-control-status") || createStatusUI();
                    statusContainer.textContent = "Audio Control: Opening...";
                    statusContainer.style.display = "block";
                    
                    setTimeout(() => {
                        statusContainer.style.display = "none";
                    }, 3000);
                } else {
                    // Close window logic handled by MSFS
                    windowState.isOpen = false;
                }
            }
        });
        
        // Monitor window state
        window.addEventListener("message", (event) => {
            if (event.data && event.data.type === "PopupWindow") {
                if (event.data.state === "closed") {
                    windowState.isOpen = false;
                } else if (event.data.state === "opened") {
                    windowState.isOpen = true;
                }
            }
        });
        
        console.log("Aircraft Audio Control registered as standalone window");
    } catch (error) {
        console.error("Error registering standalone window:", error);
    }
};

/**
 * Initialize when document is loaded
 */
document.addEventListener("DOMContentLoaded", () => {
    registerStandaloneWindow();
}); 