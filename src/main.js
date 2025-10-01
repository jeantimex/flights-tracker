import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "stats.js";
import { Earth } from "./Earth.js";
import { Flight } from "./Flight.js";
import { InstancedPlanes } from "./InstancedPlanes.js";
import { MergedFlightPaths } from "./MergedFlightPaths.js";
import { Stars } from "./Stars.js";
import { Controls } from "./Controls.js";
import {
  getSunVector3,
  getCurrentUtcTimeHours,
  hoursToTimeString,
  animateCameraToPosition,
  vector3ToLatLng
} from "./Utils.js";
import { flights as flightData } from "./Data.js";

let scene,
  camera,
  renderer,
  controls,
  earth,
  flights,
  guiControls,
  instancedPlanes,
  mergedFlightPaths,
  stats,
  stars,
  ambientLight,
  directionalLight;
let clock = new THREE.Clock();

function createLoadingScreen() {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-screen';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000000;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 50px;
    height: 50px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid #58a6ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  `;

  // Add CSS animation for spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  loadingDiv.appendChild(spinner);
  document.body.appendChild(loadingDiv);
}

function checkReadyToRemoveLoadingScreen() {
  if (window.earthTextureLoaded && window.minTimeElapsed) {
    setInitialCameraPosition();
  }
}

function removeLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.5s ease-out';
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
  }
}

function init() {
  // Show loading screen first
  createLoadingScreen();

  // Setup GUI controls first
  setupGUI();

  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );
  // Initialize loading state
  window.earthTextureLoaded = false;
  window.minTimeElapsed = false;

  // Position camera to show day/night terminator line with delay to show loading screen
  setTimeout(() => {
    window.minTimeElapsed = true;
    checkReadyToRemoveLoadingScreen();
  }, 2000); // Show loading screen for at least 2 seconds

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  document.body.appendChild(renderer.domElement);

  // Create footer with attribution
  createFooter();

  // Initialize Stats
  stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  stats.dom.style.position = "absolute";
  stats.dom.style.left = "0px";
  stats.dom.style.top = "0px";
  document.body.appendChild(stats.dom);

  // Add lighting
  ambientLight = new THREE.AmbientLight(0x404040, guiControls.nightBrightness);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, guiControls.dayBrightness);

  // Initialize sun position based on real time
  updateSunPosition();

  scene.add(directionalLight);

  // Create and add stars (background starfield)
  stars = new Stars(5000, 10000, 20000);
  stars.addToScene(scene);

  // Create and add Earth with texture loading callback
  earth = new Earth(3000, () => {
    window.earthTextureLoaded = true;
    checkReadyToRemoveLoadingScreen();
  });
  earth.addToScene(scene);

  // Create instanced planes manager
  instancedPlanes = new InstancedPlanes(flightData.length, 100);
  instancedPlanes.addToScene(scene);
  instancedPlanes.setGlobalScale(guiControls.planeSize);

  // Create merged flight paths manager
  mergedFlightPaths = new MergedFlightPaths();
  mergedFlightPaths.initialize(flightData.length);
  mergedFlightPaths.addToScene(scene);

  // Create all flights from data with instance IDs
  const allFlights = flightData.map((flightOptions, index) => {
    const flight = new Flight(
      flightOptions,
      earth,
      instancedPlanes,
      index,
      mergedFlightPaths
    );
    return flight;
  });

  // Show only the initial number of flights
  flights = allFlights.slice(0, guiControls.flightCount);
  flights.forEach((flight) => {
    flight.addToScene(scene);
  });

  // Set active count for instanced planes and flight paths
  instancedPlanes.setActiveCount(guiControls.flightCount);
  mergedFlightPaths.setVisibleFlightCount(guiControls.flightCount);

  // Store all flights for later use
  window.allFlights = allFlights;

  // Initialize OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 3200; // Prevent zooming into Earth surface (Earth radius is 3000)
  controls.maxDistance = 20000;

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createFooter() {
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    color: white;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 1000;
    pointer-events: none;
  `;

  footer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; pointer-events: auto;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 16px; height: 16px; fill: white;">
        <path d="M173.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM252.8 8c-138.7 0-244.8 105.3-244.8 244 0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1 100-33.2 167.8-128.1 167.8-239 0-138.7-112.5-244-251.2-244zM105.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9s4.3 3.3 5.6 2.3c1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"/>
      </svg>
      <span>Made by</span>
      <a href="https://github.com/jeantimex/flights-tracker" target="_blank" rel="noopener noreferrer"
         style="color: #58a6ff; text-decoration: none; font-weight: 500;">
        jeantimex
      </a>
    </div>
    <div id="coordinates" style="pointer-events: none; font-family: monospace; font-size: 12px; opacity: 0.8;">
      Lat: 0.00°, Lng: 0.00°
    </div>
  `;

  document.body.appendChild(footer);
}

function updateCoordinateDisplay() {
  const coordinatesElement = document.getElementById('coordinates');
  if (coordinatesElement && camera && earth) {
    // Get the direction from camera to center (0,0,0)
    const direction = new THREE.Vector3(0, 0, 0).sub(camera.position).normalize();
    // Scale to earth surface
    const earthSurfacePoint = direction.multiplyScalar(earth.getRadius());
    // Convert to lat/lng
    const coords = vector3ToLatLng(earthSurfacePoint, earth.getRadius());
    // Update display with 2 decimal places
    coordinatesElement.textContent = `Lat: ${coords.lat.toFixed(2)}°, Lng: ${coords.lng.toFixed(2)}°`;
  }
}

