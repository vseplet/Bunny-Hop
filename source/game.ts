/**
 * Bunny Hop Game
 * 3D platformer with physics
 */

import * as CANNON from "cannon-es";
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

export class Game {
  // Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Cannon.js physics
  private world: CANNON.World;
  private timeStep = 1 / 60;

  // Game objects
  private player: {
    mesh: THREE.Mesh;
    body: CANNON.Body;
  };

  private platforms: Array<{
    mesh: THREE.Mesh;
    body: CANNON.Body;
  }> = [];

  // Controls
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  private isPlaying = false;
  private canJump = false;

  // Camera settings
  private cameraDistance = 8;
  private cameraHeight = 4;

  constructor(
    config: GameConfig,
    private container: HTMLElement
  ) {
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    this.camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      window.innerWidth / window.innerHeight,
      config.camera.near,
      config.camera.far
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: config.renderer.antialias,
      alpha: config.renderer.alpha,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Initialize Cannon.js physics
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -20, 0), // Earth-like gravity
    });

    // Create game objects
    this.player = this.createPlayer();
    this.createPlatforms();
    this.setupLighting();
    this.setupControls();

    // Handle resize
    window.addEventListener("resize", () => this.onResize());
  }

  private createPlayer(): { mesh: THREE.Mesh; body: CANNON.Body } {
    // Visual mesh
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.7,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Physics body
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(0, 5, 0),
      shape: shape,
      linearDamping: 0.3,
      angularDamping: 0.9,
    });

    // Detect when player touches ground
    body.addEventListener("collide", (e: any) => {
      const contact = e.contact;
      if (contact.bi.id === body.id || contact.bj.id === body.id) {
        this.canJump = true;
      }
    });

    this.world.addBody(body);

    return { mesh, body };
  }

  private createPlatforms(): void {
    const platforms = [
      // Ground
      { pos: [0, -0.5, 0], size: [20, 1, 20], color: 0x4a9d4a },
      // Platforms
      { pos: [5, 2, 0], size: [3, 0.5, 3], color: 0x6b8e23 },
      { pos: [-5, 4, 3], size: [3, 0.5, 3], color: 0x6b8e23 },
      { pos: [0, 6, -5], size: [3, 0.5, 3], color: 0x6b8e23 },
      { pos: [8, 8, 5], size: [3, 0.5, 3], color: 0x6b8e23 },
    ];

    for (const platform of platforms) {
      const [x, y, z] = platform.pos;
      const [w, h, d] = platform.size;

      // Visual mesh
      const geometry = new THREE.BoxGeometry(w, h, d);
      const material = new THREE.MeshStandardMaterial({
        color: platform.color,
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Physics body
      const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
      const body = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(x, y, z),
        shape: shape,
      });
      this.world.addBody(body);

      this.platforms.push({ mesh, body });
    }
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    // Directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    this.scene.add(sun);
  }

  private setupControls(): void {
    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          this.keys.forward = true;
          break;
        case "s":
        case "arrowdown":
          this.keys.backward = true;
          break;
        case "a":
        case "arrowleft":
          this.keys.left = true;
          break;
        case "d":
        case "arrowright":
          this.keys.right = true;
          break;
        case " ":
          this.keys.jump = true;
          break;
      }
    });

    window.addEventListener("keyup", (e) => {
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          this.keys.forward = false;
          break;
        case "s":
        case "arrowdown":
          this.keys.backward = false;
          break;
        case "a":
        case "arrowleft":
          this.keys.left = false;
          break;
        case "d":
        case "arrowright":
          this.keys.right = false;
          break;
        case " ":
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

  private updatePlayer(): void {
    const speed = 5;
    const jumpForce = 10;

    // Get camera direction
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    // Calculate right vector
    const right = new THREE.Vector3();
    right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

    // Apply movement
    const velocity = new CANNON.Vec3();

    if (this.keys.forward) {
      velocity.x += cameraDirection.x * speed;
      velocity.z += cameraDirection.z * speed;
    }
    if (this.keys.backward) {
      velocity.x -= cameraDirection.x * speed;
      velocity.z -= cameraDirection.z * speed;
    }
    if (this.keys.left) {
      velocity.x -= right.x * speed;
      velocity.z -= right.z * speed;
    }
    if (this.keys.right) {
      velocity.x += right.x * speed;
      velocity.z += right.z * speed;
    }

    // Apply velocity to player body
    this.player.body.velocity.x = velocity.x;
    this.player.body.velocity.z = velocity.z;

    // Jump
    if (this.keys.jump && this.canJump) {
      this.player.body.velocity.y = jumpForce;
      this.canJump = false;
    }

    // Keep rotation upright
    this.player.body.quaternion.setFromEuler(0, 0, 0);
  }

  private updateCamera(): void {
    // Third-person camera
    const playerPos = this.player.body.position;

    // Camera position behind and above player
    const cameraPos = new THREE.Vector3(
      playerPos.x,
      playerPos.y + this.cameraHeight,
      playerPos.z + this.cameraDistance
    );

    this.camera.position.lerp(cameraPos, 0.1);
    this.camera.lookAt(playerPos.x, playerPos.y, playerPos.z);
  }

  private update(): void {
    if (!this.isPlaying) return;

    // Update physics
    this.world.step(this.timeStep);

    // Update player
    this.updatePlayer();

    // Sync visual meshes with physics bodies
    this.player.mesh.position.copy(this.player.body.position as any);
    this.player.mesh.quaternion.copy(this.player.body.quaternion as any);

    // Update camera
    this.updateCamera();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public start(): void {
    this.isPlaying = true;
    this.animate();
  }

  public stop(): void {
    this.isPlaying = false;
  }

  private animate = (): void => {
    if (!this.isPlaying) return;
    requestAnimationFrame(this.animate);
    this.update();
  };
}
