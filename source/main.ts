/**
 * Bunny Hop - Three.js Game
 * Entry point
 */

import { VirtualJoystick } from "./controls.ts";
import { Game } from "./game.ts";
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
        landscape: { distance: number; height: number };
        portrait: { distance: number; height: number };
      };
      scale: {
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
      poki: {
        enabled: boolean;
        debug: boolean;
      };
    };
  }
}

let game: Game;
let joystick: VirtualJoystick;

// Initialize game when DOM is loaded
window.addEventListener("DOMContentLoaded", async () => {
  console.log("Starting Bunny Hop...");
  console.log("Config:", window.config);

  // Initialize Poki SDK
  if (window.config.poki.enabled) {
    await poki.init();
  }

  // Get container
  const container = document.getElementById("game-container");
  if (!container) {
    console.error("Game container not found!");
    return;
  }

  // Create game
  game = new Game(
    {
      renderer: window.config.renderer,
      camera: window.config.camera,
      scale: window.config.scale,
      physics: window.config.physics,
      platforms: window.config.platforms,
      recordLight: window.config.recordLight,
    },
    container
  );

  // Create virtual joystick for mobile (hidden initially)
  joystick = new VirtualJoystick();
  joystick.hide();
  joystick.onUpdate((dx, dy, jump) => {
    game.setMobileControls(dx, dy, jump);
  });

  // Signal that loading is finished
  poki.gameLoadingFinished();

  // Start game immediately (player won't move until input)
  game.start();

  // Show start screen overlay
  showStartScreen();
});

function showStartScreen(): void {
  const overlay = document.createElement("div");
  overlay.id = "start-screen";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 999;
    color: white;
    font-family: 'Jersey 10', Arial, sans-serif;
  `;

  const title = document.createElement("h1");
  title.textContent = "Bunny Hop";
  title.style.cssText = `
    font-size: 14vmin;
    margin-bottom: 3vmin;
    text-shadow: 0.3vmin 0.3vmin 0.6vmin rgba(0, 0, 0, 0.5);
    text-align: center;
    width: 100%;
  `;

  const instructions = document.createElement("div");
  instructions.style.cssText = `
    font-size: 6vmin;
    text-align: center;
    margin-bottom: 6vmin;
    line-height: 1.6;
  `;

  const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isMobile) {
    instructions.innerHTML = `
      <p>📱 Joystick left/right to steer</p>
      <p>🔴 Tap JUMP to start & jump</p>
    `;
  } else {
    instructions.innerHTML = `
      <p>⌨️ A/D or ←/→ to steer</p>
      <p>⎵ Space to start & jump</p>
    `;
  }

  const startButton = document.createElement("button");
  startButton.textContent = "START GAME";
  startButton.style.cssText = `
    padding: 3vmin 8vmin;
    font-size: 8vmin;
    font-family: 'Jersey 10', Arial, sans-serif;
    font-weight: bold;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 0.6vmin 1vmin rgba(0, 0, 0, 0.3);
  `;

  startButton.onmouseover = () => {
    startButton.style.background = "#1976D2";
    startButton.style.transform = "scale(1.05)";
  };

  startButton.onmouseout = () => {
    startButton.style.background = "#2196F3";
    startButton.style.transform = "scale(1)";
  };

  startButton.onclick = () => {
    overlay.remove();
    startGame();
  };

  overlay.appendChild(title);
  overlay.appendChild(instructions);
  overlay.appendChild(startButton);
  document.body.appendChild(overlay);
}

function startGame(): void {
  console.log("[Game] Starting gameplay");

  // Show mobile controls on touch devices
  const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isMobile) {
    joystick.show();
  }

  // Enable input now that start was pressed
  game.enableInput();

  // Signal gameplay started
  poki.gameplayStart();
}

// Visibility change handling disabled for now - was causing issues with ad restart
// document.addEventListener("visibilitychange", () => {
//   if (!game) return;
//   if (document.hidden) {
//     game.stop();
//   } else {
//     game.start();
//   }
// });