function setupGUI() {
  const controls = new Controls();

  const callbacks = {
    onPlaneSizeChange: (value) => {
      if (instancedPlanes) {
        instancedPlanes.setGlobalScale(value);
      }
    },
    onFlightCountChange: updateFlightCount,
    onShowFlightPathsChange: toggleFlightPaths,
    onShowPlanesChange: togglePlanes,
    onColorizePlanesChange: togglePlaneColorization,
    onDayNightEffectChange: toggleDayNightEffect,
    onAtmosphereEffectChange: toggleAtmosphereEffect,
    onResetSunPosition: () => {
      directionalLight.position.set(0, 1000, 1000);
    },
    onDayBrightnessChange: updateLighting,
    onNightBrightnessChange: updateLighting
  };

  controls.setup(callbacks, flightData.length);
  guiControls = controls.getControls();

  // Store controls instance globally for access in other functions
  window.guiControlsInstance = controls;
}

function updateFlightCount(count) {
  // Update flights array to new count
  flights = window.allFlights.slice(0, count);

  // Update instanced planes active count
  if (instancedPlanes) {
    instancedPlanes.setActiveCount(count);
  }

  // Update merged flight paths visible count
  if (mergedFlightPaths) {
    mergedFlightPaths.setVisibleFlightCount(count);
  }
}

function toggleDayNightEffect(enabled) {
  if (enabled) {
    updateLighting();
  } else {
    // Disable day/night effect - make lighting uniform and bright
    directionalLight.intensity = 0.5;
    ambientLight.intensity = 1.2;
  }
}

function updateLighting() {
  if (guiControls.dayNightEffect) {
    // Use brightness controls for realistic day/night lighting
    directionalLight.intensity = guiControls.dayBrightness;
    ambientLight.intensity = guiControls.nightBrightness;
  }
}

function toggleAtmosphereEffect(enabled) {
  if (earth && earth.atmosphere) {
    earth.atmosphere.mesh.visible = enabled;
  }
}

function toggleFlightPaths(enabled) {
  if (mergedFlightPaths) {
    mergedFlightPaths.setCurvesVisible(enabled);
  }
}

function togglePlanes(enabled) {
  if (instancedPlanes && instancedPlanes.getMesh()) {
    instancedPlanes.getMesh().visible = enabled;
  }
}

function togglePlaneColorization(enabled) {
  if (instancedPlanes) {
    instancedPlanes.setColorization(enabled);
  }
}

function setInitialCameraPosition() {
  // Get current sun position to determine day/night terminator
  const utcTime = getCurrentUtcTimeHours();
  const sunPos = getSunVector3(3000, utcTime);

  // Position camera at the sun position, then pan 90 degrees to the right
  const cameraDistance = 6000;
  const sunDirection = sunPos.clone().normalize();

  // Rotate the sun direction 70 degrees to the right (around Y-axis)
  const angle = (70 * Math.PI) / 180; // Convert 70 degrees to radians
  const rotatedDirection = new THREE.Vector3();
  rotatedDirection.x = sunDirection.x * Math.cos(angle) + sunDirection.z * Math.sin(angle);
  rotatedDirection.y = sunDirection.y;
  rotatedDirection.z = -sunDirection.x * Math.sin(angle) + sunDirection.z * Math.cos(angle);

  const targetPosition = rotatedDirection.multiplyScalar(cameraDistance);

  // Set a closer starting position to avoid the dramatic zoom effect
  const startPosition = targetPosition.clone().multiplyScalar(1.2); // Start only 20% further out
  camera.position.copy(startPosition);

  // Animate camera to target position with 1 second delay
  animateCameraToPosition(camera, startPosition, targetPosition, 2000, 1000);

  // Remove loading screen after camera positioning starts
  removeLoadingScreen();
}

function updateSunPosition() {
  if (directionalLight) {
    if (guiControls.realTimeSun) {
      // Continuously update UTC time for real-time mode
      const currentUtcTime = getCurrentUtcTimeHours();
      guiControls.simulatedTime = currentUtcTime;
      guiControls.timeDisplay = hoursToTimeString(currentUtcTime);

      // Force update GUI controls to reflect real-time changes
      if (window.guiControlsInstance && window.guiControlsInstance.controllers) {
        // Update the time display field
        if (window.guiControlsInstance.controllers.timeDisplay) {
          window.guiControlsInstance.controllers.timeDisplay.updateDisplay();
        }
        // Update the time slider
        if (window.guiControlsInstance.controllers.timeSlider) {
          window.guiControlsInstance.controllers.timeSlider.updateDisplay();
        }
      }

      const sunPosition = getSunVector3(earth ? earth.getRadius() : 3000, guiControls.simulatedTime);
      directionalLight.position.copy(sunPosition);
    } else if (guiControls.dayNightEffect) {
      // Use simulated time for manual time control (already in UTC)
      const sunPosition = getSunVector3(earth ? earth.getRadius() : 3000, guiControls.simulatedTime);
      directionalLight.position.copy(sunPosition);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  stats.begin();

  const delta = clock.getDelta();

  // Update controls
  controls.update();

  // Update stars animation
  if (stars) {
    stars.update(delta);
  }

  // Update flight animations with speed multiplier (only if planes are visible)
  if (flights && guiControls.showPlanes) {
    const adjustedDelta = delta * guiControls.animationSpeed;
    flights.forEach((flight) => {
      flight.update(adjustedDelta);
    });
  }

  // Update sun position every frame if real-time sun is enabled
  updateSunPosition();

  // Update coordinate display
  updateCoordinateDisplay();

  renderer.render(scene, camera);

  stats.end();
}

// Initialize and start the application
init();
animate();
