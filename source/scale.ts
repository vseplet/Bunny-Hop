/**
 * Scale Manager
 * Handles responsive scaling with base resolutions for portrait/landscape
 */

import type { PerspectiveCamera, WebGLRenderer } from "three";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

export type ScaleMode = "FIT" | "COVER" | "STRETCH";

export interface BaseResolution {
  width: number;
  height: number;
}

export interface ScaleConfig {
  landscape: BaseResolution;
  portrait: BaseResolution;
  mode?: ScaleMode;
  minScale?: number;
  maxScale?: number;
}

export interface ScaleState {
  width: number;
  height: number;
  scale: number;
  isPortrait: boolean;
  baseResolution: BaseResolution;
}

type ResizeCallback = (state: ScaleState) => void;

export class ScaleManager {
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private config: Required<ScaleConfig>;
  private state: ScaleState;
  private callbacks: ResizeCallback[] = [];
  private boundOnResize: () => void;

  constructor(renderer: WebGLRenderer, camera: PerspectiveCamera, config: ScaleConfig) {
    this.renderer = renderer;
    this.camera = camera;
    this.config = {
      landscape: config.landscape,
      portrait: config.portrait,
      mode: config.mode ?? "FIT",
      minScale: config.minScale ?? 0.5,
      maxScale: config.maxScale ?? 2,
    };

    this.state = this.calculateState();
    this.boundOnResize = this.onResize.bind(this);

    window.addEventListener("resize", this.boundOnResize);
    this.apply();
  }

  /**
   * Set the effect composer for post-processing resize
   */
  setComposer(composer: EffectComposer): void {
    this.composer = composer;
    this.apply();
  }

  /**
   * Calculate current scale state based on window size
   */
  private calculateState(): ScaleState {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isPortrait = windowHeight > windowWidth;

    const baseResolution = isPortrait ? this.config.portrait : this.config.landscape;

    let scale: number;
    let width: number;
    let height: number;

    switch (this.config.mode) {
      case "FIT": {
        // Scale to fit entirely within window (letterbox/pillarbox)
        const scaleX = windowWidth / baseResolution.width;
        const scaleY = windowHeight / baseResolution.height;
        scale = Math.min(scaleX, scaleY);
        break;
      }
      case "COVER": {
        // Scale to cover entire window (may crop)
        const scaleX = windowWidth / baseResolution.width;
        const scaleY = windowHeight / baseResolution.height;
        scale = Math.max(scaleX, scaleY);
        break;
      }
      case "STRETCH": {
        // Use window dimensions directly
        scale = 1;
        break;
      }
    }

    // Clamp scale
    scale = Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));

    if (this.config.mode === "STRETCH") {
      width = windowWidth;
      height = windowHeight;
    } else {
      width = windowWidth;
      height = windowHeight;
    }

    return {
      width,
      height,
      scale,
      isPortrait,
      baseResolution,
    };
  }

  /**
   * Apply current scale state to renderer and camera
   */
  private apply(): void {
    const { width, height } = this.state;

    // Update renderer
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update camera
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update composer if set
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  /**
   * Handle window resize
   */
  private onResize(): void {
    this.state = this.calculateState();
    this.apply();

    // Notify callbacks
    for (const callback of this.callbacks) {
      callback(this.state);
    }
  }

  /**
   * Register resize callback
   */
  onUpdate(callback: ResizeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove resize callback
   */
  offUpdate(callback: ResizeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Get current state
   */
  getState(): ScaleState {
    return { ...this.state };
  }

  /**
   * Check if currently in portrait mode
   */
  get isPortrait(): boolean {
    return this.state.isPortrait;
  }

  /**
   * Get current scale factor
   */
  get scale(): number {
    return this.state.scale;
  }

  /**
   * Get current width
   */
  get width(): number {
    return this.state.width;
  }

  /**
   * Get current height
   */
  get height(): number {
    return this.state.height;
  }

  /**
   * Force refresh
   */
  refresh(): void {
    this.onResize();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ScaleConfig>): void {
    if (config.landscape) this.config.landscape = config.landscape;
    if (config.portrait) this.config.portrait = config.portrait;
    if (config.mode) this.config.mode = config.mode;
    if (config.minScale !== undefined) this.config.minScale = config.minScale;
    if (config.maxScale !== undefined) this.config.maxScale = config.maxScale;

    this.refresh();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    window.removeEventListener("resize", this.boundOnResize);
    this.callbacks = [];
  }
}
