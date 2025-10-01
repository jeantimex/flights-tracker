import * as THREE from "three";
import { createSVGTexture } from "./Utils.js";

export class InstancedPlanes {
  constructor(maxCount = 35000, size = 100) {
    this.maxCount = maxCount;
    this.size = size;
    this.instancedMesh = null;
    this.activeCount = 0;
    this.planeTextures = [];
    this.isParticleRenderer = false; // Add identifier for reliable type checking
    this.planeTypes = new Float32Array(maxCount); // Store plane type for each instance
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

    // Create shared material with custom shader
    const textureLoader = new THREE.TextureLoader();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        planeTextures: { value: this.planeTextures },
        planeColors: { value: this.planeColors },
        opacity: { value: 1.0 },
        useColorization: { value: 1.0 }, // 1.0 = use colors, 0.0 = use white
      },
      vertexShader: `
                attribute float planeType;
                varying vec2 vUv;
                varying float vPlaneType;
                void main() {
                    vUv = vec2(uv.x, 1.0 - uv.y);
                    vPlaneType = planeType;
                    vec3 transformed = position;
                    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
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

    // Add plane type attribute for instanced rendering
    geometry.setAttribute(
      'planeType',
      new THREE.InstancedBufferAttribute(this.planeTypes, 1)
    );

    // Set initial transform for all instances (hidden by default)
    const matrix = new THREE.Matrix4();
    matrix.makeScale(0, 0, 0); // Hide initially

    for (let i = 0; i < this.maxCount; i++) {
      this.instancedMesh.setMatrixAt(i, matrix);
      // Set random plane type for each instance
      this.planeTypes[i] = Math.floor(Math.random() * 8);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    geometry.attributes.planeType.needsUpdate = true;
  }

  setInstanceTransform(instanceId, position, rotation, scale = 1, planeType = null, triggerUpdate = true) {
    if (instanceId >= this.maxCount) return;

    // Skip expensive operations if mesh is not visible
    if (!this.instancedMesh || !this.instancedMesh.visible) return;

    const finalScale = scale * (this.globalScale || 1);
    const matrix = new THREE.Matrix4();
    matrix.compose(
      position,
      rotation,
      new THREE.Vector3(finalScale, finalScale, finalScale)
    );
    this.instancedMesh.setMatrixAt(instanceId, matrix);

    // Only trigger update if explicitly requested (for batching)
    if (triggerUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // Set plane type if specified, otherwise use random
    if (planeType !== null) {
      this.planeTypes[instanceId] = Math.max(0, Math.min(7, planeType));
      if (triggerUpdate) {
        this.instancedMesh.geometry.attributes.planeType.needsUpdate = true;
      }
    }
  }

  hideInstance(instanceId) {
    if (instanceId >= this.maxCount) return;

    const matrix = new THREE.Matrix4();
    matrix.makeScale(0, 0, 0); // Hide by scaling to zero
    this.instancedMesh.setMatrixAt(instanceId, matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  setActiveCount(count) {
    this.activeCount = Math.min(count, this.maxCount);

    // Skip processing if mesh is not visible for performance
    if (!this.instancedMesh || !this.instancedMesh.visible) return;

    // Hide instances beyond active count and randomize plane types for active ones
    for (let i = 0; i < this.maxCount; i++) {
      if (i >= this.activeCount) {
        this.hideInstance(i);
      } else {
        // Randomize plane type for active instances
        this.planeTypes[i] = Math.floor(Math.random() * 8);
      }
    }

    if (this.instancedMesh && this.instancedMesh.geometry.attributes.planeType) {
      this.instancedMesh.geometry.attributes.planeType.needsUpdate = true;
    }
  }

  setPlaneType(instanceId, planeType) {
    if (instanceId >= this.maxCount) return;

    this.planeTypes[instanceId] = Math.max(0, Math.min(7, planeType));
    if (this.instancedMesh && this.instancedMesh.geometry.attributes.planeType) {
      this.instancedMesh.geometry.attributes.planeType.needsUpdate = true;
    }
  }

  setGlobalScale(scale) {
    // We'll need to update this when instances are positioned
    this.globalScale = scale;
  }


  setOpacity(opacity) {
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.opacity.value = opacity;
    }
  }

  setColorization(enabled) {
    if (this.instancedMesh && this.instancedMesh.material.uniforms) {
      this.instancedMesh.material.uniforms.useColorization.value = enabled ? 1.0 : 0.0;
    }
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

  // Force update of instance matrices (for batched updates)
  forceMatrixUpdate() {
    if (this.instancedMesh) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Force update of plane type attributes (for batched updates)
  forcePlaneTypeUpdate() {
    if (this.instancedMesh && this.instancedMesh.geometry.attributes.planeType) {
      this.instancedMesh.geometry.attributes.planeType.needsUpdate = true;
    }
  }
}
