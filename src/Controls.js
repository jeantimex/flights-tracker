import { GUI } from "dat.gui";
import { getCurrentUtcTimeHours, hoursToTimeString, timeStringToHours } from "./Utils.js";

/**
 * Controls class manages all GUI controls and their interactions
 */
export class Controls {
  constructor() {
    this.gui = null;
    this.controllers = {};
    this.guiControls = {
      planeSize: 5.0,
      animationSpeed: 0.3,
      flightCount: 3500,
      dayNightEffect: true,
      atmosphereEffect: true,
      showFlightPaths: true,
      showPlanes: true,
      realTimeSun: true,
      simulatedTime: getCurrentUtcTimeHours(),
      timeDisplay: hoursToTimeString(getCurrentUtcTimeHours()),
      nightBrightness: 0.8,
      dayBrightness: 2.0,
      colorizeePlanes: true,
      planeRenderType: "instanced", // "instanced" or "particles"
    };
    this.callbacks = {};
  }

  /**
   * Initialize the GUI controls
   * @param {Object} callbacks - Object containing callback functions for different controls
   * @param {number} maxFlightCount - Maximum number of flights available in the dataset
   */
  setup(callbacks = {}, maxFlightCount = 7000) {
    this.callbacks = callbacks;
    this.gui = new GUI();

    this.setupPlaneControls();
    this.setupAnimationControls();
    this.setupFlightControls(maxFlightCount);
    this.setupLightingControls();
    this.setupBrightnessControls();
  }

  setupPlaneControls() {
    const planeFolder = this.gui.addFolder("Plane Controls");

    planeFolder
      .add(this.guiControls, "planeRenderType", ["instanced", "particles"])
      .name("Render Type")
      .onChange((value) => {
        if (this.callbacks.onPlaneRenderTypeChange) {
          this.callbacks.onPlaneRenderTypeChange(value);
        }
      });

    planeFolder
      .add(this.guiControls, "planeSize", 1.0, 10.0, 0.1)
      .name("Size")
      .onChange((value) => {
        if (this.callbacks.onPlaneSizeChange) {
          this.callbacks.onPlaneSizeChange(value);
        }
      });

    planeFolder
      .add(this.guiControls, "colorizeePlanes")
      .name("Colorize")
      .onChange((value) => {
        if (this.callbacks.onColorizePlanesChange) {
          this.callbacks.onColorizePlanesChange(value);
        }
      });

    planeFolder.open();
  }

  setupAnimationControls() {
    const animationFolder = this.gui.addFolder("Animation Controls");
    animationFolder
      .add(this.guiControls, "animationSpeed", 0.1, 3.0, 0.1)
      .name("Speed")
      .onChange((value) => {
        if (this.callbacks.onAnimationSpeedChange) {
          this.callbacks.onAnimationSpeedChange(value);
        }
      });

    animationFolder.open();
  }

  setupFlightControls(maxFlightCount = 7000) {
    const flightFolder = this.gui.addFolder("Flight Controls");
    flightFolder
      .add(this.guiControls, "flightCount", 1, maxFlightCount, 1)
      .name("Count")
      .onChange((value) => {
        if (this.callbacks.onFlightCountChange) {
          this.callbacks.onFlightCountChange(value);
        }
      });

    flightFolder
      .add(this.guiControls, "showFlightPaths")
      .name("Show Paths")
      .onChange((value) => {
        if (this.callbacks.onShowFlightPathsChange) {
          this.callbacks.onShowFlightPathsChange(value);
        }
      });

    flightFolder
      .add(this.guiControls, "showPlanes")
      .name("Show Planes")
      .onChange((value) => {
        if (this.callbacks.onShowPlanesChange) {
          this.callbacks.onShowPlanesChange(value);
        }
      });

    flightFolder.open();
  }

