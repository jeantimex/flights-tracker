import * as THREE from "three";
import { createSVGTexture } from "./Utils.js";

/**
 * GPU-accelerated instanced plane renderer
 * All animation calculations happen in the vertex shader for maximum performance
 */
export class GPUInstancedPlanes {
  constructor(maxCount = 35000, size = 100, earthRadius = 3000) {
    this.maxCount = maxCount;
    this.size = size;
    this.earthRadius = earthRadius;
    this.instancedMesh = null;
    this.activeCount = 0;
    this.planeTextures = [];
    this.isParticleRenderer = false;
    this.globalScale = 1.0;

    // Flight path data arrays (will be stored as vertex attributes)
    this.flightOrigins = new Float32Array(maxCount * 3);       // Origin positions
    this.flightDestinations = new Float32Array(maxCount * 3);  // Destination positions
    this.flightControlPoints = new Float32Array(maxCount * 12); // 4 control points × 3 coords
    this.flightDurations = new Float32Array(maxCount);         // Flight durations
    this.flightPhases = new Float32Array(maxCount);            // Phase offsets for variety
    this.planeTypes = new Float32Array(maxCount);             // Plane type for each instance

    // Colors for different plane types
    this.planeColors = [
      new THREE.Color(0xE8F5E9), // Green
      new THREE.Color(0xE1F5FE), // Blue
      new THREE.Color(0xEDE7F6), // Purple
      new THREE.Color(0xECEFF1), // Gray
      new THREE.Color(0xFFFDE7), // Yellow
      new THREE.Color(0xFFF3E0), // Orange
      new THREE.Color(0xFFEBEE), // Red
      new THREE.Color(0xFAFAFA)  // Light Gray
    ];

    this.createInstancedMesh();
  }

