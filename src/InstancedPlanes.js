import * as THREE from 'three';

export class InstancedPlanes {
    constructor(maxCount = 35000, size = 100) {
        this.maxCount = maxCount;
        this.size = size;
        this.instancedMesh = null;
        this.activeCount = 0;
        this.createInstancedMesh();
    }

    createInstancedMesh() {
        // Create shared geometry
        const geometry = new THREE.PlaneGeometry(this.size, this.size);

        // Create shared material
        const textureLoader = new THREE.TextureLoader();
        const planeTexture = textureLoader.load('./src/assets/plane.png');
        const material = new THREE.MeshPhongMaterial({
            map: planeTexture,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5, // Discard pixels with alpha < 0.5
            depthWrite: false // Prevent z-fighting issues with transparency
        });

        // Create instanced mesh
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxCount);

        // Set initial transform for all instances (hidden by default)
        const matrix = new THREE.Matrix4();
        matrix.makeScale(0, 0, 0); // Hide initially

        for (let i = 0; i < this.maxCount; i++) {
            this.instancedMesh.setMatrixAt(i, matrix);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    setInstanceTransform(instanceId, position, rotation, scale = 1) {
        if (instanceId >= this.maxCount) return;

        const finalScale = scale * (this.globalScale || 1);
        const matrix = new THREE.Matrix4();
        matrix.compose(position, rotation, new THREE.Vector3(finalScale, finalScale, finalScale));
        this.instancedMesh.setMatrixAt(instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
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

        // Hide instances beyond active count
        for (let i = this.activeCount; i < this.maxCount; i++) {
            this.hideInstance(i);
        }
    }

    setGlobalScale(scale) {
        // We'll need to update this when instances are positioned
        this.globalScale = scale;
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
}