import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class GLBPlanes {
  constructor(maxCount = 35000, size = 100) {
    this.maxCount = Math.min(maxCount, 1000); // Limit max count for performance
    this.size = size;
    this.activeCount = 0;
    this.globalScale = 1.0;
    this.instancedMesh = null;
    this.gltfModel = null;
    this.optimizedGeometry = null;
    this.optimizedMaterial = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadingCallbacks = [];
    this.isParticleRenderer = false;
    this.frustumCulled = true;
    this.lastCameraPosition = new THREE.Vector3();
    this.cullingUpdateFrame = 0;

    // GLB plane colors similar to InstancedPlanes
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
  }

  async loadGLBModel() {
    if (this.isLoaded || this.isLoading) {
      return new Promise((resolve) => {
        if (this.isLoaded) {
          resolve();
        } else {
          this.loadingCallbacks.push(resolve);
        }
      });
    }

    this.isLoading = true;
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        `${import.meta.env.BASE_URL}plane.glb`,
        (gltf) => {
          this.gltfModel = gltf.scene;

          // Scale down the model by 5000x (1000x previous + 5x additional)
          this.gltfModel.scale.setScalar(0.0002);

          // Fix orientation - flip the model if it's upside down
          this.gltfModel.rotation.x = Math.PI; // Flip 180 degrees around X-axis

          // Optimize the model for instancing
          this.optimizeModel();
          this.createInstancedMesh();
          this.isLoaded = true;
          this.isLoading = false;

          // Resolve all pending callbacks
          this.loadingCallbacks.forEach(callback => callback());
          this.loadingCallbacks = [];

          resolve();
        },
        (progress) => {
          console.log('GLB loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Error loading GLB model:', error);
          this.isLoading = false;
          reject(error);
        }
      );
    });
  }

  optimizeModel() {
    if (!this.gltfModel) return;

    let bestGeometry = null;
    let bestMaterial = null;
    let maxVertices = 0;

    // Find the mesh with the most vertices (main plane body)
    this.gltfModel.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const vertexCount = child.geometry.attributes.position?.count || 0;
        if (vertexCount > maxVertices) {
          maxVertices = vertexCount;
          bestGeometry = child.geometry;
          bestMaterial = child.material;
        }
      }
    });

    if (bestGeometry) {
      // Clone and optimize geometry
      this.optimizedGeometry = bestGeometry.clone();

      // Simplify geometry for better performance
      this.simplifyGeometry(this.optimizedGeometry);

      // Optimize material
      this.optimizedMaterial = this.createOptimizedMaterial(bestMaterial);

      console.log(`GLB Optimization: Using geometry with ${maxVertices} vertices`);
    }
  }

  simplifyGeometry(geometry) {
    // Remove unnecessary attributes for instancing
    const keepAttributes = ['position', 'normal', 'uv'];
    const attributes = geometry.attributes;

    Object.keys(attributes).forEach(key => {
      if (!keepAttributes.includes(key)) {
        delete attributes[key];
      }
    });

    // Compute vertex normals if missing
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    // Compute bounding sphere for culling
    geometry.computeBoundingSphere();
  }

  createOptimizedMaterial(originalMaterial) {
    // Create a simple white material without lighting effects
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: false,
      side: THREE.FrontSide,
      // No lighting calculation needed with MeshBasicMaterial
    });

    // Don't use textures, keep it simple and white
    return material;
  }

  createInstancedMesh() {
    if (!this.optimizedGeometry || !this.optimizedMaterial) {
      console.error('No optimized geometry/material available');
      return;
    }

    const geometry = this.optimizedGeometry;
    const material = this.optimizedMaterial;

    // Create instanced mesh with performance optimizations
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.maxCount
    );

    // Enable frustum culling for better performance
    this.instancedMesh.frustumCulled = this.frustumCulled;

    // Add instance color attribute for colorization
    const colors = new Float32Array(this.maxCount * 3);
    for (let i = 0; i < this.maxCount; i++) {
      const colorIndex = Math.floor(Math.random() * this.planeColors.length);
      const color = this.planeColors[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));

    // Set initial transform for all instances (hidden by default)
    const matrix = new THREE.Matrix4();
    matrix.makeScale(0, 0, 0); // Hide initially

    for (let i = 0; i < this.maxCount; i++) {
      this.instancedMesh.setMatrixAt(i, matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;

    // Set count to 0 initially for better performance
    this.instancedMesh.count = 0;
  }

  setInstanceTransform(instanceId, position, rotation, scale = 1, planeType = null, triggerUpdate = true) {
    if (instanceId >= this.maxCount || !this.instancedMesh) return;

    // Skip expensive operations if mesh is not visible
    if (!this.instancedMesh.visible) return;

    const finalScale = scale * (this.globalScale || 1) * 0.0002; // Apply the 5000x scale reduction
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

    // Update instance color based on planeType
    if (planeType !== null && this.instancedMesh.geometry.attributes.instanceColor) {
      const colorIndex = Math.max(0, Math.min(7, planeType));
      const color = this.planeColors[colorIndex];
      const colors = this.instancedMesh.geometry.attributes.instanceColor.array;

      colors[instanceId * 3] = color.r;
      colors[instanceId * 3 + 1] = color.g;
      colors[instanceId * 3 + 2] = color.b;

      if (triggerUpdate) {
        this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
      }
    }
  }

  hideInstance(instanceId) {
    if (instanceId >= this.maxCount || !this.instancedMesh) return;

    const matrix = new THREE.Matrix4();
    matrix.makeScale(0, 0, 0); // Hide by scaling to zero
    this.instancedMesh.setMatrixAt(instanceId, matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  setActiveCount(count) {
    this.activeCount = Math.min(count, this.maxCount);

    if (!this.instancedMesh) return;

    // Update the instance count for better performance
    this.instancedMesh.count = this.activeCount;

    // Skip expensive operations if mesh is not visible
    if (!this.instancedMesh.visible) return;

    // Only process active instances
    for (let i = 0; i < this.activeCount; i++) {
      if (this.instancedMesh.geometry.attributes.instanceColor) {
        // Randomize color for active instances
        const colorIndex = Math.floor(Math.random() * this.planeColors.length);
        const color = this.planeColors[colorIndex];
        const colors = this.instancedMesh.geometry.attributes.instanceColor.array;

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    }

    if (this.instancedMesh.geometry.attributes.instanceColor) {
      this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
    }
  }

  setGlobalScale(scale) {
    this.globalScale = scale;
  }

  setOpacity(opacity) {
    if (this.instancedMesh && this.instancedMesh.material) {
      this.instancedMesh.material.transparent = opacity < 1.0;
      this.instancedMesh.material.opacity = opacity;
    }
  }

  setColorization(enabled) {
    if (this.instancedMesh && this.instancedMesh.material) {
      this.instancedMesh.material.vertexColors = enabled;
      this.instancedMesh.material.needsUpdate = true;
    }
  }

  setBrightness(intensity = 1.0) {
    if (this.instancedMesh && this.instancedMesh.material) {
      // For MeshBasicMaterial, just keep it white (no brightness adjustment needed)
      this.instancedMesh.material.color.setHex(0xffffff);
      this.instancedMesh.material.needsUpdate = true;
    }
  }

  async addToScene(scene) {
    // Load the model if not already loaded
    if (!this.isLoaded && !this.isLoading) {
      await this.loadGLBModel();
    } else if (this.isLoading) {
      // Wait for loading to complete
      await new Promise((resolve) => {
        this.loadingCallbacks.push(resolve);
      });
    }

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

  // Force update of instance colors (for batched updates)
  forceColorUpdate() {
    if (this.instancedMesh && this.instancedMesh.geometry.attributes.instanceColor) {
      this.instancedMesh.geometry.attributes.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      this.instancedMesh.material.dispose();
    }
    if (this.gltfModel) {
      this.gltfModel.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}