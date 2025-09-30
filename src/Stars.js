import * as THREE from 'three';

export class Stars {
    constructor(starCount = 5000, minRadius = 50000, maxRadius = 100000) {
        this.starCount = starCount;
        this.minRadius = minRadius;
        this.maxRadius = maxRadius;
        this.mesh = null;
        this.material = null;
        this.time = 0;
        this.createStars();
    }

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(this.starCount * 3);
        const starOpacities = new Float32Array(this.starCount);

        for (let i = 0; i < this.starCount * 3; i += 3) {
            const radius = this.minRadius + Math.random() * (this.maxRadius - this.minRadius);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPositions[i + 2] = radius * Math.cos(phi);

            starOpacities[i / 3] = Math.random();
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starsGeometry.setAttribute('opacity', new THREE.BufferAttribute(starOpacities, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute float opacity;
                varying float vOpacity;

                void main() {
                    vOpacity = opacity;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 3.0;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                varying float vOpacity;

                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;

                    float twinkle = sin(time * vOpacity * 3.0 + vOpacity * 10.0) * 0.3 + 0.7;
                    float alpha = (1.0 - dist * 2.0) * twinkle;

                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.Points(starsGeometry, this.material);
    }

    addToScene(scene) {
        if (this.mesh) {
            scene.add(this.mesh);
            // console.log('Stars added to scene with', this.starCount, 'stars');
        }
    }

    update(deltaTime = 0.01) {
        this.time += deltaTime;
        if (this.material) {
            this.material.uniforms.time.value = this.time;
        }
    }

    dispose() {
        if (this.mesh && this.mesh.geometry) {
            this.mesh.geometry.dispose();
        }
        if (this.material) {
            this.material.dispose();
        }
    }
}