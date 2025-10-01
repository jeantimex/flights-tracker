import * as THREE from "three";
import { Atmosphere } from "./Atmosphere.js";
import { latLngToVector3, getRandomPointOnSphere } from "./Utils.js";

export class Earth {
  constructor(radius = 3000, onTextureLoaded = null) {
    this.radius = radius;
    this.mesh = null;
    this.atmosphere = new Atmosphere(radius);
    this.onTextureLoaded = onTextureLoaded;
    this.createEarth();
  }

  createEarth() {
    const geometry = new THREE.SphereGeometry(this.radius, 64, 32); // Higher resolution for better texture quality

    // Load the world topology texture
    const textureLoader = new THREE.TextureLoader();
    const worldTexture = textureLoader.load(
      `${import.meta.env.BASE_URL}world.topo.jpg`,
      // onLoad callback
      () => {
        if (this.onTextureLoaded) {
          this.onTextureLoaded();
        }
      },
      // onProgress callback
      undefined,
      // onError callback
      (error) => {
        console.error('Error loading Earth texture:', error);
        if (this.onTextureLoaded) {
          this.onTextureLoaded();
        }
      }
    );

    // Configure texture properties for better quality
    worldTexture.wrapS = THREE.RepeatWrapping;
    worldTexture.wrapT = THREE.ClampToEdgeWrapping;
    worldTexture.minFilter = THREE.LinearFilter;
    worldTexture.magFilter = THREE.LinearFilter;
    worldTexture.flipY = true; // Flip texture vertically to correct orientation

    const material = new THREE.MeshPhongMaterial({
      map: worldTexture,
      shininess: 10,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0, 0);

    // Rotate the earth so that lat/lng (0,0) faces the camera
    // This puts the prime meridian and equator intersection at center
    this.mesh.rotation.y = -Math.PI / 2; // Rotate -90 degrees around Y-axis
  }

  addToScene(scene) {
    if (this.mesh) {
      scene.add(this.mesh);
      // console.log("Earth mesh added to scene");
    }
    if (this.atmosphere) {
      this.atmosphere.addToScene(scene);
    }
  }

  getRandomPointOnSurface() {
    return getRandomPointOnSphere(this.radius);
  }

  getRadius() {
    return this.radius;
  }

  latLngToVector3(lat, lng) {
    return latLngToVector3(lat, lng, this.radius);
  }
}