  setupLightingControls() {
    const lightingFolder = this.gui.addFolder("Lighting Controls");
    lightingFolder
      .add(this.guiControls, "dayNightEffect")
      .name("Day/Night Effect")
      .onChange((value) => {
        if (this.callbacks.onDayNightEffectChange) {
          this.callbacks.onDayNightEffectChange(value);
        }
      });

    lightingFolder
      .add(this.guiControls, "atmosphereEffect")
      .name("Atmosphere Effect")
      .onChange((value) => {
        if (this.callbacks.onAtmosphereEffectChange) {
          this.callbacks.onAtmosphereEffectChange(value);
        }
      });

    this.controllers.realTimeSun = lightingFolder
      .add(this.guiControls, "realTimeSun")
      .name("Real-time Sun")
      .onChange((value) => {
        if (!value) {
          // Reset to default position when disabled
          if (this.callbacks.onResetSunPosition) {
            this.callbacks.onResetSunPosition();
          }
        } else {
          // Update simulated time to current time when enabling real-time
          this.guiControls.simulatedTime = getCurrentUtcTimeHours();
          this.guiControls.timeDisplay = hoursToTimeString(this.guiControls.simulatedTime);
          // Refresh GUI controllers to show updated values
          this.controllers.timeDisplay.updateDisplay();
          this.controllers.timeSlider.updateDisplay();
        }

        if (this.callbacks.onRealTimeSunChange) {
          this.callbacks.onRealTimeSunChange(value);
        }
      });

    this.controllers.timeDisplay = lightingFolder
      .add(this.guiControls, "timeDisplay")
      .name("Time (UTC)")
      .onChange((value) => {
        // This should not be called since the input is disabled
        // But keeping for safety
        if (/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value)) {
          this.guiControls.simulatedTime = timeStringToHours(value);
          this.controllers.timeSlider.updateDisplay();
          // Disable real-time sun when manually adjusting time
          if (this.guiControls.realTimeSun) {
            this.guiControls.realTimeSun = false;
            this.controllers.realTimeSun.updateDisplay();
          }

          if (this.callbacks.onTimeDisplayChange) {
            this.callbacks.onTimeDisplayChange(value);
          }
        }
      });

    // Disable the time display input to make it read-only
    if (this.controllers.timeDisplay.__input) {
      this.controllers.timeDisplay.__input.disabled = true;
      this.controllers.timeDisplay.__input.style.cursor = 'default';
      this.controllers.timeDisplay.__input.style.backgroundColor = '#2a2a2a';
      this.controllers.timeDisplay.__input.style.color = '#cccccc';
    }

    this.controllers.timeSlider = lightingFolder
      .add(this.guiControls, "simulatedTime", 0, 24, 0.1)
      .name("Time Slider")
      .onChange((value) => {
        this.guiControls.timeDisplay = hoursToTimeString(value);
        this.controllers.timeDisplay.updateDisplay();
        // Disable real-time sun when manually adjusting time
        if (this.guiControls.realTimeSun) {
          this.guiControls.realTimeSun = false;
          this.controllers.realTimeSun.updateDisplay();
        }

        if (this.callbacks.onTimeSliderChange) {
          this.callbacks.onTimeSliderChange(value);
        }
      });

    lightingFolder.open();
  }

  setupBrightnessControls() {
    const brightnessFolder = this.gui.addFolder("Brightness Controls");
    brightnessFolder
      .add(this.guiControls, "dayBrightness", 0.0, 3.0, 0.1)
      .name("Day")
      .onChange((value) => {
        if (this.callbacks.onDayBrightnessChange) {
          this.callbacks.onDayBrightnessChange(value);
        }
      });

    brightnessFolder
      .add(this.guiControls, "nightBrightness", 0.0, 2.0, 0.1)
      .name("Night")
      .onChange((value) => {
        if (this.callbacks.onNightBrightnessChange) {
          this.callbacks.onNightBrightnessChange(value);
        }
      });

    brightnessFolder.open();
  }

  /**
   * Update time display for real-time mode
   * Note: This is now handled directly in main.js updateSunPosition()
   */
  updateTimeDisplay() {
    // This method is kept for backward compatibility
    // but the actual updates are now handled in main.js
  }

  /**
   * Get the current GUI controls values
   * @returns {Object} Current GUI controls state
   */
  getControls() {
    return this.guiControls;
  }

  /**
   * Cleanup GUI
   */
  destroy() {
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }
  }
}