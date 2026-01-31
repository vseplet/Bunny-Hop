/**
 * Virtual Joystick for Mobile Controls
 */

export class VirtualJoystick {
  private joystickContainer: HTMLElement;
  private joystickStick!: HTMLElement;
  private jumpButton: HTMLElement;

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private dx = 0;
  private dy = 0;
  private isJumping = false;

  private onUpdateCallback?: (dx: number, dy: number, jump: boolean) => void;

  constructor() {
    this.joystickContainer = this.createJoystick();
    this.jumpButton = this.createJumpButton();
    this.setupEventListeners();

    // Show only on touch devices
    if (!this.isTouchDevice()) {
      this.hide();
    }
  }

  private isTouchDevice(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  private createJoystick(): HTMLElement {
    const container = document.createElement("div");
    container.id = "joystick-container";
    container.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 60px;
      width: 120px;
      height: 120px;
      background: rgba(255, 255, 255, 0.3);
      border: 3px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      z-index: 1000;
      touch-action: none;
    `;

    this.joystickStick = document.createElement("div");
    this.joystickStick.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50px;
      height: 50px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.1s;
    `;

    container.appendChild(this.joystickStick);
    document.body.appendChild(container);

    return container;
  }

  private createJumpButton(): HTMLElement {
    const button = document.createElement("div");
    button.id = "jump-button";
    button.textContent = "JUMP";
    button.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 60px;
      width: 100px;
      height: 100px;
      background: rgba(255, 107, 107, 0.8);
      border: 3px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      color: white;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      touch-action: none;
      user-select: none;
      cursor: pointer;
    `;

    document.body.appendChild(button);
    return button;
  }

  private setupEventListeners(): void {
    // Joystick
    this.joystickContainer.addEventListener("touchstart", this.onJoystickStart);
    this.joystickContainer.addEventListener("touchmove", this.onJoystickMove);
    this.joystickContainer.addEventListener("touchend", this.onJoystickEnd);

    // Jump button
    this.jumpButton.addEventListener("touchstart", this.onJumpStart);
    this.jumpButton.addEventListener("touchend", this.onJumpEnd);

    // Prevent context menu
    this.joystickContainer.addEventListener("contextmenu", (e) => e.preventDefault());
    this.jumpButton.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onJoystickStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.isDragging = true;

    const touch = e.touches[0];
    const rect = this.joystickContainer.getBoundingClientRect();
    this.startX = rect.left + rect.width / 2;
    this.startY = rect.top + rect.height / 2;

    this.updateJoystick(touch.clientX, touch.clientY);
  };

  private onJoystickMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.isDragging) return;

    const touch = e.touches[0];
    this.updateJoystick(touch.clientX, touch.clientY);
  };

  private onJoystickEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.isDragging = false;
    this.dx = 0;
    this.dy = 0;

    // Reset stick position
    this.joystickStick.style.transform = "translate(-50%, -50%)";
    this.notifyUpdate();
  };

  private updateJoystick(x: number, y: number): void {
    const deltaX = x - this.startX;
    const deltaY = y - this.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = 35; // Max stick travel distance

    // Clamp to max distance
    let clampedX = deltaX;
    let clampedY = deltaY;

    if (distance > maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      clampedX = Math.cos(angle) * maxDistance;
      clampedY = Math.sin(angle) * maxDistance;
    }

    // Update stick visual position
    this.joystickStick.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

    // Normalize to -1 to 1
    this.dx = clampedX / maxDistance;
    this.dy = clampedY / maxDistance;

    this.notifyUpdate();
  }

  private onJumpStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.isJumping = true;
    this.jumpButton.style.background = "rgba(255, 107, 107, 1)";
    this.notifyUpdate();
  };

  private onJumpEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.isJumping = false;
    this.jumpButton.style.background = "rgba(255, 107, 107, 0.8)";
    this.notifyUpdate();
  };

  private notifyUpdate(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.dx, this.dy, this.isJumping);
    }
  }

  public onUpdate(callback: (dx: number, dy: number, jump: boolean) => void): void {
    this.onUpdateCallback = callback;
  }

  public show(): void {
    this.joystickContainer.style.display = "block";
    this.jumpButton.style.display = "flex";
  }

  public hide(): void {
    this.joystickContainer.style.display = "none";
    this.jumpButton.style.display = "none";
  }

  public destroy(): void {
    this.joystickContainer.remove();
    this.jumpButton.remove();
  }
}
