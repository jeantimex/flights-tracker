import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "dat.gui";
import Stats from "stats.js";
import { Earth } from "./Earth.js";
import { Flight } from "./Flight.js";
import { InstancedPlanes } from "./InstancedPlanes.js";
import { MergedFlightPaths } from "./MergedFlightPaths.js";
import { Stars } from "./Stars.js";
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
  planeSize: 0.8,
  animationSpeed: 0.5,
  flightCount: 1000,
  dayNightEffect: true,
  atmosphereEffect: true,
};

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
  camera.position.set(0, 0, 5000);

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
  ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(0, 1000, 1000);
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

  lightingFolder.open();
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
    // Enable day/night effect with directional lighting
    directionalLight.intensity = 1.8;
    ambientLight.intensity = 0.3;
  } else {
    // Disable day/night effect - make lighting uniform and bright
    directionalLight.intensity = 0.5;
    ambientLight.intensity = 1.2;
  }
}

function toggleAtmosphereEffect(enabled) {
  if (earth && earth.atmosphere) {
    earth.atmosphere.mesh.visible = enabled;
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

  renderer.render(scene, camera);

  stats.end();
}

// Initialize and start the application
init();
animate();
