/**
 * Bunny Hop Game
 * Simple 3D platformer with custom physics
 */

import * as THREE from "three";

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

  // Camera
  private cameraOffset = new THREE.Vector3(0, 5, 10);

  constructor(
    _config: GameConfig,
    private container: HTMLElement
  ) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

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
    const platformData = [
      // Ground
      { x: 0, y: 0, z: 0, w: 20, h: 1, d: 20, color: 0x4a9d4a },
      // Platforms
      { x: 5, y: 2, z: 0, w: 3, h: 0.5, d: 3, color: 0x6b8e23 },
      { x: -5, y: 4, z: 3, w: 3, h: 0.5, d: 3, color: 0x6b8e23 },
      { x: 0, y: 6, z: -5, w: 3, h: 0.5, d: 3, color: 0x6b8e23 },
      { x: 7, y: 8, z: -3, w: 3, h: 0.5, d: 3, color: 0x6b8e23 },
    ];

    for (const p of platformData) {
      const geometry = new THREE.BoxGeometry(p.w, p.h, p.d);
      const material = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(p.x, p.y, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Create bounding box
      const box = new THREE.Box3().setFromObject(mesh);
      this.platforms.push({ mesh, box });
    }
  }

  private createLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
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

    // --- Fall reset ---
    if (this.player.position.y < -10) {
      this.player.position.set(0, 5, 0);
      this.playerVelocity.set(0, 0, 0);
    }

    // --- Camera ---
    const targetCamPos = this.player.position.clone().add(this.cameraOffset);
    this.camera.position.lerp(targetCamPos, 0.1);
    this.camera.lookAt(this.player.position);

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
