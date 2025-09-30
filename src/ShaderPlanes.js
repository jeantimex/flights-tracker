import * as THREE from 'three';

export class ShaderPlanes {
    constructor(maxCount = 35000, size = 100) {
        this.maxCount = maxCount;
        this.size = size;
        this.instancedMesh = null;
        this.activeCount = 0;
        this.globalScale = 1.0;
        this.createInstancedMesh();
    }

    createInstancedMesh() {
        // Create shared geometry
        const geometry = new THREE.PlaneGeometry(this.size, this.size);

        // Shader material for procedural plane drawing
        const material = new THREE.ShaderMaterial({
            uniforms: {
                planeColor: { value: new THREE.Color(0xffffff) },
                opacity: { value: 0.8 }
            },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 planeColor;
                uniform float opacity;
                varying vec2 vUv;

                // Simple airplane shape using signed distance field
                float planeSDF(vec2 p) {
                    // Center and normalize coordinates to [-1, 1]
                    p = (p - 0.5) * 2.0;

                    // Main body (fuselage) - elongated ellipse
                    float body = length(vec2(p.x * 3.0, p.y)) - 0.15;

                    // Wings (horizontal bar)
                    float wings = abs(p.y) - 0.08;
                    wings = max(wings, abs(p.x + 0.1) - 0.5);

                    // Tail (smaller horizontal bar at back)
                    vec2 tailPos = p - vec2(-0.6, 0.0);
                    float tail = abs(tailPos.y) - 0.05;
                    tail = max(tail, abs(tailPos.x) - 0.15);

                    // Vertical stabilizer
                    vec2 vstabPos = p - vec2(-0.7, 0.0);
                    float vstab = abs(vstabPos.x) - 0.03;
                    vstab = max(vstab, abs(vstabPos.y) - 0.12);

                    // Nose cone
                    vec2 nosePos = p - vec2(0.6, 0.0);
                    float nose = length(nosePos) - 0.08;

                    // Combine all parts
                    float plane = min(body, min(wings, min(tail, min(vstab, nose))));

                    return plane;
                }

                void main() {
                    // Get distance to airplane shape
                    float dist = planeSDF(vUv);

                    // Create smooth anti-aliased edges
                    float alpha = 1.0 - smoothstep(-0.01, 0.01, dist);

                    // Apply color and opacity
                    gl_FragColor = vec4(planeColor, alpha * opacity);

                    // Discard transparent pixels for performance
                    if (alpha < 0.1) discard;
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
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

        const finalScale = scale * this.globalScale;
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
        this.globalScale = scale;
    }

    setColor(color) {
        if (this.instancedMesh && this.instancedMesh.material.uniforms) {
            this.instancedMesh.material.uniforms.planeColor.value.setHex(color);
        }
    }

    setOpacity(opacity) {
        if (this.instancedMesh && this.instancedMesh.material.uniforms) {
            this.instancedMesh.material.uniforms.opacity.value = opacity;
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
}