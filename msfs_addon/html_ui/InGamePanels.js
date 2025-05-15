// Register Audio Control as an in-game panel

class IngamePanelCustomPanels extends TemplateElement {
    constructor() {
        super();
        this.panelsRegistered = false;
    }

    connectedCallback() {
        super.connectedCallback();
        
        if (!this.panelsRegistered) {
            this.registerAudioControlPanel();
            this.panelsRegistered = true;
        }
    }

    registerAudioControlPanel() {
        try {
            // Register Audio Control Panel
            const audioControlInfo = new IngamePanelDefinition();
            audioControlInfo.id = "AUDIO_CONTROL_PANEL";
            audioControlInfo.htmlFile = "/Pages/Standalone/AudioControl/AudioControl.html";
            audioControlInfo.name = "Aircraft Audio Control";
            audioControlInfo.resizeDirections = "All";
            audioControlInfo.widthRatio = 0.3; // default width
            audioControlInfo.heightRatio = 0.5; // default height
            audioControlInfo.defaultWidth = 500;
            audioControlInfo.defaultHeight = 600;
            audioControlInfo.defaultLeft = 100;
            audioControlInfo.defaultTop = 100;
            audioControlInfo.icon = "/Pages/Standalone/AudioControl/icon_audio.svg"; // Will create this later
            audioControlInfo.visible = false;
            this.registerPanel(audioControlInfo);
            
            // Register toolbar item
            const audioControlButton = new ToolBarButtonDefinition();
            audioControlButton.id = "TOGGLE_AUDIO_CONTROL";
            audioControlButton.iconPath = "/Pages/Standalone/AudioControl/icon_audio.svg"; // Will create this later
            audioControlButton.toolbarItemName = "Aircraft Audio Control";
            audioControlButton.toolbarTooltip = "Open Aircraft Audio Control";
            audioControlButton.uniqueLabel = "AUDIO_CONTROL_BUTTON";
            
            // Handle button click
            Coherent.on("TOOLBAR_CLICKED_" + audioControlButton.uniqueLabel, () => {
                const audioControlPanel = this.getPanel(audioControlInfo.id);
                if (audioControlPanel) {
                    if (audioControlPanel.isVisible) {
                        audioControlPanel.setVisible(false);
                    } else {
                        audioControlPanel.setVisible(true);
                    }
                }
            });
            
            this.registerToolbarButton(audioControlButton);
            
            // Also load standalone.js for popup window mode support
            const script = document.createElement("script");
            script.src = "/Pages/Standalone/AudioControl/standalone.js";
            document.body.appendChild(script);
            
            console.log("Audio Control Panel registered successfully");
        } catch (error) {
            console.error("Error registering Audio Control Panel:", error);
        }
    }
}

window.customElements.define("ingame-ui-custom-panels", IngamePanelCustomPanels);
console.log("Audio Control Custom Panels initialized"); 