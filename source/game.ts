/**
 * Bunny Hop Game
 * Simple 3D platformer with custom physics
 */

import { Easing, Group, Tween } from "@tweenjs/tween.js";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { audio } from "./audio.ts";
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

type PlatformType = "normal" | "moving" | "fading";

interface Platform {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  type: PlatformType;
  index: number;
  baseX?: number; // for moving platforms
  movePhase?: number; // for moving platforms
  touched?: boolean; // for fading platforms
  fadeTimer?: number; // for fading platforms
  dead?: boolean; // platform is faded out, skip collision
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

  // Animation
  private tweenGroup = new Group();

  // Death effect
  private debris: { mesh: THREE.Mesh; velocity: THREE.Vector3 }[] = [];

  // Intro camera orbit
  private introMode = true;
  private introAngle = 0;

  // Collectibles
  private gems: THREE.Mesh[] = [];
  private gemsCollected = 0;
  private gemsUI!: HTMLElement;

  // Camera settings (updated based on orientation)
  private camDistance = 8;
  private camHeight = 5;
  private cameraConfig: {
    landscape: { distance: number; height: number };
    portrait: { distance: number; height: number };
  };

  // Platform generation - smooth snake/spiral path
  private readonly PLATFORMS_AHEAD = 25;
  private readonly PLATFORMS_BEHIND = 10;
  private generatedCount = 0;
  private lastGenX = 0;
  private lastGenY = 0;
  private lastGenZ = 0;
  private pathAngle = 0; // Current direction in radians (0 = -Z forward)
  private turnRate = 0; // Current turn rate (positive = left, negative = right)
  private turnChangeTimer = 0; // When to change turn direction

  constructor(
    config: GameConfig,
    private container: HTMLElement
  ) {
    this.config = config;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = this.createSpaceSkybox();
    this.scene.fog = new THREE.Fog(0x010102, 15, 45);

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
    this.createStartPlatform();
    this.generateInitialPlatforms();
    this.createLights();
    this.setupControls();
    this.createUI();
    this.loadHighScore();
  }

  private createSpaceSkybox(): THREE.CubeTexture {
    const size = 512;
    const textures: HTMLCanvasElement[] = [];

    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;

      // Deep space gradient
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size * 0.7
      );
      gradient.addColorStop(0, "#0a0a18");
      gradient.addColorStop(0.5, "#050508");
      gradient.addColorStop(1, "#010102");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Add nebula clouds
      for (let n = 0; n < 3; n++) {
        const nx = Math.random() * size;
        const ny = Math.random() * size;
        const nebulaGradient = ctx.createRadialGradient(
          nx,
          ny,
          0,
          nx,
          ny,
          100 + Math.random() * 100
        );
        const hue = Math.random() * 60 + 220; // Blue to purple
        nebulaGradient.addColorStop(0, `hsla(${hue}, 50%, 15%, 0.08)`);
        nebulaGradient.addColorStop(0.5, `hsla(${hue}, 40%, 10%, 0.04)`);
        nebulaGradient.addColorStop(1, "transparent");
        ctx.fillStyle = nebulaGradient;
        ctx.fillRect(0, 0, size, size);
      }

      // Add stars
      const starCount = 200 + Math.floor(Math.random() * 100);
      for (let s = 0; s < starCount; s++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const starSize = Math.random() * 2 + 0.5;
        const brightness = Math.random() * 0.5 + 0.5;

        ctx.beginPath();
        ctx.arc(x, y, starSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.fill();

        // Add glow to some stars
        if (Math.random() > 0.7) {
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, starSize * 4);
          const starHue = Math.random() > 0.5 ? 200 : 30; // Blue or yellow tint
          glowGradient.addColorStop(0, `hsla(${starHue}, 50%, 80%, 0.3)`);
          glowGradient.addColorStop(1, "transparent");
          ctx.fillStyle = glowGradient;
          ctx.fillRect(x - starSize * 4, y - starSize * 4, starSize * 8, starSize * 8);
        }
      }

