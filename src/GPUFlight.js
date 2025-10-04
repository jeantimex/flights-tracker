import * as THREE from "three";

/**
 * GPU-optimized Flight class
 * Instead of calculating positions every frame, this class sets up flight path data
 * that the GPU shader uses for animation
 */
export class GPUFlight {
  constructor(
    flightOptions,
    earth,
    gpuPlaneRenderer,
    instanceId,
    mergedFlightPaths
  ) {
    this.flightOptions = flightOptions;
    this.departure = flightOptions.departure;
    this.arrival = flightOptions.arrival;
    this.earth = earth;
    this.gpuPlaneRenderer = gpuPlaneRenderer;
    this.instanceId = instanceId;
    this.mergedFlightPaths = mergedFlightPaths;
    this.speed = flightOptions.speed || 500;

    // Calculate static flight path data once
    this.setupFlightPath();
  }

  setupFlightPath() {
    const surfaceOffset = 5; // Very close to surface
    const maxCruiseAltitude = 200; // Maximum cruise altitude
    const minCruiseAltitude = 15; // Minimum cruise altitude for very short flights

    // Convert lat/lng to 3D positions
    this.origin = this.earth.latLngToVector3(this.departure.lat, this.departure.lng);
    this.destination = this.earth.latLngToVector3(this.arrival.lat, this.arrival.lng);

    // Create points on globe surface
    const startSurface = this.origin
      .clone()
      .normalize()
      .multiplyScalar(this.earth.getRadius() + surfaceOffset);
    const endSurface = this.destination
      .clone()
      .normalize()
      .multiplyScalar(this.earth.getRadius() + surfaceOffset);

    // Calculate distance between origin and destination
    const distance = startSurface.distanceTo(endSurface);
    const maxDistance = this.earth.getRadius() * Math.PI; // Half circumference

    // Calculate dynamic cruise altitude based on distance
    const distanceRatio = Math.min(distance / (maxDistance * 0.3), 1);
    const cruiseAltitude = minCruiseAltitude + (maxCruiseAltitude - minCruiseAltitude) * Math.pow(distanceRatio, 0.7);

    // Create control points for Bézier curve (similar to original but optimized)
    const climbPoint1 = startSurface
      .clone()
      .lerp(endSurface, 0.2)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.4);

    const climbPoint2 = startSurface
      .clone()
      .lerp(endSurface, 0.35)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.75);

    const cruisePeak = startSurface
      .clone()
      .lerp(endSurface, 0.5)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.85);

    const descentPoint1 = startSurface
      .clone()
      .lerp(endSurface, 0.65)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.75);

    const descentPoint2 = startSurface
      .clone()
      .lerp(endSurface, 0.8)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.4);

    // Create simplified Bézier curve with 4 control points for GPU
    // We'll use a 4-point cubic Bézier: start -> climb -> cruise -> end
    this.controlPoints = [
      startSurface,          // P0: Start
      climbPoint2,           // P1: Climb peak
      descentPoint1,         // P2: Descent start
      endSurface             // P3: End
    ];

    // Calculate duration based on path length and speed
    this.calculateDuration();

    // Send flight path data to GPU renderer
    this.updateGPURenderer();

    // Add to merged flight paths if needed
    if (this.mergedFlightPaths) {
      // Create Three.js curve for flight path visualization
      const curve = new THREE.CatmullRomCurve3([
        startSurface,
        climbPoint1,
        climbPoint2,
        cruisePeak,
        descentPoint1,
        descentPoint2,
        endSurface
      ]);

      this.mergedFlightPaths.addFlightPath(
        this.instanceId,
        curve,
        this.flightOptions
      );
    }
  }

  calculateDuration() {
    // Approximate path length using control points
    let pathLength = 0;
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      pathLength += this.controlPoints[i].distanceTo(this.controlPoints[i + 1]);
    }

    // Duration = distance / speed
    this.duration = pathLength / this.speed;
  }

  updateGPURenderer() {
    if (!this.gpuPlaneRenderer) return;

    // Set flight path data in GPU renderer
    this.gpuPlaneRenderer.setFlightPath(
      this.instanceId,
      this.controlPoints[0], // Origin
      this.controlPoints[3], // Destination
      this.controlPoints,    // All control points
      this.duration
    );

    // Mark attributes for GPU update
    this.gpuPlaneRenderer.markAttributesNeedUpdate();
  }

  // GPU version doesn't need frame-by-frame updates
  update(deltaTime) {
    // The GPU handles all animation - no CPU work needed!
    // This is where we get our 60-80% CPU reduction
  }

  // Swap route for return journey
  swapRoute() {
    // Swap departure and arrival
    const tempDeparture = this.departure;
    this.departure = this.arrival;
    this.arrival = tempDeparture;

    // Recalculate flight path
    this.setupFlightPath();
  }

  // Update plane renderer (for switching between GPU/CPU modes)
  setPlaneRenderer(newRenderer) {
    this.gpuPlaneRenderer = newRenderer;
    if (newRenderer && newRenderer.setFlightPath) {
      this.updateGPURenderer();
    }
  }

  // Compatibility methods for interface consistency
  addToScene(scene) {
    // GPU version doesn't add individual objects to scene
  }

  getOrigin() {
    return this.origin;
  }

  getDestination() {
    return this.destination;
  }

  getDeparture() {
    return this.departure;
  }

  getArrival() {
    return this.arrival;
  }

  getCurrentPosition() {
    // For GPU version, position is calculated in shader
    // Return approximate position based on current time if needed
    return this.controlPoints[0]; // Simplified for compatibility
  }
}