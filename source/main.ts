/**
 * Bunny Hop - Three.js Game
 * Entry point
 */

import * as THREE from "three";
import { poki } from "./poki.ts";

// Get game config from window
declare global {
  interface Window {
    config: {
      title: string;
      version: string;
      renderer: {
        antialias: boolean;
        alpha: boolean;
      };
      camera: {
        fov: number;
        near: number;
        far: number;
        position: { x: number; y: number; z: number };
      };
      poki: {
        enabled: boolean;
        debug: boolean;
      };
    };
  }
}

class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private isPlaying = false;

  constructor() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Create camera
    const config = window.config.camera;
    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      window.innerWidth / window.innerHeight,
      config.near,
      config.far
    );
    this.camera.position.set(config.position.x, config.position.y, config.position.z);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.config.renderer.antialias,
      alpha: window.config.renderer.alpha,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add renderer to DOM
    const container = document.getElementById("game-container");
    if (container) {
      container.appendChild(this.renderer.domElement);
    }

    // Create cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: false,
    });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    // Handle resize
    window.addEventListener("resize", () => this.onResize());

    // Handle click to start gameplay
    window.addEventListener("click", () => this.startGameplay(), { once: true });

    // Start animation
    this.animate();
  }

  startGameplay(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    console.log("[Game] Starting gameplay");
    poki.gameplayStart();
  }

  stopGameplay(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    console.log("[Game] Stopping gameplay");
    poki.gameplayStop();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Rotate cube
    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;

    this.renderer.render(this.scene, this.camera);
  };
}

// Initialize game when DOM is loaded
window.addEventListener("DOMContentLoaded", async () => {
  console.log("Starting Bunny Hop...");
  console.log("Config:", window.config);

  // Initialize Poki SDK
  if (window.config.poki.enabled) {
    await poki.init();
  }

  // Create game
  new Game();

  // Signal that loading is finished
  poki.gameLoadingFinished();

  console.log("[Game] Ready to play! Click to start.");
});
