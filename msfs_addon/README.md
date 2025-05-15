# Fenix A320 Custom Interactive Screen

This add-on provides a custom interactive screen for the Fenix A320 aircraft in Microsoft Flight Simulator 2020.

## Installation

1. Copy the entire directory to your MSFS Community folder.
2. Start Microsoft Flight Simulator.
3. Select the Fenix A320 aircraft.
4. The custom screen should now be visible in the cockpit.

## How to Use

### Positioning the Screen

There are several ways to position your custom screen in the Fenix A320 cockpit:

1. **Using Add-on Mode**:
   - This add-on creates a new interactive display that can be placed anywhere in the cockpit.
   - The screen displays flight information and has interactive buttons.

2. **Pop-out Method**:
   - You can also use the "New UI Window Mode" (bind this key in your MSFS controls) to pop out the screen as a separate window.
   - This is useful for touchscreen setups or multi-monitor configurations.

### Interacting with the Screen

The screen features three interactive buttons:
- Button 1: Toggles landing lights
- Button 2: Toggles taxi lights
- Button 3: Toggles navigation lights

The screen also displays real-time flight information:
- Current altitude
- Current airspeed
- Current heading

## Customizing the Screen

If you want to modify the functionality or appearance:

1. Edit the files in `html_ui/Pages/VCockpit/Instruments/FenixA320/CustomInteractiveScreen/`
2. For HTML layout changes, edit `CustomScreen.html`
3. For styling changes, edit `CustomScreen.css`
4. For functionality changes, edit `CustomScreen.js`

## Troubleshooting

- If the screen doesn't appear, verify that the package is correctly installed in your Community folder.
- Try using the pop-out method to ensure the gauge is working properly.
- Check that you're using a compatible version of the Fenix A320.

## Disclaimer

This add-on is for personal use only and complies with the Fenix EULA as it does not modify any of the base aircraft files. 