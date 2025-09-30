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