  createInstancedMesh() {
    // Create shared geometry
    const geometry = new THREE.PlaneGeometry(this.size, this.size);

    // Load all 8 plane textures
    for (let i = 1; i <= 8; i++) {
      const texture = createSVGTexture(`${import.meta.env.BASE_URL}plane${i}.svg`);
      this.planeTextures.push(texture);
    }

    // Create advanced shader material with GPU animation
    const material = new THREE.ShaderMaterial({
      uniforms: {
        planeTextures: { value: this.planeTextures },
        planeColors: { value: this.planeColors },
        time: { value: 0.0 },
        animationSpeed: { value: 1.0 },
        globalScale: { value: this.globalScale },
        earthRadius: { value: this.earthRadius },
        opacity: { value: 1.0 },
        useColorization: { value: 1.0 },
        waitTime: { value: 5.0 }, // Wait time at destination
        planeOffset: { value: 8.0 }, // Offset above flight path
        activeCount: { value: this.activeCount } // Number of active flights
      },
      vertexShader: `
        // Flight path attributes
        attribute vec3 flightOrigin;
        attribute vec3 flightDestination;
        attribute vec3 flightControlPoint1;
        attribute vec3 flightControlPoint2;
        attribute vec3 flightControlPoint3;
        attribute float flightDuration;
        attribute float flightPhase;
        attribute float planeType;

        // Uniforms
        uniform float time;
        uniform float animationSpeed;
        uniform float globalScale;
        uniform float earthRadius;
        uniform float waitTime;
        uniform float planeOffset;
        uniform float activeCount;

        // Varyings
        varying vec2 vUv;
        varying float vPlaneType;

        // Cubic Bézier curve evaluation
        vec3 evaluateBezier(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
          float invT = 1.0 - t;
          float invT2 = invT * invT;
          float invT3 = invT2 * invT;
          float t2 = t * t;
          float t3 = t2 * t;

          return invT3 * p0 +
                 3.0 * invT2 * t * p1 +
                 3.0 * invT * t2 * p2 +
                 t3 * p3;
        }

        // Get tangent vector for rotation
        vec3 getBezierTangent(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
          float invT = 1.0 - t;
          float invT2 = invT * invT;
          float t2 = t * t;

          return 3.0 * invT2 * (p1 - p0) +
                 6.0 * invT * t * (p2 - p1) +
                 3.0 * t2 * (p3 - p2);
        }

        // Create rotation matrix from direction vector
        mat4 lookAtMatrix(vec3 eye, vec3 target, vec3 up) {
          vec3 zAxis = normalize(target - eye);
          vec3 xAxis = normalize(cross(up, zAxis));
          vec3 yAxis = cross(zAxis, xAxis);

          return mat4(
            xAxis.x, yAxis.x, zAxis.x, 0.0,
            xAxis.y, yAxis.y, zAxis.y, 0.0,
            xAxis.z, yAxis.z, zAxis.z, 0.0,
            0.0, 0.0, 0.0, 1.0
          );
        }

        void main() {
          vUv = vec2(uv.x, 1.0 - uv.y);
          vPlaneType = planeType;

          // Hide planes beyond active count
          if (float(gl_InstanceID) >= activeCount) {
            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }

          // Calculate animation progress with phase offset
          float animTime = (time * animationSpeed) + flightPhase;
          float totalCycleTime = flightDuration + waitTime;
          float normalizedTime = mod(animTime, totalCycleTime);

          vec3 currentPosition;
          vec3 tangent;

          if (normalizedTime < flightDuration) {
            // Flying phase - interpolate along Bézier curve
            float t = normalizedTime / flightDuration;

            // Construct Bézier curve control points
            vec3 p0 = flightOrigin;
            vec3 p1 = flightControlPoint1.xyz;
            vec3 p2 = flightControlPoint2.xyz;
            vec3 p3 = flightDestination;

            // Get position and tangent from curve
            currentPosition = evaluateBezier(p0, p1, p2, p3, t);
            tangent = normalize(getBezierTangent(p0, p1, p2, p3, t));
          } else {
            // Waiting phase - stay at destination
            currentPosition = flightDestination;
            tangent = normalize(flightDestination - flightOrigin);
          }

          // Lift plane above path
          vec3 normal = normalize(currentPosition);
          currentPosition += normal * planeOffset;

          // Calculate rotation matrix
          vec3 up = cross(normal, tangent);
          up = normalize(up);
          mat4 rotationMatrix = lookAtMatrix(vec3(0.0), tangent, up);

          // Apply additional rotation for proper plane orientation
          float additionalRot = radians(-90.0);
          mat4 additionalRotation = mat4(
            cos(additionalRot), -sin(additionalRot), 0.0, 0.0,
            sin(additionalRot), cos(additionalRot), 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
          );
          rotationMatrix = rotationMatrix * additionalRotation;

          // Apply scaling
          vec3 scaledPosition = position * globalScale;

          // Transform vertex
          vec4 worldPosition = vec4(currentPosition, 1.0) +
                              rotationMatrix * vec4(scaledPosition, 0.0);

          gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D planeTextures[8];
        uniform vec3 planeColors[8];
        uniform float opacity;
        uniform float useColorization;

        varying vec2 vUv;
        varying float vPlaneType;

        void main() {
          int textureIndex = int(vPlaneType);
          vec4 texColor;
          vec3 planeColor;

          // Sample from the correct texture and color based on plane type
          if (textureIndex == 0) {
            texColor = texture2D(planeTextures[0], vUv);
            planeColor = planeColors[0];
          }
          else if (textureIndex == 1) {
            texColor = texture2D(planeTextures[1], vUv);
            planeColor = planeColors[1];
          }
          else if (textureIndex == 2) {
            texColor = texture2D(planeTextures[2], vUv);
            planeColor = planeColors[2];
          }
          else if (textureIndex == 3) {
            texColor = texture2D(planeTextures[3], vUv);
            planeColor = planeColors[3];
          }
          else if (textureIndex == 4) {
            texColor = texture2D(planeTextures[4], vUv);
            planeColor = planeColors[4];
          }
          else if (textureIndex == 5) {
            texColor = texture2D(planeTextures[5], vUv);
            planeColor = planeColors[5];
          }
          else if (textureIndex == 6) {
            texColor = texture2D(planeTextures[6], vUv);
            planeColor = planeColors[6];
          }
          else {
            texColor = texture2D(planeTextures[7], vUv);
            planeColor = planeColors[7];
          }

          // Mix between plane-specific color and white based on useColorization
          vec3 finalColor = mix(vec3(1.0, 1.0, 1.0), planeColor, useColorization);

          // Use only the alpha channel from texture, apply final color
          gl_FragColor = vec4(finalColor, texColor.a * opacity);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.maxCount
    );

    // Add flight path attributes
    geometry.setAttribute(
      'flightOrigin',
      new THREE.InstancedBufferAttribute(this.flightOrigins, 3)
    );
    geometry.setAttribute(
      'flightDestination',
      new THREE.InstancedBufferAttribute(this.flightDestinations, 3)
    );
    // Create separate arrays for each control point
    this.controlPoint1 = new Float32Array(this.maxCount * 3);
    this.controlPoint2 = new Float32Array(this.maxCount * 3);
    this.controlPoint3 = new Float32Array(this.maxCount * 3);

    geometry.setAttribute(
      'flightControlPoint1',
      new THREE.InstancedBufferAttribute(this.controlPoint1, 3)
    );
    geometry.setAttribute(
      'flightControlPoint2',
      new THREE.InstancedBufferAttribute(this.controlPoint2, 3)
    );
    geometry.setAttribute(
      'flightControlPoint3',
      new THREE.InstancedBufferAttribute(this.controlPoint3, 3)
    );
    geometry.setAttribute(
      'flightDuration',
      new THREE.InstancedBufferAttribute(this.flightDurations, 1)
    );
    geometry.setAttribute(
      'flightPhase',
      new THREE.InstancedBufferAttribute(this.flightPhases, 1)
    );
    geometry.setAttribute(
      'planeType',
      new THREE.InstancedBufferAttribute(this.planeTypes, 1)
    );

    // Initialize all instances as inactive (will be set by flight data)
    this.initializeInstances();
  }

  initializeInstances() {
    // Set default values for all instances
    for (let i = 0; i < this.maxCount; i++) {
      // Set to origin initially (inactive)
      this.flightOrigins[i * 3] = 0;
      this.flightOrigins[i * 3 + 1] = 0;
      this.flightOrigins[i * 3 + 2] = 0;

      this.flightDestinations[i * 3] = 0;
      this.flightDestinations[i * 3 + 1] = 0;
      this.flightDestinations[i * 3 + 2] = 0;

      // Control points (will create a straight line initially)
      for (let j = 0; j < 12; j++) {
        this.flightControlPoints[i * 12 + j] = 0;
      }

      this.flightDurations[i] = 1.0;
      this.flightPhases[i] = Math.random() * 10.0; // Random start phase
      this.planeTypes[i] = Math.floor(Math.random() * 8);
    }

    this.markAttributesNeedUpdate();
  }

  // Set flight path data for a specific instance
  setFlightPath(instanceId, origin, destination, controlPoints, duration) {
    if (instanceId >= this.maxCount) return;

    // Set origin
    this.flightOrigins[instanceId * 3] = origin.x;
    this.flightOrigins[instanceId * 3 + 1] = origin.y;
    this.flightOrigins[instanceId * 3 + 2] = origin.z;

    // Set destination
    this.flightDestinations[instanceId * 3] = destination.x;
    this.flightDestinations[instanceId * 3 + 1] = destination.y;
    this.flightDestinations[instanceId * 3 + 2] = destination.z;

    // Set control points (separate arrays for each control point)
    if (controlPoints.length >= 4) {
      // Control point 1
      this.controlPoint1[instanceId * 3] = controlPoints[1].x;
      this.controlPoint1[instanceId * 3 + 1] = controlPoints[1].y;
      this.controlPoint1[instanceId * 3 + 2] = controlPoints[1].z;

      // Control point 2
      this.controlPoint2[instanceId * 3] = controlPoints[2].x;
      this.controlPoint2[instanceId * 3 + 1] = controlPoints[2].y;
      this.controlPoint2[instanceId * 3 + 2] = controlPoints[2].z;

      // Control point 3 (not used in 4-point Bézier, but included for completeness)
      this.controlPoint3[instanceId * 3] = controlPoints[3].x;
      this.controlPoint3[instanceId * 3 + 1] = controlPoints[3].y;
      this.controlPoint3[instanceId * 3 + 2] = controlPoints[3].z;
    }

    // Set duration and plane type
    this.flightDurations[instanceId] = duration;
    this.planeTypes[instanceId] = instanceId % 8;
  }

  // Update animation time (called every frame)
  update(deltaTime) {
    if (!this.instancedMesh || !this.instancedMesh.material) return;

    // Update time uniform to drive GPU animation
    this.instancedMesh.material.uniforms.time.value += deltaTime;
  }

  setActiveCount(count) {
    this.activeCount = Math.min(count, this.maxCount);

    // Update the activeCount uniform to control visibility in GPU shader
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.activeCount.value = this.activeCount;
    }
  }

  setGlobalScale(scale) {
    this.globalScale = scale;
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.globalScale.value = scale;
    }
  }

  setAnimationSpeed(speed) {
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.animationSpeed.value = speed;
    }
  }

  setColorization(enabled) {
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.useColorization.value = enabled ? 1.0 : 0.0;
    }
  }

  setOpacity(opacity) {
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.opacity.value = opacity;
    }
  }

  markAttributesNeedUpdate() {
    if (!this.instancedMesh) return;

    const geometry = this.instancedMesh.geometry;
    if (geometry.attributes.flightOrigin) geometry.attributes.flightOrigin.needsUpdate = true;
    if (geometry.attributes.flightDestination) geometry.attributes.flightDestination.needsUpdate = true;
    if (geometry.attributes.flightControlPoint1) geometry.attributes.flightControlPoint1.needsUpdate = true;
    if (geometry.attributes.flightControlPoint2) geometry.attributes.flightControlPoint2.needsUpdate = true;
    if (geometry.attributes.flightControlPoint3) geometry.attributes.flightControlPoint3.needsUpdate = true;
    if (geometry.attributes.flightDuration) geometry.attributes.flightDuration.needsUpdate = true;
    if (geometry.attributes.flightPhase) geometry.attributes.flightPhase.needsUpdate = true;
    if (geometry.attributes.planeType) geometry.attributes.planeType.needsUpdate = true;
  }

  addToScene(scene) {
    if (this.instancedMesh) {
      scene.add(this.instancedMesh);
    }
  }

  removeFromScene(scene) {
    if (this.instancedMesh) {
      scene.remove(this.instancedMesh);
    }
  }

  getMesh() {
    return this.instancedMesh;
  }

  // Compatibility methods (GPU version doesn't need these)
  setInstanceTransform() {
    // No-op: GPU handles all transformations
  }

  hideInstance() {
    // No-op: GPU handles visibility
  }

  forceMatrixUpdate() {
    // No-op: GPU handles all matrix calculations
  }
}