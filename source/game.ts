/**
 * Bunny Hop Game
 * Simple 3D platformer with custom physics
 */

import * as THREE from "three";
import { poki } from "./poki.ts";

export interface GameConfig {
  renderer: {
    antialias: boolean;
    alpha: boolean;
  };
  camera: {
    fov: number;
    near: number;
    far: number;
  };
}

interface Platform {
  mesh: THREE.Mesh;
  box: THREE.Box3;
}

export class Game {
  // Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Player
  private player: THREE.Mesh;
  private playerVelocity = new THREE.Vector3(0, 0, 0);
  private playerBox = new THREE.Box3();
  private isGrounded = false;

  // Platforms
  private platforms: Platform[] = [];

  // Physics constants
  private readonly GRAVITY = 30;
  private readonly MOVE_SPEED = 10;
  private readonly JUMP_FORCE = 12;

  // Controls
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  // Game state
  private isPlaying = false;
  private clock = new THREE.Clock();

  // Progress tracking
  private maxDistance = 0;
  private distanceUI!: HTMLElement;

  // Checkpoint for rewarded ads
  private isFalling = false;

  // Camera
  private cameraOffset = new THREE.Vector3(0, 5, 10);

  // Lights
  private sun!: THREE.DirectionalLight;

  constructor(
    _config: GameConfig,
    private container: HTMLElement
  ) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Create world
    this.player = this.createPlayer();
    this.createPlatforms();
    this.createLights();
    this.setupControls();
    this.createUI();

