import * as THREE from "three";

export class Flight {
  constructor(
    flightOptions,
    earth,
    instancedPlanes,
    instanceId,
    mergedFlightPaths
  ) {
    this.flightOptions = flightOptions;
    this.departure = flightOptions.departure;
    this.arrival = flightOptions.arrival;
    this.origin = earth.latLngToVector3(this.departure.lat, this.departure.lng);
    this.destination = earth.latLngToVector3(
      this.arrival.lat,
      this.arrival.lng
    );
    this.earth = earth;
    this.instancedPlanes = instancedPlanes;
    this.instanceId = instanceId;
    this.mergedFlightPaths = mergedFlightPaths;
    this.curve = null;
    this.progress = 0;
    this.speed = flightOptions.speed || 500; // use speed from data or default to 500
    this.duration = 0; // will be calculated based on path length
    this.waitTime = 2; // seconds to wait at destination
    this.isWaiting = false;
    this.waitTimer = 0;
    this.createFlightPath();
  }

  createFlightPath() {
    const surfaceOffset = 5; // Very close to surface
    const maxCruiseAltitude = 200; // Maximum cruise altitude
    const minCruiseAltitude = 30; // Minimum cruise altitude for short flights

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
    const distanceRatio = Math.min(distance / (maxDistance * 0.5), 1); // Normalize to 0-1
    const cruiseAltitude = minCruiseAltitude + (maxCruiseAltitude - minCruiseAltitude) * distanceRatio;

    // Create climb phase points (gradual ascent)
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

    // Create single cruise peak point (reduced height for smoother curve)
    const cruisePeak = startSurface
      .clone()
      .lerp(endSurface, 0.5)
      .normalize()
      .multiplyScalar(this.earth.getRadius() + cruiseAltitude * 0.85);

    // Create descent phase points (gradual descent)
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

    // Create the parabolic flight curve: takeoff -> climb -> peak -> descent -> landing
    this.curve = new THREE.CatmullRomCurve3([
      startSurface,
      climbPoint1,
      climbPoint2,
      cruisePeak,
      descentPoint1,
      descentPoint2,
      endSurface
    ]);

    // Add this flight path to the merged geometry
    if (this.mergedFlightPaths) {
      this.mergedFlightPaths.addFlightPath(
        this.instanceId,
        this.curve,
        this.flightOptions
      );
    }

    // Calculate duration based on path length and constant speed
    this.calculateDuration();
  }

  calculateDuration() {
    if (!this.curve) return;

    // Calculate the total length of the flight path
    const pathLength = this.curve.getLength();

    // Duration = distance / speed
    this.duration = pathLength / this.speed;
  }

  addToScene(scene) {
    // Flight paths are now handled by MergedFlightPaths
    // Planes are handled by InstancedPlanes
    // Nothing to add to scene individually
  }

  update(deltaTime) {
    if (!this.curve) return;

    if (this.isWaiting) {
      // Wait at destination
      this.waitTimer += deltaTime;
      if (this.waitTimer >= this.waitTime) {
        // Swap departure and arrival
        this.swapRoute();
        this.isWaiting = false;
        this.waitTimer = 0;
        this.progress = 0;
      }
      return;
    }

    // Update progress
    this.progress += deltaTime / this.duration;
    if (this.progress >= 1) {
      this.progress = 1;
      this.isWaiting = true;
      this.waitTimer = 0;
    }

    // Get current position on curve
    const position = this.curve.getPointAt(this.progress);

    // Get orientation vectors
    const tangent = this.curve.getTangentAt(this.progress).normalize();
    const normal = position.clone().normalize();

    // Update instanced plane position and orientation
    this.updateInstancedPlane(position, tangent, normal);
  }

  updateInstancedPlane(position, tangent, normal) {
    if (!this.instancedPlanes || this.instanceId === undefined) return;

    // Calculate the up vector perpendicular to both normal and tangent
    const up = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    // Create rotation quaternion
    const quaternion = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    matrix.lookAt(new THREE.Vector3(0, 0, 0), tangent, up);
    quaternion.setFromRotationMatrix(matrix);

    // Apply additional rotations for proper orientation
    const additionalRotation = new THREE.Quaternion();
    additionalRotation.setFromEuler(
      new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0)
    );
    quaternion.multiply(additionalRotation);

    // Update the instanced plane
    this.instancedPlanes.setInstanceTransform(
      this.instanceId,
      position,
      quaternion,
      this.instancedPlanes.globalScale || 1
    );
  }

  swapRoute() {
    // Swap departure and arrival
    const tempDeparture = this.departure;
    this.departure = this.arrival;
    this.arrival = tempDeparture;

    // Update 3D positions
    this.origin = this.earth.latLngToVector3(
      this.departure.lat,
      this.departure.lng
    );
    this.destination = this.earth.latLngToVector3(
      this.arrival.lat,
      this.arrival.lng
    );

    // Recreate flight path
    this.createFlightPath();
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

  getInstanceId() {
    return this.instanceId;
  }

  setGlobalScale(scale) {
    // Update the scale for this specific instance
    if (this.instancedPlanes && this.instanceId !== undefined) {
      this.instancedPlanes.globalScale = scale;
    }
  }

  getProgress() {
    return this.progress;
  }
}
