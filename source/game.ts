/**
 * Bunny Hop Game
 * Simple 3D platformer with custom physics
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { poki } from "./poki.ts";
import { ScaleManager } from "./scale.ts";

export interface GameConfig {
  renderer: {
    antialias: boolean;
    alpha: boolean;
  };
  camera: {
    fov: number;
    near: number;
    far: number;
    landscape?: { distance: number; height: number };
    portrait?: { distance: number; height: number };
  };
  scale?: {
    landscape: { width: number; height: number };
    portrait: { width: number; height: number };
  };
  physics: {
    gravity: number;
    moveSpeed: number;
    turnSpeed: number;
    jumpForce: number;
    jumpCut: number;
  };
  platforms: {
    start: { width: number; height: number; depth: number };
    tutorial: { count: number; gap: number; size: number };
    main: { count: number };
  };
  recordLight: {
    intensity: number;
    distance: number;
    orbitRadius: number;
    orbitSpeed: number;
    sphereRadius: number;
  };
}

interface Platform {
  mesh: THREE.Mesh;
  box: THREE.Box3;
}

export class Game {
  // Config
  private config: GameConfig;

  // Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scaleManager: ScaleManager;

  // Player
  private player: THREE.Mesh;
  private playerVelocity = new THREE.Vector3(0, 0, 0);
  private playerBox = new THREE.Box3();
  private isGrounded = false;

  // Platforms
  private platforms: Platform[] = [];

  // Jump state
  private isJumping = false;

  // Player rotation
  private playerAngle = 0; // radians, 0 = forward (-Z)
  private hasStartedMoving = false;

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
  private isInputEnabled = false;
  private clock = new THREE.Clock();

  // Progress tracking
  private platformsReached = 0;
  private touchedPlatforms = new Set<THREE.Mesh>();
  private progressUI!: HTMLElement;

  // Checkpoint for rewarded ads
  private isFalling = false;

  // High score
  private readonly STORAGE_KEY = "bunny-hop-highscore";
  private highScore = 0;

  // Lights
  private sun!: THREE.DirectionalLight;
  private recordLight: THREE.PointLight | null = null;
  private recordLightMesh: THREE.Mesh | null = null;
  private recordLightAngle = 0;

  // Camera settings (updated based on orientation)
  private camDistance = 8;
  private camHeight = 5;
  private cameraConfig: {
    landscape: { distance: number; height: number };
    portrait: { distance: number; height: number };
  };

  constructor(
    config: GameConfig,
    private container: HTMLElement
  ) {
    this.config = config;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      window.innerWidth / window.innerHeight,
      config.camera.near,
      config.camera.far
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: config.renderer.antialias,
      alpha: config.renderer.alpha,
    });
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Scale manager
    this.scaleManager = new ScaleManager(this.renderer, this.camera, {
      landscape: config.scale?.landscape ?? { width: 1920, height: 1080 },
      portrait: config.scale?.portrait ?? { width: 1080, height: 1920 },
      mode: "FIT",
    });

    // Camera distance config (landscape is closer)
    this.cameraConfig = {
      landscape: config.camera.landscape ?? { distance: 4, height: 2.5 },
      portrait: config.camera.portrait ?? { distance: 8, height: 5 },
    };
    this.updateCameraDistance(this.scaleManager.isPortrait);

    // Listen for orientation changes
    this.scaleManager.onUpdate((state) => {
      this.updateCameraDistance(state.isPortrait);
    });

    // Post-processing (pixel effect)
    this.composer = new EffectComposer(this.renderer);
    const renderPixelatedPass = new RenderPixelatedPass(7, this.scene, this.camera);
    this.composer.addPass(renderPixelatedPass);
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // Connect composer to scale manager
    this.scaleManager.setComposer(this.composer);

    // Create world
    this.player = this.createPlayer();
    this.createPlatforms();
    this.createLights();
    this.setupControls();
    this.createUI();
    this.loadHighScore();
  }

  private createPlayer(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 3, -2);
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private createPlatforms(): void {
    const { start, tutorial, main } = this.config.platforms;

    // Starting platform - for player to get used to controls
    const startCenterZ = -start.depth / 2;
    this.addStartPlatform(0, 0, startCenterZ, start.width, start.height, start.depth);

    // Tutorial section: platforms at same height and distance
    let currentZ = -start.depth;

    for (let i = 0; i < tutorial.count; i++) {
      currentZ -= tutorial.gap;
      this.addPlatform(0, 0, currentZ, tutorial.size, 0.5, tutorial.size, 0x4a9d4a);
    }

    // Main game section: random platforms
    let currentY = 0;
    let currentX = 0;

    for (let i = 0; i < main.count; i++) {
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
      const progress = i / main.count;
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

  private addStartPlatform(x: number, y: number, z: number, w: number, h: number, d: number): void {
    // Create checkered texture
    const canvas = document.createElement("canvas");
    const size = 256;
    const squares = 8;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const squareSize = size / squares;
    for (let i = 0; i < squares; i++) {
      for (let j = 0; j < squares; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? "#ffffff" : "#222222";
        ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Scale texture to keep squares square (1 repeat per 6 units)
    texture.repeat.set(w / 6, d / 6);

    const geometry = new THREE.BoxGeometry(w, h, d);
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }), // right
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }), // left
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }), // top (checkered)
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }), // bottom
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }), // front
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }), // back
    ];

    const mesh = new THREE.Mesh(geometry, materials);
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
    this.progressUI = document.createElement("div");
    this.progressUI.style.cssText = `
      position: fixed;
      top: 3vmin;
      left: 3vmin;
      font-family: 'Arial', sans-serif;
      font-size: 4vmin;
      font-weight: bold;
      color: white;
      text-shadow: 0.3vmin 0.3vmin 0.6vmin rgba(0, 0, 0, 0.5);
      z-index: 100;
    `;
    this.progressUI.textContent = "Platforms: 0";
    document.body.appendChild(this.progressUI);
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

  public setMobileControls(dx: number, _dy: number, jump: boolean): void {
    // Only use horizontal axis for turning
    this.keys.left = dx < -0.2;
    this.keys.right = dx > 0.2;
    this.keys.jump = jump;
  }

  private update(delta: number): void {
    // --- Don't process input until enabled ---
    if (!this.isInputEnabled) {
      // Just render the scene
      this.composer.render();
      return;
    }

    // --- Check if player started moving ---
    if (!this.hasStartedMoving) {
      if (this.keys.left || this.keys.right || this.keys.jump) {
        this.hasStartedMoving = true;
      }
    }

    // --- Turning ---
    if (this.keys.left) this.playerAngle += this.config.physics.turnSpeed * delta;
    if (this.keys.right) this.playerAngle -= this.config.physics.turnSpeed * delta;

    // Update player visual rotation
    this.player.rotation.y = this.playerAngle;

    // --- Movement (only after started) ---
    if (this.hasStartedMoving) {
      const moveDir = new THREE.Vector3(
        -Math.sin(this.playerAngle),
        0,
        -Math.cos(this.playerAngle)
      );
      this.playerVelocity.x = moveDir.x * this.config.physics.moveSpeed;
      this.playerVelocity.z = moveDir.z * this.config.physics.moveSpeed;
    } else {
      this.playerVelocity.x = 0;
      this.playerVelocity.z = 0;
    }

    // --- Gravity ---
    if (!this.isGrounded) {
      this.playerVelocity.y -= this.config.physics.gravity * delta;
    }

    // --- Jump ---
    if (this.keys.jump && this.isGrounded) {
      this.playerVelocity.y = this.config.physics.jumpForce;
      this.isGrounded = false;
      this.isJumping = true;
    }

    // Variable jump height - cut velocity when button released early
    if (!this.keys.jump && this.isJumping && this.playerVelocity.y > 0) {
      this.playerVelocity.y *= this.config.physics.jumpCut;
      this.isJumping = false;
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
        // Track touched platforms
        if (!this.touchedPlatforms.has(platform.mesh)) {
          this.touchedPlatforms.add(platform.mesh);
          this.platformsReached = this.touchedPlatforms.size;
          this.progressUI.textContent = `Platforms: ${this.platformsReached}`;
        }
      }
    }

    // --- Fall reset with rewarded ad ---
    if (this.player.position.y < -20 && !this.isFalling) {
      this.isFalling = true;
      this.handleFall();
    }

    // --- Camera (follows player rotation) ---
    const targetCamPos = new THREE.Vector3(
      this.player.position.x + Math.sin(this.playerAngle) * this.camDistance,
      this.player.position.y + this.camHeight,
      this.player.position.z + Math.cos(this.playerAngle) * this.camDistance
    );
    this.camera.position.lerp(targetCamPos, 0.1);
    this.camera.lookAt(this.player.position);

    // --- Update sun position to follow player ---
    this.sun.position.set(
      this.player.position.x + 20,
      this.player.position.y + 40,
      this.player.position.z + 20
    );
    this.sun.target.position.copy(this.player.position);

    // --- Update record light orbit (vertical X-Y plane) ---
    if (this.recordLight && this.highScore > 0 && this.highScore < this.platforms.length) {
      const platform = this.platforms[this.highScore];
      const center = platform.mesh.position;
      const { orbitRadius, orbitSpeed } = this.config.recordLight;

      this.recordLightAngle += delta * orbitSpeed;
      const lightPos = new THREE.Vector3(
        center.x + Math.cos(this.recordLightAngle) * orbitRadius,
        center.y + 1.5 + Math.sin(this.recordLightAngle) * orbitRadius,
        center.z
      );
      this.recordLight.position.copy(lightPos);

      if (this.recordLightMesh) {
        this.recordLightMesh.position.copy(lightPos);
      }
    }

    // --- Render ---
    this.composer.render();
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
        this.isJumping = false;
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

    // Only show rewarded ad if player made progress (at least 10 platforms)
    if (this.platformsReached >= 10) {
      const watchAd = await this.showFallPrompt(this.platformsReached);

      if (watchAd) {
        const watched = await poki.rewardedBreak();
        if (watched) {
          // Respawn at nearest platform
          this.player.position.copy(nearestPlatform);
          this.playerVelocity.set(0, 0, 0);
          this.playerAngle = 0;
          this.player.rotation.y = 0;
          this.hasStartedMoving = false;
          this.isFalling = false;
          this.start();
          poki.gameplayStart();
          return;
        }
      }
    }

    // Respawn at start
    this.player.position.set(0, 3, -2);
    this.playerVelocity.set(0, 0, 0);
    this.playerAngle = 0;
    this.player.rotation.y = 0;
    this.hasStartedMoving = false;
    this.platformsReached = 0;
    this.touchedPlatforms.clear();
    this.progressUI.textContent = "Platforms: 0";
    this.isFalling = false;
    this.start();
    poki.gameplayStart();
  }

  private showFallPrompt(platforms: number): Promise<boolean> {
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

      // Save high score
      this.saveHighScore(platforms);
      const isNewRecord = platforms >= this.highScore && platforms > 0;

      const title = document.createElement("h2");
      title.textContent = isNewRecord ? "🎉 New Record!" : "You fell!";
      title.style.cssText = "font-size: 8vmin; margin-bottom: 2vmin;";

      const progressText = document.createElement("p");
      progressText.textContent = `Platforms: ${platforms}`;
      progressText.style.cssText = "font-size: 4vmin; margin-bottom: 1vmin; color: #aaa;";

      const highScoreText = document.createElement("p");
      highScoreText.textContent = `Best: ${this.highScore}`;
      highScoreText.style.cssText = "font-size: 3.5vmin; margin-bottom: 5vmin; color: #ffd700;";

      const watchBtn = document.createElement("button");
      watchBtn.textContent = "📺 Watch Ad to Continue";
      watchBtn.style.cssText = `
        padding: 3vmin 6vmin;
        font-size: 3.5vmin;
        font-weight: bold;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 2vmin;
        cursor: pointer;
        margin-bottom: 2vmin;
      `;

      const skipBtn = document.createElement("button");
      skipBtn.textContent = "Restart from Beginning";
      skipBtn.style.cssText = `
        padding: 2vmin 4vmin;
        font-size: 3vmin;
        background: transparent;
        color: #888;
        border: 0.3vmin solid #888;
        border-radius: 2vmin;
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
      overlay.appendChild(progressText);
      overlay.appendChild(highScoreText);
      overlay.appendChild(watchBtn);
      overlay.appendChild(skipBtn);
      document.body.appendChild(overlay);
    });
  }

  public start(): void {
    this.isPlaying = true;
    this.clock.start();
    this.clock.getDelta(); // Reset delta
    requestAnimationFrame(this.animate);
  }

  public enableInput(): void {
    this.isInputEnabled = true;
  }

  private updateCameraDistance(isPortrait: boolean): void {
    const settings = isPortrait ? this.cameraConfig.portrait : this.cameraConfig.landscape;
    this.camDistance = settings.distance;
    this.camHeight = settings.height;
  }

  private loadHighScore(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      this.highScore = saved ? Number.parseInt(saved, 10) : 0;
    } catch {
      this.highScore = 0;
    }
    this.updateRecordLight();
  }

  private saveHighScore(score: number): void {
    if (score > this.highScore) {
      this.highScore = score;
      try {
        localStorage.setItem(this.STORAGE_KEY, score.toString());
      } catch {
        // localStorage not available
      }
      this.updateRecordLight();
    }
  }

  private updateRecordLight(): void {
    // Remove existing light and mesh
    if (this.recordLight) {
      this.scene.remove(this.recordLight);
      this.recordLight = null;
    }
    if (this.recordLightMesh) {
      this.scene.remove(this.recordLightMesh);
      this.recordLightMesh = null;
    }

    // Don't show light if no high score or high score is 0
    if (this.highScore <= 0) return;

    // Platform index: 0 is start, 1-5 are tutorial, 6+ are random
    // High score of N means player reached N platforms, so light goes on platform N
    const platformIndex = this.highScore;
    if (platformIndex >= this.platforms.length) return;

    // Create orbiting point light (golden color)
    const { intensity, distance, sphereRadius } = this.config.recordLight;
    this.recordLight = new THREE.PointLight(0xffd700, intensity, distance);
    this.recordLight.castShadow = false;
    this.scene.add(this.recordLight);

    // Create glowing sphere to mark the light position
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9,
    });
    this.recordLightMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.scene.add(this.recordLightMesh);
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
