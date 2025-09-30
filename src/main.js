import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "dat.gui";
import Stats from "stats.js";
import { Earth } from "./Earth.js";
import { Flight } from "./Flight.js";
import { InstancedPlanes } from "./InstancedPlanes.js";
import { MergedFlightPaths } from "./MergedFlightPaths.js";
import { Stars } from "./Stars.js";
import { getSunVector3 } from "./Utils.js";
import { flights as flightData } from "./Data.js";

let scene,
  camera,
  renderer,
  controls,
  earth,
  flights,
  gui,
  instancedPlanes,
  mergedFlightPaths,
  stats,
  stars,
  ambientLight,
  directionalLight;
let clock = new THREE.Clock();

// GUI controls object
const guiControls = {
  planeSize: 0.7,
  animationSpeed: 0.3,
  flightCount: 3500,
  dayNightEffect: true,
  atmosphereEffect: true,
  showFlightPaths: true,
  showPlanes: true,
  realTimeSun: true,
  simulatedTime: getCurrentTimeHours(),
  timeDisplay: hoursToTimeString(getCurrentTimeHours()),
  nightBrightness: 1.5,
  dayBrightness: 2.0,
  colorizeePlanes: true,
};

// Helper function to get current Pacific time in decimal hours (0-24)
function getCurrentTimeHours() {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.getHours() + pacificTime.getMinutes() / 60;
}

// Helper function to convert Pacific time to UTC for sun calculations
function pacificToUtcHours(pacificHours) {
  // Get timezone offset between Pacific and UTC
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const utcDate = new Date(utc);

  // Create Pacific date for the same day
  const pacificDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));

  // Calculate offset in hours
  const offsetHours = (utcDate.getTime() - pacificDate.getTime()) / (1000 * 60 * 60);

  // Convert Pacific to UTC
  return (pacificHours + offsetHours + 24) % 24;
}

