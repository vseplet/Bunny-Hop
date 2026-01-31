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
    },
    container
  );

  // Create virtual joystick for mobile
  joystick = new VirtualJoystick();
  joystick.onUpdate((dx, dy, jump) => {
    game.setMobileControls(dx, dy, jump);
  });

  // Signal that loading is finished
  poki.gameLoadingFinished();

  // Show start screen
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
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 999;
    color: white;
    font-family: Arial, sans-serif;
  `;

  const title = document.createElement("h1");
  title.textContent = "🐰 Bunny Hop";
  title.style.cssText = `
    font-size: 64px;
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  `;

  const instructions = document.createElement("div");
  instructions.style.cssText = `
    font-size: 20px;
    text-align: center;
    margin-bottom: 40px;
    line-height: 1.6;
  `;

  const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isMobile) {
    instructions.innerHTML = `
      <p>📱 Use joystick to move</p>
      <p>🔴 Tap JUMP button to jump</p>
    `;
  } else {
    instructions.innerHTML = `
      <p>⌨️ WASD or Arrow Keys to move</p>
      <p>⎵ Space to jump</p>
    `;
  }

  const startButton = document.createElement("button");
  startButton.textContent = "START GAME";
  startButton.style.cssText = `
    padding: 20px 60px;
    font-size: 24px;
    font-weight: bold;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  `;

  startButton.onmouseover = () => {
    startButton.style.background = "#ff5252";
    startButton.style.transform = "scale(1.05)";
  };

  startButton.onmouseout = () => {
    startButton.style.background = "#ff6b6b";
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

  // Start physics and rendering
  game.start();

  // Signal gameplay started
  poki.gameplayStart();
}

// Handle visibility change (pause when tab is hidden)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game?.stop();
    poki.gameplayStop();
  } else {
    game?.start();
    poki.gameplayStart();
  }
});