    // Events
    window.addEventListener("resize", this.onResize);
  }

  private createPlayer(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 3, 0);
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private createPlatforms(): void {
    // Starting platform (larger)
    this.addPlatform(0, 0, 0, 6, 1, 6, 0x4a9d4a);

    // Generate 100 platforms going forward (-Z direction)
    let currentZ = -6;
    let currentY = 0;
    let currentX = 0;

    for (let i = 0; i < 100; i++) {
      // Random gap between platforms (4-7 units - within jump range)
      const gap = 4 + Math.random() * 3;
      currentZ -= gap;

      // Random height change (-1 to +2 units)
      const heightChange = Math.random() * 3 - 1;
      currentY = Math.max(0, currentY + heightChange);

      // Slight X variation for more interesting path
      currentX += (Math.random() - 0.5) * 4;
      currentX = Math.max(-15, Math.min(15, currentX)); // Keep within bounds

      // Platform size varies slightly
      const size = 2 + Math.random() * 1.5;

      // Color gradient from green to blue as you progress
      const progress = i / 100;
      const color = new THREE.Color().setHSL(0.3 - progress * 0.2, 0.6, 0.4);

      this.addPlatform(currentX, currentY, currentZ, size, 0.5, size, color.getHex());
    }

    // Final platform (goal)
    this.addPlatform(currentX, currentY, currentZ - 8, 8, 1, 8, 0xffd700);
  }

  private addPlatform(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number
  ): void {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    this.platforms.push({ mesh, box });
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sun.position.set(10, 30, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 100;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  private createUI(): void {
    this.distanceUI = document.createElement("div");
    this.distanceUI.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      font-family: 'Arial', sans-serif;
      font-size: 24px;
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      z-index: 100;
    `;
    this.distanceUI.textContent = "Distance: 0m";
    document.body.appendChild(this.distanceUI);
  }

  private setupControls(): void {
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.keys.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.backward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = true;
          break;
        case "Space":
          this.keys.jump = true;
          break;
      }
    });

    window.addEventListener("keyup", (e) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.keys.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = false;
          break;
        case "Space":
          this.keys.jump = false;
          break;
      }
    });
  }

  public setMobileControls(dx: number, dy: number, jump: boolean): void {
    this.keys.forward = dy < -0.3;
    this.keys.backward = dy > 0.3;
    this.keys.left = dx < -0.3;
    this.keys.right = dx > 0.3;
    this.keys.jump = jump;
  }

  private update(delta: number): void {
    // --- Input ---
    const moveDir = new THREE.Vector3();

    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    if (moveDir.length() > 0) {
      moveDir.normalize();
    }

    // --- Horizontal movement ---
    this.playerVelocity.x = moveDir.x * this.MOVE_SPEED;
    this.playerVelocity.z = moveDir.z * this.MOVE_SPEED;

    // --- Gravity ---
    if (!this.isGrounded) {
      this.playerVelocity.y -= this.GRAVITY * delta;
    }

    // --- Jump ---
    if (this.keys.jump && this.isGrounded) {
      this.playerVelocity.y = this.JUMP_FORCE;
      this.isGrounded = false;
    }

    // --- Apply velocity ---
    const displacement = this.playerVelocity.clone().multiplyScalar(delta);
    this.player.position.add(displacement);

    // --- Collision detection ---
    this.updatePlayerBox();
    this.isGrounded = false;

    for (const platform of this.platforms) {
      if (this.playerBox.intersectsBox(platform.box)) {
        this.resolveCollision(platform.box);
      }
    }

    // --- Track distance ---
    const currentDistance = Math.max(0, -this.player.position.z);
    if (currentDistance > this.maxDistance) {
      this.maxDistance = currentDistance;
      this.distanceUI.textContent = `Distance: ${Math.floor(this.maxDistance)}m`;
    }

    // --- Fall reset with rewarded ad ---
    if (this.player.position.y < -20 && !this.isFalling) {
      this.isFalling = true;
      this.handleFall();
    }

    // --- Camera ---
    const targetCamPos = this.player.position.clone().add(this.cameraOffset);
    this.camera.position.lerp(targetCamPos, 0.1);
    this.camera.lookAt(this.player.position);

    // --- Update sun position to follow player ---
    this.sun.position.set(
      this.player.position.x + 20,
      this.player.position.y + 40,
      this.player.position.z + 20
    );
    this.sun.target.position.copy(this.player.position);

    // --- Render ---
    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayerBox(): void {
    const halfSize = 0.5;
    this.playerBox.min.set(
      this.player.position.x - halfSize,
      this.player.position.y - halfSize,
      this.player.position.z - halfSize
    );
    this.playerBox.max.set(
      this.player.position.x + halfSize,
      this.player.position.y + halfSize,
      this.player.position.z + halfSize
    );
  }

  private resolveCollision(platformBox: THREE.Box3): void {
    // Calculate overlap on each axis
    const overlapX = Math.min(
      this.playerBox.max.x - platformBox.min.x,
      platformBox.max.x - this.playerBox.min.x
    );
    const overlapY = Math.min(
      this.playerBox.max.y - platformBox.min.y,
      platformBox.max.y - this.playerBox.min.y
    );
    const overlapZ = Math.min(
      this.playerBox.max.z - platformBox.min.z,
      platformBox.max.z - this.playerBox.min.z
    );

    // Find smallest overlap axis
    if (overlapY <= overlapX && overlapY <= overlapZ) {
      // Vertical collision
      if (this.playerVelocity.y < 0) {
        // Landing on top
        this.player.position.y = platformBox.max.y + 0.5;
        this.playerVelocity.y = 0;
        this.isGrounded = true;
      } else if (this.playerVelocity.y > 0) {
        // Hitting bottom
        this.player.position.y = platformBox.min.y - 0.5;
        this.playerVelocity.y = 0;
      }
    } else if (overlapX <= overlapZ) {
      // X axis collision
      if (
        this.player.position.x >
        platformBox.min.x + (platformBox.max.x - platformBox.min.x) / 2
      ) {
        this.player.position.x = platformBox.max.x + 0.5;
      } else {
        this.player.position.x = platformBox.min.x - 0.5;
      }
      this.playerVelocity.x = 0;
    } else {
      // Z axis collision
      if (
        this.player.position.z >
        platformBox.min.z + (platformBox.max.z - platformBox.min.z) / 2
      ) {
        this.player.position.z = platformBox.max.z + 0.5;
      } else {
        this.player.position.z = platformBox.min.z - 0.5;
      }
      this.playerVelocity.z = 0;
    }

    this.updatePlayerBox();
  }

  private findNearestPlatform(): THREE.Vector3 {
    const playerPos = this.player.position;
    let nearestPlatform = this.platforms[0];
    let minDistance = Infinity;

    for (const platform of this.platforms) {
      const platformCenter = new THREE.Vector3();
      platform.box.getCenter(platformCenter);

      // Calculate horizontal distance (ignore Y for finding nearest)
      const dx = platformCenter.x - playerPos.x;
      const dz = platformCenter.z - playerPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPlatform = platform;
      }
    }

    // Return position on top of the platform
    const spawnPos = new THREE.Vector3();
    nearestPlatform.box.getCenter(spawnPos);
    spawnPos.y = nearestPlatform.box.max.y + 1;
    return spawnPos;
  }

  private async handleFall(): Promise<void> {
    this.stop();
    poki.gameplayStop();

    const nearestPlatform = this.findNearestPlatform();
    const distanceFromStart = Math.abs(nearestPlatform.z);

    // Only show rewarded ad if player made progress
    if (distanceFromStart > 10) {
      const watchAd = await this.showFallPrompt(distanceFromStart);

      if (watchAd) {
        const watched = await poki.rewardedBreak();
        if (watched) {
          // Respawn at nearest platform
          this.player.position.copy(nearestPlatform);
          this.playerVelocity.set(0, 0, 0);
          this.isFalling = false;
          this.start();
          poki.gameplayStart();
          return;
        }
      }
    }

    // Respawn at start
    this.player.position.set(0, 3, 0);
    this.playerVelocity.set(0, 0, 0);
    this.maxDistance = 0;
    this.distanceUI.textContent = "Distance: 0m";
    this.isFalling = false;
    this.start();
    poki.gameplayStart();
  }

  private showFallPrompt(distance: number): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        color: white;
        font-family: Arial, sans-serif;
      `;

      const title = document.createElement("h2");
      title.textContent = "You fell!";
      title.style.cssText = "font-size: 48px; margin-bottom: 10px;";

      const distanceText = document.createElement("p");
      distanceText.textContent = `You were at ${Math.floor(distance)}m`;
      distanceText.style.cssText = "font-size: 24px; margin-bottom: 30px; color: #aaa;";

      const watchBtn = document.createElement("button");
      watchBtn.textContent = "📺 Watch Ad to Continue";
      watchBtn.style.cssText = `
        padding: 20px 40px;
        font-size: 20px;
        font-weight: bold;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        margin-bottom: 15px;
      `;

      const skipBtn = document.createElement("button");
      skipBtn.textContent = "Restart from Beginning";
      skipBtn.style.cssText = `
        padding: 15px 30px;
        font-size: 16px;
        background: transparent;
        color: #888;
        border: 2px solid #888;
        border-radius: 10px;
        cursor: pointer;
      `;

      watchBtn.onclick = () => {
        overlay.remove();
        resolve(true);
      };

      skipBtn.onclick = () => {
        overlay.remove();
        resolve(false);
      };

      overlay.appendChild(title);
      overlay.appendChild(distanceText);
      overlay.appendChild(watchBtn);
      overlay.appendChild(skipBtn);
      document.body.appendChild(overlay);
    });
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  public start(): void {
    this.isPlaying = true;
    this.clock.start();
    this.animate();
  }

  public stop(): void {
    this.isPlaying = false;
  }

  private animate = (): void => {
    if (!this.isPlaying) return;
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.update(delta);
  };
}
