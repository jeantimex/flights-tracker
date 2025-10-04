import * as THREE from "three";
import { createSVGTexture } from "./Utils.js";

/**
 * GPU-accelerated instanced plane renderer
 * All animation calculations happen in the vertex shader for maximum performance
 */
export class GPUInstancedPlanes {
  constructor(maxCount = 35000, size = 1000, earthRadius = 3000) {
    this.maxCount = maxCount;
    this.size = size;
    this.earthRadius = earthRadius;
    this.instancedMesh = null;
    this.activeCount = 0;
    this.planeTextures = [];
    this.isParticleRenderer = false;
    this.globalScale = 1.0;

    // Flight path data arrays (will be stored as vertex attributes)
    // Pack 7 control points into 3 vec4 attributes (21 floats = 5.25 vec4, rounded up to 6)
    this.flightControlPack1 = new Float32Array(maxCount * 4); // Points 0,1 (x,y,z of point 0, x of point 1)
    this.flightControlPack2 = new Float32Array(maxCount * 4); // Points 1,2 (y,z of point 1, x,y of point 2)
    this.flightControlPack3 = new Float32Array(maxCount * 4); // Points 2,3 (z of point 2, x,y,z of point 3)
    this.flightControlPack4 = new Float32Array(maxCount * 4); // Points 4,5 (x,y,z of point 4, x of point 5)
    this.flightControlPack5 = new Float32Array(maxCount * 4); // Points 5,6 (y,z of point 5, x,y of point 6)
    this.flightControlPack6 = new Float32Array(maxCount * 4); // Point 6 + metadata (z of point 6, duration, phase, planeType)
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
        // Packed flight path attributes - 7 control points packed into 6 vec4s
        attribute vec4 flightControlPack1; // (p0.x, p0.y, p0.z, p1.x)
        attribute vec4 flightControlPack2; // (p1.y, p1.z, p2.x, p2.y)
        attribute vec4 flightControlPack3; // (p2.z, p3.x, p3.y, p3.z)
        attribute vec4 flightControlPack4; // (p4.x, p4.y, p4.z, p5.x)
        attribute vec4 flightControlPack5; // (p5.y, p5.z, p6.x, p6.y)
        attribute vec4 flightControlPack6; // (p6.z, duration, phase, planeType)

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

        // CatmullRom curve evaluation
        vec3 evaluateCatmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
          float t2 = t * t;
          float t3 = t2 * t;

          return 0.5 * (
            (2.0 * p1) +
            (-p0 + p2) * t +
            (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
            (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
          );
        }

        // Get tangent vector for CatmullRom curve
        vec3 getCatmullRomTangent(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
          float t2 = t * t;

          return 0.5 * (
            (-p0 + p2) +
            2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t +
            3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t2
          );
        }

        // Unpack control points from packed attributes
        vec3 getControlPoint(int index) {
          if (index == 0) {
            return vec3(flightControlPack1.x, flightControlPack1.y, flightControlPack1.z);
          } else if (index == 1) {
            return vec3(flightControlPack1.w, flightControlPack2.x, flightControlPack2.y);
          } else if (index == 2) {
            return vec3(flightControlPack2.z, flightControlPack2.w, flightControlPack3.x);
          } else if (index == 3) {
            return vec3(flightControlPack3.y, flightControlPack3.z, flightControlPack3.w);
          } else if (index == 4) {
            return vec3(flightControlPack4.x, flightControlPack4.y, flightControlPack4.z);
          } else if (index == 5) {
            return vec3(flightControlPack4.w, flightControlPack5.x, flightControlPack5.y);
          } else {
            return vec3(flightControlPack5.z, flightControlPack5.w, flightControlPack6.x);
          }
        }

        // Evaluate position along the 7-point CatmullRom curve
        vec3 evaluateFlightPath(float t, out vec3 tangent) {
          // Convert global t (0-1) to segment and local t
          float scaledT = t * 4.0; // 4 segments between 7 points
          int segment = int(floor(scaledT));
          float localT = scaledT - float(segment);

          vec3 p0, p1, p2, p3;

          if (segment == 0) {
            p0 = getControlPoint(0);
            p1 = getControlPoint(1);
            p2 = getControlPoint(2);
            p3 = getControlPoint(3);
          } else if (segment == 1) {
            p0 = getControlPoint(1);
            p1 = getControlPoint(2);
            p2 = getControlPoint(3);
            p3 = getControlPoint(4);
          } else if (segment == 2) {
            p0 = getControlPoint(2);
            p1 = getControlPoint(3);
            p2 = getControlPoint(4);
            p3 = getControlPoint(5);
          } else {
            p0 = getControlPoint(3);
            p1 = getControlPoint(4);
            p2 = getControlPoint(5);
            p3 = getControlPoint(6);
          }

          tangent = normalize(getCatmullRomTangent(p0, p1, p2, p3, localT));
          return evaluateCatmullRom(p0, p1, p2, p3, localT);
        }

        // Create rotation matrix to align plane with flight direction
        mat4 createOrientationMatrix(vec3 forward, vec3 earthNormal) {
          // Normalize the forward direction (tangent to flight path)
          vec3 zAxis = normalize(forward);

          // Calculate right vector (perpendicular to both forward and earth normal)
          vec3 xAxis = normalize(cross(earthNormal, zAxis));

          // Calculate up vector (perpendicular to forward and right)
          vec3 yAxis = normalize(cross(zAxis, xAxis));

          return mat4(
            xAxis.x, yAxis.x, zAxis.x, 0.0,
            xAxis.y, yAxis.y, zAxis.y, 0.0,
            xAxis.z, yAxis.z, zAxis.z, 0.0,
            0.0, 0.0, 0.0, 1.0
          );
        }

        void main() {
          vUv = vec2(uv.x, 1.0 - uv.y);
          vPlaneType = flightControlPack6.w;

          // Hide planes beyond active count
          if (float(gl_InstanceID) >= activeCount) {
            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
            return;
          }

          // Extract duration and phase from packed attributes
          float flightDuration = flightControlPack6.y;
          float flightPhase = flightControlPack6.z;

          // Calculate animation progress with phase offset
          float animTime = (time * animationSpeed) + flightPhase;
          float totalCycleTime = (flightDuration * 2.0) + waitTime; // Double duration for round trip
          float normalizedTime = mod(animTime, totalCycleTime);

          vec3 currentPosition;
          vec3 tangent;

          if (normalizedTime < flightDuration) {
            // Forward journey - interpolate along CatmullRom curve
            float t = normalizedTime / flightDuration;
            currentPosition = evaluateFlightPath(t, tangent);
          } else if (normalizedTime < (flightDuration * 2.0)) {
            // Return journey - interpolate along reversed curve
            float t = (normalizedTime - flightDuration) / flightDuration;
            float reverseT = 1.0 - t; // Reverse the parameter
            currentPosition = evaluateFlightPath(reverseT, tangent);
            tangent = -tangent; // Reverse direction for return journey
          } else {
            // Waiting phase - stay at origin before next cycle
            currentPosition = getControlPoint(0);
            tangent = normalize(getControlPoint(6) - getControlPoint(0));
          }

          // Calculate earth normal at current position
          vec3 earthNormal = normalize(currentPosition);

          // Lift plane to proper altitude above earth surface
          float altitude = length(currentPosition) - earthRadius;
          float minAltitude = 50.0; // Minimum altitude above earth surface
          if (altitude < minAltitude) {
            currentPosition = normalize(currentPosition) * (earthRadius + minAltitude);
          }

          // Create proper orientation matrix using flight direction and earth normal
          mat4 rotationMatrix = createOrientationMatrix(tangent, earthNormal);

          // Apply 90-degree rotation to align plane model properly
          // (assuming plane model points forward along +Z axis initially)
          mat4 modelAlignment = mat4(
            1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 1.0
          );
          rotationMatrix = rotationMatrix * modelAlignment;

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

    // Add packed flight path attributes
    geometry.setAttribute(
      'flightControlPack1',
      new THREE.InstancedBufferAttribute(this.flightControlPack1, 4)
    );
    geometry.setAttribute(
      'flightControlPack2',
      new THREE.InstancedBufferAttribute(this.flightControlPack2, 4)
    );
    geometry.setAttribute(
      'flightControlPack3',
      new THREE.InstancedBufferAttribute(this.flightControlPack3, 4)
    );
    geometry.setAttribute(
      'flightControlPack4',
      new THREE.InstancedBufferAttribute(this.flightControlPack4, 4)
    );
    geometry.setAttribute(
      'flightControlPack5',
      new THREE.InstancedBufferAttribute(this.flightControlPack5, 4)
    );
    geometry.setAttribute(
      'flightControlPack6',
      new THREE.InstancedBufferAttribute(this.flightControlPack6, 4)
    );
    // Note: flightDuration, flightPhase, and planeType are now packed into flightControlPack6

    // Initialize all instances as inactive (will be set by flight data)
    this.initializeInstances();
  }

  initializeInstances() {
    // Set default values for all instances
    for (let i = 0; i < this.maxCount; i++) {
      // Initialize all packed attributes to zero
      this.flightControlPack1[i * 4] = 0; // p0.x
      this.flightControlPack1[i * 4 + 1] = 0; // p0.y
      this.flightControlPack1[i * 4 + 2] = 0; // p0.z
      this.flightControlPack1[i * 4 + 3] = 0; // p1.x

      this.flightControlPack2[i * 4] = 0; // p1.y
      this.flightControlPack2[i * 4 + 1] = 0; // p1.z
      this.flightControlPack2[i * 4 + 2] = 0; // p2.x
      this.flightControlPack2[i * 4 + 3] = 0; // p2.y

      this.flightControlPack3[i * 4] = 0; // p2.z
      this.flightControlPack3[i * 4 + 1] = 0; // p3.x
      this.flightControlPack3[i * 4 + 2] = 0; // p3.y
      this.flightControlPack3[i * 4 + 3] = 0; // p3.z

      this.flightControlPack4[i * 4] = 0; // p4.x
      this.flightControlPack4[i * 4 + 1] = 0; // p4.y
      this.flightControlPack4[i * 4 + 2] = 0; // p4.z
      this.flightControlPack4[i * 4 + 3] = 0; // p5.x

      this.flightControlPack5[i * 4] = 0; // p5.y
      this.flightControlPack5[i * 4 + 1] = 0; // p5.z
      this.flightControlPack5[i * 4 + 2] = 0; // p6.x
      this.flightControlPack5[i * 4 + 3] = 0; // p6.y

      this.flightControlPack6[i * 4] = 0; // p6.z
      this.flightControlPack6[i * 4 + 1] = 1.0; // duration
      this.flightControlPack6[i * 4 + 2] = Math.random() * 10.0; // phase
      this.flightControlPack6[i * 4 + 3] = Math.floor(Math.random() * 8); // planeType
    }

    this.markAttributesNeedUpdate();
  }

  // Set flight path data for a specific instance
  setFlightPath(instanceId, origin, destination, curve, duration) {
    if (instanceId >= this.maxCount) return;

    // Get 7 evenly spaced points along the curve
    const points = [];
    for (let i = 0; i < 7; i++) {
      const t = i / 6; // 0, 1/6, 2/6, ..., 6/6 = 1
      points.push(curve.getPoint(t));
    }

    // Pack points into the vec4 attributes
    // Pack 1: (p0.x, p0.y, p0.z, p1.x)
    this.flightControlPack1[instanceId * 4] = points[0].x;
    this.flightControlPack1[instanceId * 4 + 1] = points[0].y;
    this.flightControlPack1[instanceId * 4 + 2] = points[0].z;
    this.flightControlPack1[instanceId * 4 + 3] = points[1].x;

    // Pack 2: (p1.y, p1.z, p2.x, p2.y)
    this.flightControlPack2[instanceId * 4] = points[1].y;
    this.flightControlPack2[instanceId * 4 + 1] = points[1].z;
    this.flightControlPack2[instanceId * 4 + 2] = points[2].x;
    this.flightControlPack2[instanceId * 4 + 3] = points[2].y;

    // Pack 3: (p2.z, p3.x, p3.y, p3.z)
    this.flightControlPack3[instanceId * 4] = points[2].z;
    this.flightControlPack3[instanceId * 4 + 1] = points[3].x;
    this.flightControlPack3[instanceId * 4 + 2] = points[3].y;
    this.flightControlPack3[instanceId * 4 + 3] = points[3].z;

    // Pack 4: (p4.x, p4.y, p4.z, p5.x)
    this.flightControlPack4[instanceId * 4] = points[4].x;
    this.flightControlPack4[instanceId * 4 + 1] = points[4].y;
    this.flightControlPack4[instanceId * 4 + 2] = points[4].z;
    this.flightControlPack4[instanceId * 4 + 3] = points[5].x;

    // Pack 5: (p5.y, p5.z, p6.x, p6.y)
    this.flightControlPack5[instanceId * 4] = points[5].y;
    this.flightControlPack5[instanceId * 4 + 1] = points[5].z;
    this.flightControlPack5[instanceId * 4 + 2] = points[6].x;
    this.flightControlPack5[instanceId * 4 + 3] = points[6].y;

    // Pack 6: (p6.z, duration, phase, planeType)
    this.flightControlPack6[instanceId * 4] = points[6].z;
    this.flightControlPack6[instanceId * 4 + 1] = duration;
    this.flightControlPack6[instanceId * 4 + 2] = Math.random() * 10.0; // phase
    this.flightControlPack6[instanceId * 4 + 3] = instanceId % 8; // planeType
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
    if (geometry.attributes.flightControlPack1) geometry.attributes.flightControlPack1.needsUpdate = true;
    if (geometry.attributes.flightControlPack2) geometry.attributes.flightControlPack2.needsUpdate = true;
    if (geometry.attributes.flightControlPack3) geometry.attributes.flightControlPack3.needsUpdate = true;
    if (geometry.attributes.flightControlPack4) geometry.attributes.flightControlPack4.needsUpdate = true;
    if (geometry.attributes.flightControlPack5) geometry.attributes.flightControlPack5.needsUpdate = true;
    if (geometry.attributes.flightControlPack6) geometry.attributes.flightControlPack6.needsUpdate = true;
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