import * as THREE from "three";

export class MergedFlightPaths {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      color: 0xffffff, // Base color (will be overridden by vertex colors)
      transparent: true,
      opacity: 0.6,
      vertexColors: true, // Enable per-vertex coloring
    });
    this.mesh = null;
    this.positions = null;
    this.colors = null;
    this.maxFlights = 0;
    this.currentFlightCount = 0;
    this.pointsPerPath = 100; // Number of points per flight path
    this.curvesVisible = true; // Control whether to render curves
    this.needsPositionUpdate = false;
    this.needsColorUpdate = false;
  }

  initialize(maxFlights) {
    this.maxFlights = maxFlights;
    const totalPoints = maxFlights * (this.pointsPerPath + 1); // +1 for line breaks

    // Pre-allocate buffers for maximum capacity
    this.positions = new Float32Array(totalPoints * 3);
    this.colors = new Float32Array(totalPoints * 3);

    // Initialize with zeros (invisible lines)
    this.positions.fill(0);
    this.colors.fill(0);

    // Set up buffer attributes
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3)
    );

    // Create the line mesh
    this.mesh = new THREE.LineSegments(this.geometry, this.material);

    // Set initial draw range to 0 (no lines visible)
    this.geometry.setDrawRange(0, 0);
  }

  addFlightPath(flightIndex, curve, flightData) {
    if (flightIndex >= this.maxFlights) return;

    // Skip expensive path calculations if curves are not visible
    if (!this.curvesVisible) return;

    // Calculate offset in the buffer for this flight
    const pointOffset = flightIndex * (this.pointsPerPath + 1);
    const positionOffset = pointOffset * 3;
    const colorOffset = pointOffset * 3;

    // Get points along the curve
    const points = curve.getPoints(this.pointsPerPath);

    // Calculate color based on origin longitude (like flight-paths project)
    const originLng = flightData ? flightData.departure.lng : 0;
    const hue = ((originLng + 180) % 360) / 360; // Normalize longitude to 0-1 hue range
    const baseColor = new THREE.Color();

    // Add curve points to buffer
    for (let i = 0; i < points.length; i++) {
      const bufferIndex = positionOffset + i * 3;
      this.positions[bufferIndex] = points[i].x;
      this.positions[bufferIndex + 1] = points[i].y;
      this.positions[bufferIndex + 2] = points[i].z;

      // Create gradient effect along path (darker to brighter)
      const progress = i / (points.length - 1);
      const lightness = 0.3 + progress * 0.4; // 0.3 to 0.7 range
      baseColor.setHSL(hue, 1.0, lightness);

      // Set vertex color
      const colorIndex = colorOffset + i * 3;
      this.colors[colorIndex] = baseColor.r;
      this.colors[colorIndex + 1] = baseColor.g;
      this.colors[colorIndex + 2] = baseColor.b;
    }

    // Add a break point (duplicate last point to create line segment separation)
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      const breakIndex = positionOffset + this.pointsPerPath * 3;
      this.positions[breakIndex] = lastPoint.x;
      this.positions[breakIndex + 1] = lastPoint.y;
      this.positions[breakIndex + 2] = lastPoint.z;

      // Use same color as last point
      baseColor.setHSL(hue, 1.0, 0.7);
      const breakColorIndex = colorOffset + this.pointsPerPath * 3;
      this.colors[breakColorIndex] = baseColor.r;
      this.colors[breakColorIndex + 1] = baseColor.g;
      this.colors[breakColorIndex + 2] = baseColor.b;
    }

    // Mark attributes for update (batch these updates)
    this.needsPositionUpdate = true;
    this.needsColorUpdate = true;
  }

  setVisibleFlightCount(count) {
    this.currentFlightCount = Math.min(count, this.maxFlights);

    // Calculate how many vertices to draw (only if curves are visible)
    const visiblePoints = this.curvesVisible ? this.currentFlightCount * (this.pointsPerPath + 1) : 0;

    // Update draw range
    this.geometry.setDrawRange(0, visiblePoints);
  }

  setCurvesVisible(visible) {
    this.curvesVisible = visible;

    // Update draw range immediately
    const visiblePoints = this.curvesVisible ? this.currentFlightCount * (this.pointsPerPath + 1) : 0;
    this.geometry.setDrawRange(0, visiblePoints);
  }

  getCurvesVisible() {
    return this.curvesVisible;
  }

  hideFlightPath(flightIndex) {
    if (flightIndex >= this.maxFlights) return;

    // Set all positions for this flight to zero (effectively hiding it)
    const pointOffset = flightIndex * (this.pointsPerPath + 1);
    const positionOffset = pointOffset * 3;

    for (let i = 0; i < (this.pointsPerPath + 1) * 3; i++) {
      this.positions[positionOffset + i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  addToScene(scene) {
    if (this.mesh) {
      scene.add(this.mesh);
    }
  }

  removeFromScene(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
    }
  }

  setOpacity(opacity) {
    this.material.opacity = opacity;
  }

  setColor(color) {
    this.material.color.setHex(color);
  }

  getMesh() {
    return this.mesh;
  }

  // Apply batched updates to geometry attributes
  applyBatchedUpdates() {
    if (this.needsPositionUpdate) {
      this.geometry.attributes.position.needsUpdate = true;
      this.needsPositionUpdate = false;
    }
    if (this.needsColorUpdate) {
      this.geometry.attributes.color.needsUpdate = true;
      this.needsColorUpdate = false;
    }
  }
}
