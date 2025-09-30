import * as THREE from "three";

/**
 * Utility functions for mathematical and geometric operations
 */

/**
 * Convert latitude/longitude coordinates to 3D Vector3 position
 * @param {number} lat - Latitude (-90 to +90, south to north)
 * @param {number} lng - Longitude (-180 to +180, west to east)
 * @param {number} radius - Sphere radius
 * @returns {THREE.Vector3} 3D position vector
 */
export function latLngToVector3(lat, lng, radius) {
  // Convert lat/lng to spherical coordinates
  const phi = ((90 - lat) * Math.PI) / 180; // Latitude: 0 at north pole, PI at south pole
  const theta = ((-lng + 180) * Math.PI) / 180; // Longitude: direct conversion

  // Standard spherical to cartesian conversion
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  // Apply coordinate system transformation to match our rotated globe:
  // - Globe is rotated -90° around Y-axis
  // - This means we need to rotate coordinates +90° to compensate
  // Rotation matrix for +90° around Y-axis: [cos(90) 0 sin(90); 0 1 0; -sin(90) 0 cos(90)]
  // Which simplifies to: [0 0 1; 0 1 0; -1 0 0]

  const rotatedX = z; // X becomes Z
  const rotatedY = y; // Y stays Y
  const rotatedZ = -x; // Z becomes -X

  return new THREE.Vector3(rotatedX, rotatedY, rotatedZ);
}

/**
 * Generate a random point on the surface of a sphere
 * @param {number} radius - Sphere radius
 * @returns {THREE.Vector3} Random 3D position on sphere surface
 */
export function getRandomPointOnSphere(radius) {
  const phi = Math.random() * Math.PI * 2;
  const theta = Math.random() * Math.PI;
  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create a Three.js texture from an SVG file
 * @param {string} svgPath - Path to the SVG file
 * @returns {THREE.CanvasTexture} Canvas texture containing the rendered SVG
 */
export function createSVGTexture(svgPath) {
  // Create a canvas to render the SVG
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 256;

  // Load and render SVG
  fetch(svgPath)
    .then(response => response.text())
    .then(svgText => {
      const img = new Image();
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        // Update texture
        texture.needsUpdate = true;
      };

      img.src = url;
    });

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  return texture;
}

/**
 * Calculate the sun's position based on current UTC time or simulated time
 * Returns the subsolar point (latitude/longitude where sun is directly overhead)
 * @param {number} simulatedTimeHours - Optional simulated time in UTC hours (0-24)
 * @returns {Object} Object with lat, lng properties
 */
export function getSunPosition(simulatedTimeHours = null) {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const utcDate = new Date(utc);

  // Calculate day of year
  const start = new Date(utcDate.getFullYear(), 0, 0);
  const diff = utcDate - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Solar declination (latitude where sun is directly overhead)
  // Approximation: varies from -23.45° to +23.45° throughout the year
  const declination = 23.45 * Math.sin(degreesToRadians((360 / 365) * (dayOfYear - 81)));

  // Use simulated time if provided, otherwise use current time
  let timeDecimal;
  if (simulatedTimeHours !== null) {
    timeDecimal = simulatedTimeHours;
  } else {
    const hours = utcDate.getUTCHours();
    const minutes = utcDate.getUTCMinutes();
    const seconds = utcDate.getUTCSeconds();
    timeDecimal = hours + minutes/60 + seconds/3600;
  }

  // Solar noon occurs at 12:00 UTC, so offset by 12 hours and convert to degrees
  const longitude = ((timeDecimal - 12) * 15) % 360;
  // Normalize to -180 to +180 range
  const normalizedLongitude = longitude > 180 ? longitude - 360 : longitude;

  return {
    lat: declination,
    lng: normalizedLongitude
  };
}

/**
 * Convert sun position to 3D vector for directional light
 * @param {number} radius - Earth radius
 * @param {number} simulatedTimeHours - Optional simulated time in UTC hours (0-24)
 * @returns {THREE.Vector3} Sun position vector
 */
export function getSunVector3(radius = 3000, simulatedTimeHours = null) {
  const sunPos = getSunPosition(simulatedTimeHours);
  const sunVector = latLngToVector3(sunPos.lat, sunPos.lng, radius * 3); // Place sun far from Earth
  return sunVector;
}

/**
 * Time utility functions
 */

/**
 * Get current Pacific time in decimal hours (0-24)
 * @returns {number} Current Pacific time in decimal hours
 */
export function getCurrentPacificTimeHours() {
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.getHours() + pacificTime.getMinutes() / 60;
}

/**
 * Convert decimal hours to HH:MM format
 * @param {number} hours - Decimal hours (0-24)
 * @returns {string} Time in HH:MM format
 */
export function hoursToTimeString(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to decimal hours
 * @param {string} timeString - Time in HH:MM format
 * @returns {number} Decimal hours
 */
export function timeStringToHours(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Convert UTC time to Pacific time display string
 * @param {number} utcHours - UTC time in decimal hours
 * @returns {string} Pacific time in HH:MM format
 */
export function utcToPacificTimeString(utcHours) {
  const utcDate = new Date();
  utcDate.setUTCHours(Math.floor(utcHours), (utcHours % 1) * 60, 0, 0);
  const pacificTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  const hours = pacificTime.getHours();
  const minutes = pacificTime.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert UTC decimal hours to Pacific decimal hours
 * @param {number} utcHours - UTC time in decimal hours
 * @returns {number} Pacific time in decimal hours
 */
export function utcToPacificHours(utcHours) {
  const utcDate = new Date();
  utcDate.setUTCHours(Math.floor(utcHours), (utcHours % 1) * 60, 0, 0);
  const pacificTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pacificTime.getHours() + pacificTime.getMinutes() / 60;
}

/**
 * Convert Pacific time to UTC for sun calculations
 * @param {number} pacificHours - Pacific time in decimal hours
 * @returns {number} UTC time in decimal hours
 */
export function pacificToUtcHours(pacificHours) {
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