      textures.push(canvas);
    }

    const cubeTexture = new THREE.CubeTexture(textures);
    cubeTexture.needsUpdate = true;
    return cubeTexture;
  }

  private createPlayer(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.5,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 3, -2);
    mesh.castShadow = true;

    // Add red point light to player
    const playerLight = new THREE.PointLight(0xff0000, 10, 15);
    playerLight.castShadow = false;
    mesh.add(playerLight);

    this.scene.add(mesh);
    return mesh;
  }

  private createStartPlatform(): void {
    const { start } = this.config.platforms;
    const startCenterZ = -start.depth / 2;
    this.addStartPlatformMesh(0, 0, startCenterZ, start.width, start.height, start.depth);

    // Initialize generator position after start platform
    this.lastGenZ = -start.depth;
    this.lastGenX = 0;
    this.lastGenY = 0;
  }

  private generateInitialPlatforms(): void {
    // Generate initial platforms ahead
    for (let i = 0; i < this.PLATFORMS_AHEAD; i++) {
      this.generateNextPlatform();
    }
  }

  private generateNextPlatform(): void {
    this.generatedCount++;
    const n = this.generatedCount;

    // Calculate difficulty (0 to 1)
    const difficulty = Math.min(n / 200, 1);

    // First 5 platforms: tutorial, straight and easy
    const isTutorial = n <= 5;

    // Calculate gap - more variation!
    let gap: number;
    if (isTutorial) {
      gap = 4; // Fixed easy gap for tutorial
    } else {
      // Varied gaps: sometimes short (3.5), sometimes long (6)
      const baseGap = 3.5 + difficulty * 1;
      const variation = Math.random() * 2.5; // 0 to 2.5
      gap = baseGap + variation;
    }

    // Update path direction (skip for tutorial - keep straight)
    if (!isTutorial) {
      this.updatePathDirection();
    }

    // Calculate next position using current direction
    const nextX = this.lastGenX + Math.sin(this.pathAngle) * gap;
    const nextZ = this.lastGenZ - Math.cos(this.pathAngle) * gap;

    // Check for self-intersection and adjust if needed (skip for tutorial)
    if (isTutorial) {
      this.lastGenX = nextX;
      this.lastGenZ = nextZ;
    } else {
      const adjustedPos = this.avoidSelfIntersection(nextX, nextZ, gap);
      this.lastGenX = adjustedPos.x;
      this.lastGenZ = adjustedPos.z;
    }

    // Height: tutorial stays flat, then gradual increase
    if (!isTutorial && Math.random() > 0.3) {
      this.lastGenY += 0.2 + Math.random() * 0.3 + difficulty * 0.2;
    }
    this.lastGenY = Math.max(0, this.lastGenY);

    // Size: tutorial has bigger platforms
    let size: number;
    if (isTutorial) {
      size = 3.5;
    } else {
      size = 3.2 - difficulty * 1.0 + Math.random() * 0.5;
    }

    // Get color based on progress
    const color = this.getColorByProgress(n);

    // Get platform type
    const type = this.getPlatformType(n);

    // Add platform
    this.addPlatformWithType(
      this.lastGenX,
      this.lastGenY,
      this.lastGenZ,
      size,
      0.5,
      size,
      color,
      type,
      n
    );

    // Add gem every 5th platform (starting from 5)
    if (n % 5 === 0) {
      this.addGemToPlatform(this.platforms[this.platforms.length - 1]);
    }
  }

  private updatePathDirection(): void {
    // Change turn direction periodically
    this.turnChangeTimer--;
    if (this.turnChangeTimer <= 0) {
      // New turn rate: gentle curves
      this.turnRate = (Math.random() - 0.5) * 0.3;
      this.turnChangeTimer = 5 + Math.floor(Math.random() * 10);
    }

    // Apply turn rate to path angle (smooth turning)
    this.pathAngle += this.turnRate;

    // Keep angle in reasonable range for mostly forward movement
    // Allow up to ~60 degrees left or right from forward
    const maxAngle = Math.PI / 3;
    this.pathAngle = Math.max(-maxAngle, Math.min(maxAngle, this.pathAngle));
  }

  private avoidSelfIntersection(x: number, z: number, gap: number): { x: number; z: number } {
    const minDistance = gap * 1.5; // Minimum distance from other platforms

    // Check recent platforms (not all, just last ~30)
    const checkCount = Math.min(30, this.platforms.length);
    for (let i = this.platforms.length - 1; i >= this.platforms.length - checkCount; i--) {
      if (i < 0) break;
      const p = this.platforms[i];
      const dx = x - p.mesh.position.x;
      const dz = z - p.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < minDistance) {
        // Too close! Push away from this platform
        const pushAngle = Math.atan2(dx, -dz);
        const pushStrength = (minDistance - dist) * 1.5;

        x += Math.sin(pushAngle) * pushStrength;
        z -= Math.cos(pushAngle) * pushStrength;

        // Also adjust path angle to steer away
        this.pathAngle = pushAngle * 0.5;
      }
    }

    return { x, z };
  }

  private getColorByProgress(n: number): number {
    // Color zones with more distinct transitions
    if (n < 30) {
      // Meadow: bright green
      const t = n / 30;
      return new THREE.Color().setHSL(0.35 - t * 0.05, 0.7, 0.45).getHex();
    } else if (n < 60) {
      // Sunset: yellow to orange (more visible transition)
      const t = (n - 30) / 30;
      return new THREE.Color().setHSL(0.12 - t * 0.06, 0.8, 0.5).getHex();
    } else if (n < 100) {
      // Fire: orange to red
      const t = (n - 60) / 40;
      return new THREE.Color().setHSL(0.06 - t * 0.06, 0.85, 0.45).getHex();
    } else if (n < 150) {
      // Sky: cyan to deep blue
      const t = (n - 100) / 50;
      return new THREE.Color().setHSL(0.55 - t * 0.1, 0.7, 0.5).getHex();
    } else {
      // Space: purple to magenta
      const t = Math.min((n - 150) / 80, 1);
      return new THREE.Color().setHSL(0.8 - t * 0.1, 0.6, 0.45).getHex();
    }
  }

  private getPlatformType(n: number): PlatformType {
    if (n < 40) return "normal";

    const roll = Math.random();

    if (n < 80) {
      // 20% chance of moving
      return roll < 0.2 ? "moving" : "normal";
    }

    // 15% moving, 15% fading
    if (roll < 0.15) return "moving";
    if (roll < 0.3) return "fading";
    return "normal";
  }

  private addPlatformWithType(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    type: PlatformType,
    index: number
  ): void {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      transparent: type === "fading",
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const platform: Platform = {
      mesh,
      box,
      type,
      index,
      baseX: type === "moving" ? x : undefined,
      movePhase: type === "moving" ? Math.random() * Math.PI * 2 : undefined,
      touched: false,
      fadeTimer: 1.5,
      dead: false,
    };
    this.platforms.push(platform);
  }

  private addGemToPlatform(platform: Platform): void {
    const pos = platform.mesh.position;

    const geometry = new THREE.ConeGeometry(0.4, 0.8, 4);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00bfff,
      emissive: 0x00bfff,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });

    const gem = new THREE.Mesh(geometry, material);
    gem.position.set(pos.x, pos.y + 2, pos.z);
    gem.castShadow = true;
    this.scene.add(gem);
    this.gems.push(gem);

    // Add floating animation
    const startY = gem.position.y;
    new Tween({ y: startY, rot: 0 }, this.tweenGroup)
      .to({ y: startY + 0.5, rot: Math.PI * 2 }, 2000)
      .easing(Easing.Sinusoidal.InOut)
      .repeat(Infinity)
      .yoyo(true)
      .onUpdate((obj) => {
        gem.position.y = obj.y;
        gem.rotation.y = obj.rot;
      })
      .start();
  }

  private addStartPlatformMesh(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number
  ): void {
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
    this.platforms.push({
      mesh,
      box,
      type: "normal",
      index: 0,
      dead: false,
    });
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
      font-family: 'Jersey 10', Arial, sans-serif;
      font-size: 7vmin;
      font-weight: bold;
      color: white;
      text-shadow: 0.3vmin 0.3vmin 0.6vmin rgba(0, 0, 0, 0.5);
      z-index: 100;
    `;
    this.progressUI.textContent = "Platforms: 0";
    document.body.appendChild(this.progressUI);

    this.gemsUI = document.createElement("div");
    this.gemsUI.style.cssText = `
      position: fixed;
      top: 3vmin;
      right: 3vmin;
      font-family: 'Jersey 10', Arial, sans-serif;
      font-size: 7vmin;
      font-weight: bold;
      color: #00bfff;
      text-shadow: 0.3vmin 0.3vmin 0.6vmin rgba(0, 0, 0, 0.5);
      z-index: 100;
    `;
    this.gemsUI.textContent = "Gems: 0";
    document.body.appendChild(this.gemsUI);
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
    // Only use horizontal axis for turning
    this.keys.left = dx < -0.35;
    this.keys.right = dx > 0.35;
    this.keys.jump = jump;

    // Any joystick movement starts the game
    if (!this.hasStartedMoving && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || jump)) {
      this.hasStartedMoving = true;
    }
  }

  private update(delta: number): void {
    // --- Intro camera orbit ---
    if (this.introMode) {
      this.introAngle += delta * 0.3;
      const orbitRadius = 12;
      const orbitHeight = 6;
      const centerZ = -this.config.platforms.start.depth / 2;
      this.camera.position.set(
        Math.sin(this.introAngle) * orbitRadius,
        orbitHeight,
        centerZ + Math.cos(this.introAngle) * orbitRadius
      );
      this.camera.lookAt(0, 1, centerZ);
      this.composer.render();
      return;
    }

    // --- Don't process input until enabled ---
    if (!this.isInputEnabled) {
      // Just render the scene
      this.composer.render();
      return;
    }

    // --- Check if player started moving ---
    if (!this.hasStartedMoving) {
      if (
        this.keys.left ||
        this.keys.right ||
        this.keys.forward ||
        this.keys.backward ||
        this.keys.jump
      ) {
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
      this.doFlip();
      audio.playJump();
    }

    // Variable jump height - cut velocity when button released early
    if (!this.keys.jump && this.isJumping && this.playerVelocity.y > 0) {
      this.playerVelocity.y *= this.config.physics.jumpCut;
      this.isJumping = false;
    }

    // --- Apply velocity ---
    const displacement = this.playerVelocity.clone().multiplyScalar(delta);
    this.player.position.add(displacement);

    // --- Platform generation and cleanup ---
    this.updatePlatformGeneration();
    this.updateDynamicPlatforms(delta);
    this.cleanupOldPlatforms();

    // --- Collision detection ---
    this.updatePlayerBox();
    this.isGrounded = false;

    for (const platform of this.platforms) {
      // Skip dead platforms (faded out)
      if (platform.dead) continue;

      if (this.playerBox.intersectsBox(platform.box)) {
        this.resolveCollision(platform.box);

        // Mark fading platform as touched
        if (platform.type === "fading" && !platform.touched) {
          platform.touched = true;
        }

        // Track touched platforms
        if (!this.touchedPlatforms.has(platform.mesh)) {
          this.touchedPlatforms.add(platform.mesh);
          this.platformsReached = this.touchedPlatforms.size;
          this.progressUI.textContent = `Platforms: ${this.platformsReached}`;
        }
      }
    }

    // --- Gem collection ---
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      const dist = this.player.position.distanceTo(gem.position);
      if (dist < 1.5) {
        this.scene.remove(gem);
        this.gems.splice(i, 1);
        this.gemsCollected++;
        this.gemsUI.textContent = `Gems: ${this.gemsCollected}`;
        audio.playCollect();
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

    // --- Update debris ---
    for (const d of this.debris) {
      d.velocity.y -= this.config.physics.gravity * delta;
      d.mesh.position.add(d.velocity.clone().multiplyScalar(delta));
      d.mesh.rotation.x += delta * 5;
      d.mesh.rotation.z += delta * 3;
    }

    // --- Update tweens ---
    this.tweenGroup.update();

    // --- Render ---
    this.composer.render();
  }

  private updatePlatformGeneration(): void {
    // Find the furthest platform Z
    let furthestZ = 0;
    for (const p of this.platforms) {
      if (p.mesh.position.z < furthestZ) {
        furthestZ = p.mesh.position.z;
      }
    }

    // Generate more platforms if player is getting close to the end
    const playerZ = this.player.position.z;
    const distanceToEnd = playerZ - furthestZ;

    while (distanceToEnd < this.PLATFORMS_AHEAD * 5) {
      this.generateNextPlatform();
      // Recalculate
      const newFurthest = this.platforms[this.platforms.length - 1].mesh.position.z;
      if (playerZ - newFurthest >= this.PLATFORMS_AHEAD * 5) break;
    }
  }

  private updateDynamicPlatforms(delta: number): void {
    for (const platform of this.platforms) {
      // Moving platforms
      if (
        platform.type === "moving" &&
        platform.baseX !== undefined &&
        platform.movePhase !== undefined
      ) {
        platform.movePhase += delta * 2;
        const offsetX = Math.sin(platform.movePhase) * 3;
        platform.mesh.position.x = platform.baseX + offsetX;
        platform.box.setFromObject(platform.mesh);
      }

      // Fading platforms
      if (platform.type === "fading" && platform.touched && !platform.dead) {
        platform.fadeTimer = (platform.fadeTimer ?? 1.5) - delta;
        const material = platform.mesh.material as THREE.MeshStandardMaterial;
        material.opacity = Math.max(0, platform.fadeTimer / 1.5);

        if (platform.fadeTimer <= 0) {
          platform.dead = true;
          platform.mesh.visible = false;
        }
      }
    }
  }

  private cleanupOldPlatforms(): void {
    const playerZ = this.player.position.z;
    const removeThreshold = playerZ + this.PLATFORMS_BEHIND * 6;

    // Remove platforms that are too far behind (but keep start platform at index 0)
    for (let i = this.platforms.length - 1; i > 0; i--) {
      const platform = this.platforms[i];
      if (platform.mesh.position.z > removeThreshold) {
        this.scene.remove(platform.mesh);
        platform.mesh.geometry.dispose();
        if (Array.isArray(platform.mesh.material)) {
          for (const m of platform.mesh.material) {
            m.dispose();
          }
        } else {
          platform.mesh.material.dispose();
        }
        this.platforms.splice(i, 1);
      }
    }

    // Also cleanup gems that are too far behind
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      if (gem.position.z > removeThreshold) {
        this.scene.remove(gem);
        gem.geometry.dispose();
        (gem.material as THREE.Material).dispose();
        this.gems.splice(i, 1);
      }
    }
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

    // Check if player is predominantly above the platform (for landing check)
    const playerCenterY = this.player.position.y;
    const platformTopY = platformBox.max.y;

    // Find smallest overlap axis
    if (overlapY <= overlapX && overlapY <= overlapZ) {
      // Vertical collision
      if (this.playerVelocity.y < 0) {
        // Only land on top if player center is above platform top
        if (playerCenterY >= platformTopY) {
          this.player.position.y = platformBox.max.y + 0.5;
          this.playerVelocity.y = 0;
          this.isGrounded = true;
          this.isJumping = false;
        } else {
          // Player hit from the side while falling - resolve horizontally
          this.resolveHorizontalCollision(platformBox, overlapX, overlapZ);
        }
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

  private resolveHorizontalCollision(
    platformBox: THREE.Box3,
    overlapX: number,
    overlapZ: number
  ): void {
    if (overlapX <= overlapZ) {
      // Push on X axis
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
      // Push on Z axis
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
    // Explode player at current position
    this.explodePlayer();

    this.stop();
    poki.gameplayStop();

    // Wait for explosion to play out
    await new Promise((r) => setTimeout(r, 1200));

    const nearestPlatform = this.findNearestPlatform();

    // Only show rewarded ad if player made progress (at least 10 platforms)
    if (this.platformsReached >= 10) {
      const watchAd = await this.showFallPrompt(this.platformsReached);

      if (watchAd) {
        const watched = await poki.rewardedBreak();
        if (watched) {
          // Respawn at nearest platform
          this.resetPlayer(nearestPlatform);
          this.isFalling = false;
          this.start();
          poki.gameplayStart();
          return;
        }
      }
    }

    // Full restart - recreate world
    this.resetWorld();
    this.resetPlayer(new THREE.Vector3(0, 3, -2));
    this.isFalling = false;
    this.start();
    poki.gameplayStart();
  }

  private resetWorld(): void {
    // Remove old platforms
    for (const platform of this.platforms) {
      this.scene.remove(platform.mesh);
      platform.mesh.geometry.dispose();
      if (Array.isArray(platform.mesh.material)) {
        for (const m of platform.mesh.material) {
          m.dispose();
        }
      } else {
        platform.mesh.material.dispose();
      }
    }
    this.platforms = [];

    // Remove old gems
    for (const gem of this.gems) {
      this.scene.remove(gem);
      gem.geometry.dispose();
      (gem.material as THREE.Material).dispose();
    }
    this.gems = [];

    // Reset counters
    this.platformsReached = 0;
    this.touchedPlatforms.clear();
    this.progressUI.textContent = "Platforms: 0";
    this.gemsCollected = 0;
    this.gemsUI.textContent = "Gems: 0";

    // Reset generator state
    this.generatedCount = 0;
    this.lastGenX = 0;
    this.lastGenY = 0;
    this.lastGenZ = 0;
    this.pathAngle = 0;
    this.turnRate = 0;
    this.turnChangeTimer = 0;

    // Recreate world
    this.createStartPlatform();
    this.generateInitialPlatforms();
    this.updateRecordLight();
  }

  private showFallPrompt(platforms: number): Promise<boolean> {
    audio.playGameOver();

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
        font-family: 'Jersey 10', Arial, sans-serif;
      `;

      // Save high score
      this.saveHighScore(platforms);
      const isNewRecord = platforms >= this.highScore && platforms > 0;

      const title = document.createElement("h2");
      title.textContent = isNewRecord ? "NEW RECORD!" : "YOU FELL!";
      title.style.cssText = "font-size: 14vmin; margin-bottom: 2vmin;";

      const progressText = document.createElement("p");
      progressText.textContent = `Platforms: ${platforms}`;
      progressText.style.cssText = "font-size: 7vmin; margin-bottom: 1vmin; color: #aaa;";

      const highScoreText = document.createElement("p");
      highScoreText.textContent = `Best: ${this.highScore}`;
      highScoreText.style.cssText = "font-size: 6vmin; margin-bottom: 5vmin; color: #ffd700;";

      const watchBtn = document.createElement("button");
      watchBtn.textContent = "WATCH AD";
      watchBtn.style.cssText = `
        padding: 3vmin 8vmin;
        font-size: 8vmin;
        font-family: 'Jersey 10', Arial, sans-serif;
        font-weight: bold;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 0;
        cursor: pointer;
        margin-bottom: 2vmin;
        box-shadow: 0 0.6vmin 1vmin rgba(0, 0, 0, 0.3);
        transition: all 0.3s;
      `;

      const skipBtn = document.createElement("button");
      skipBtn.textContent = "RESTART";
      skipBtn.style.cssText = `
        padding: 3vmin 8vmin;
        font-size: 8vmin;
        font-family: 'Jersey 10', Arial, sans-serif;
        font-weight: bold;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 0;
        cursor: pointer;
        box-shadow: 0 0.6vmin 1vmin rgba(0, 0, 0, 0.3);
        transition: all 0.3s;
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
    this.introMode = false;
    audio.playStart();
  }

  private doFlip(): void {
    // Random flip direction
    const axes = ["x", "z"] as const;
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const direction = Math.random() > 0.5 ? 1 : -1;
    const flipObj = { angle: 0 };

    new Tween(flipObj, this.tweenGroup)
      .to({ angle: Math.PI * 2 * direction }, 600)
      .easing(Easing.Quadratic.InOut)
      .onUpdate(() => {
        this.player.rotation[axis] = flipObj.angle;
      })
      .onComplete(() => {
        this.player.rotation[axis] = 0;
      })
      .start();
  }

  private explodePlayer(): void {
    audio.playDeath();

    const pos = this.player.position.clone();
    const debrisCount = 20;
    const cubeSize = 0.2;

    // Hide player
    this.player.visible = false;

    // Create debris cubes
    for (let i = 0; i < debrisCount; i++) {
      const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
      const material = new THREE.MeshStandardMaterial({
        color: 0xff6b6b,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Random offset from center
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.5,
        pos.y + (Math.random() - 0.5) * 0.5,
        pos.z + (Math.random() - 0.5) * 0.5
      );

      // Random velocity outward
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 10 + 5,
        (Math.random() - 0.5) * 15
      );

      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      this.debris.push({ mesh, velocity });
    }

    // Animate debris independently of game loop
    const gravity = this.config.physics.gravity;
    let lastTime = performance.now();

    const animateDebris = () => {
      if (this.debris.length === 0) return;

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      for (const d of this.debris) {
        d.velocity.y -= gravity * delta;
        d.mesh.position.add(d.velocity.clone().multiplyScalar(delta));
        d.mesh.rotation.x += delta * 5;
        d.mesh.rotation.z += delta * 3;
      }

      this.composer.render();
      requestAnimationFrame(animateDebris);
    };

    animateDebris();

    // Clean up debris after delay
    setTimeout(() => {
      for (const d of this.debris) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
      }
      this.debris = [];
    }, 2000);
  }

  private resetPlayer(position: THREE.Vector3): void {
    this.player.position.copy(position);
    this.playerVelocity.set(0, 0, 0);
    this.playerAngle = 0;
    this.player.rotation.set(0, 0, 0);
    this.hasStartedMoving = false;
    this.player.visible = true;
    audio.playStart();
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