// Helper function to convert decimal hours to HH:MM format
function hoursToTimeString(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper function to convert UTC time to Pacific time display
function utcToPacificTimeString(utcHours) {
  const utcDate = new Date();
  utcDate.setUTCHours(Math.floor(utcHours), (utcHours % 1) * 60, 0, 0);
  const pacificTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  const hours = pacificTime.getHours();
  const minutes = pacificTime.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper function to convert UTC decimal hours to Pacific decimal hours
function utcToPacificHours(utcHours) {
  const utcDate = new Date();
  utcDate.setUTCHours(Math.floor(utcHours), (utcHours % 1) * 60, 0, 0);
  const pacificTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.getHours() + pacificTime.getMinutes() / 60;
}


// Helper function to convert HH:MM format to decimal hours
function timeStringToHours(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

function init() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );
  // Position camera to show day/night terminator line
  setInitialCameraPosition();

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  document.body.appendChild(renderer.domElement);

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

  // Create and add Earth
  earth = new Earth(3000);
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
  controls.minDistance = 100;
  controls.maxDistance = 20000;

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);

  // Setup GUI controls
  setupGUI();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupGUI() {
  gui = new GUI();

  // Plane controls
  const planeFolder = gui.addFolder("Plane Controls");
  planeFolder
    .add(guiControls, "planeSize", 0.1, 3.0, 0.1)
    .name("Size")
    .onChange((value) => {
      // Update instanced planes global scale
      if (instancedPlanes) {
        instancedPlanes.setGlobalScale(value);
      }
    });

  planeFolder.open();

  // Animation controls
  const animationFolder = gui.addFolder("Animation Controls");
  animationFolder
    .add(guiControls, "animationSpeed", 0.1, 3.0, 0.1)
    .name("Speed")
    .onChange((value) => {
      // Speed multiplier is stored and used in the animate loop
    });

  animationFolder.open();

  // Flight controls
  const flightFolder = gui.addFolder("Flight Controls");
  flightFolder
    .add(guiControls, "flightCount", 1, flightData.length, 1)
    .name("Count")
    .onChange((value) => {
      updateFlightCount(value);
    });

  flightFolder
    .add(guiControls, "showFlightPaths")
    .name("Show Paths")
    .onChange((value) => {
      toggleFlightPaths(value);
    });

  flightFolder
    .add(guiControls, "showPlanes")
    .name("Show Planes")
    .onChange((value) => {
      togglePlanes(value);
    });

  flightFolder
    .add(guiControls, "colorizeePlanes")
    .name("Colorize")
    .onChange((value) => {
      togglePlaneColorization(value);
    });

  flightFolder.open();

  // Lighting controls
  const lightingFolder = gui.addFolder("Lighting Controls");
  lightingFolder
    .add(guiControls, "dayNightEffect")
    .name("Day/Night Effect")
    .onChange((value) => {
      toggleDayNightEffect(value);
    });

  lightingFolder
    .add(guiControls, "atmosphereEffect")
    .name("Atmosphere Effect")
    .onChange((value) => {
      toggleAtmosphereEffect(value);
    });

  const realTimeSunController = lightingFolder
    .add(guiControls, "realTimeSun")
    .name("Real-time Sun")
    .onChange((value) => {
      if (!value) {
        // Reset to default position when disabled
        directionalLight.position.set(0, 1000, 1000);
      } else {
        // Update simulated time to current time when enabling real-time
        guiControls.simulatedTime = getCurrentTimeHours();
        guiControls.timeDisplay = hoursToTimeString(guiControls.simulatedTime);
        // Refresh GUI controllers to show updated values
        timeDisplayController.updateDisplay();
        timeSliderController.updateDisplay();
      }
    });

  const timeDisplayController = lightingFolder
    .add(guiControls, "timeDisplay")
    .name("Time (Pacific)")
    .onChange((value) => {
      // Validate time format
      if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        guiControls.simulatedTime = timeStringToHours(value);
        timeSliderController.updateDisplay();
        // Disable real-time sun when manually adjusting time
        if (guiControls.realTimeSun) {
          guiControls.realTimeSun = false;
          realTimeSunController.updateDisplay();
        }
      }
    });

  const timeSliderController = lightingFolder
    .add(guiControls, "simulatedTime", 0, 24, 0.1)
    .name("Time Slider")
    .onChange((value) => {
      guiControls.timeDisplay = hoursToTimeString(value);
      timeDisplayController.updateDisplay();
      // Disable real-time sun when manually adjusting time
      if (guiControls.realTimeSun) {
        guiControls.realTimeSun = false;
        realTimeSunController.updateDisplay();
      }
    });

  lightingFolder.open();

  // Brightness controls
  const brightnessFolder = gui.addFolder("Brightness Controls");
  brightnessFolder
    .add(guiControls, "dayBrightness", 0.0, 3.0, 0.1)
    .name("Day")
    .onChange((value) => {
      updateLighting();
    });

  brightnessFolder
    .add(guiControls, "nightBrightness", 0.0, 2.0, 0.1)
    .name("Night")
    .onChange((value) => {
      updateLighting();
    });

  brightnessFolder.open();
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
  const pacificTime = getCurrentTimeHours();
  const utcTime = pacificToUtcHours(pacificTime);
  const sunPos = getSunVector3(3000, (utcTime + 12) % 24);

  // Position camera at the sun position, then pan 90 degrees to the right
  const cameraDistance = 6000;
  const sunDirection = sunPos.clone().normalize();

  // Rotate the sun direction 70 degrees to the right (around Y-axis)
  const angle = (70 * Math.PI) / 180; // Convert 70 degrees to radians
  const rotatedDirection = new THREE.Vector3();
  rotatedDirection.x = sunDirection.x * Math.cos(angle) + sunDirection.z * Math.sin(angle);
  rotatedDirection.y = sunDirection.y;
  rotatedDirection.z = -sunDirection.x * Math.sin(angle) + sunDirection.z * Math.cos(angle);

  const cameraPosition = rotatedDirection.multiplyScalar(cameraDistance);

  camera.position.copy(cameraPosition);
  camera.lookAt(0, 0, 0); // Look at Earth center
}

function updateSunPosition() {
  if (directionalLight) {
    if (guiControls.realTimeSun) {
      // Update simulated time to current time for real-time mode
      guiControls.simulatedTime = getCurrentTimeHours();
      guiControls.timeDisplay = hoursToTimeString(guiControls.simulatedTime);

      const utcTime = pacificToUtcHours(guiControls.simulatedTime);
      const sunPosition = getSunVector3(earth ? earth.getRadius() : 3000, (utcTime + 12) % 24);
      directionalLight.position.copy(sunPosition);
    } else if (guiControls.dayNightEffect) {
      // Use simulated time for manual time control
      const utcTime = pacificToUtcHours(guiControls.simulatedTime);
      const sunPosition = getSunVector3(earth ? earth.getRadius() : 3000, (utcTime + 12) % 24);
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

  // Update flight animations with speed multiplier
  if (flights) {
    const adjustedDelta = delta * guiControls.animationSpeed;
    flights.forEach((flight) => {
      flight.update(adjustedDelta);
    });
  }

  // Update sun position every frame if real-time sun is enabled
  updateSunPosition();

  renderer.render(scene, camera);

  stats.end();
}

// Initialize and start the application
init();
animate();
