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
  getCurrentPacificTimeHours,
  hoursToTimeString,
  pacificToUtcHours
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

function init() {
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
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  controls.setup(callbacks);
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
  const pacificTime = getCurrentPacificTimeHours();
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
      guiControls.simulatedTime = getCurrentPacificTimeHours();
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

  // Update GUI time display if in real-time mode
  if (window.guiControlsInstance) {
    window.guiControlsInstance.updateTimeDisplay();
  }

  renderer.render(scene, camera);

  stats.end();
}

// Initialize and start the application
init();
animate();
