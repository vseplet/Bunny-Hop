/**
 * Poki SDK Wrapper
 * Provides a safe interface to Poki SDK with fallbacks
 */

/// <reference path="./poki.d.ts" />

class PokiService {
  private isInitialized = false;
  private isAvailable = false;

  /**
   * Initialize Poki SDK
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[Poki] Already initialized");
      return;
    }

    if (typeof PokiSDK === "undefined") {
      console.warn("[Poki] SDK not available, running in standalone mode");
      this.isInitialized = true;
      this.isAvailable = false;
      return;
    }

    try {
      await PokiSDK.init();
      console.log("[Poki] SDK successfully initialized");
      this.isInitialized = true;
      this.isAvailable = true;
    } catch (error) {
      console.warn("[Poki] Initialization failed, continuing anyway", error);
      this.isInitialized = true;
      this.isAvailable = false;
    }
  }

  /**
   * Fire when game loading has finished
   */
  gameLoadingFinished(): void {
    if (!this.isAvailable) return;
    PokiSDK.gameLoadingFinished();
    console.log("[Poki] Game loading finished");
  }

  /**
   * Fire when gameplay starts
   */
  gameplayStart(): void {
    if (!this.isAvailable) return;
    PokiSDK.gameplayStart();
    console.log("[Poki] Gameplay started");
  }

  /**
   * Fire when gameplay stops
   */
  gameplayStop(): void {
    if (!this.isAvailable) return;
    PokiSDK.gameplayStop();
    console.log("[Poki] Gameplay stopped");
  }

  /**
   * Show a commercial break
   * @param callbacks Callbacks for mute/unmute and disable/enable input
   */
  async commercialBreak(callbacks?: {
    onStart?: () => void;
    onFinish?: () => void;
    muteAudio?: () => void;
    unmuteAudio?: () => void;
    disableInput?: () => void;
    enableInput?: () => void;
  }): Promise<void> {
    if (!this.isAvailable) {
      console.log("[Poki] Commercial break skipped (SDK not available)");
      return;
    }

    console.log("[Poki] Commercial break starting...");

    // Pause game
    this.gameplayStop();

    // Mute audio
    if (callbacks?.muteAudio) {
      callbacks.muteAudio();
    }

    // Disable input
    if (callbacks?.disableInput) {
      callbacks.disableInput();
    }

    callbacks?.onStart?.();

    try {
      await PokiSDK.commercialBreak(() => {
        // Called before ad starts (if ad is shown)
      });

      console.log("[Poki] Commercial break finished");
    } catch (error) {
      console.warn("[Poki] Commercial break error", error);
    } finally {
      // Unmute audio
      if (callbacks?.unmuteAudio) {
        callbacks.unmuteAudio();
      }

      // Enable input
      if (callbacks?.enableInput) {
        callbacks.enableInput();
      }

      callbacks?.onFinish?.();
    }
  }

  /**
   * Show a rewarded break
   */
  async rewardedBreak(options?: {
    size?: "small" | "medium" | "large";
    onStart?: () => void;
    onFinish?: (success: boolean) => void;
    muteAudio?: () => void;
    unmuteAudio?: () => void;
    disableInput?: () => void;
    enableInput?: () => void;
  }): Promise<boolean> {
    if (!this.isAvailable) {
      console.log("[Poki] Rewarded break skipped (SDK not available)");
      return false;
    }

    console.log("[Poki] Rewarded break starting...");

    // Pause game
    this.gameplayStop();

    // Mute audio
    if (options?.muteAudio) {
      options.muteAudio();
    }

    // Disable input
    if (options?.disableInput) {
      options.disableInput();
    }

    options?.onStart?.();

    let success = false;

    try {
      success = await PokiSDK.rewardedBreak({
        size: options?.size || "medium",
      });

      console.log(`[Poki] Rewarded break finished, success: ${success}`);
    } catch (error) {
      console.warn("[Poki] Rewarded break error", error);
    } finally {
      // Unmute audio
      if (options?.unmuteAudio) {
        options.unmuteAudio();
      }

      // Enable input
      if (options?.enableInput) {
        options.enableInput();
      }

      options?.onFinish?.(success);
    }

    return success;
  }

  /**
   * Create a shareable URL
   */
  async shareableURL(params: Record<string, string>): Promise<string | null> {
    if (!this.isAvailable) {
      console.log("[Poki] Shareable URL not available (SDK not loaded)");
      return null;
    }

    try {
      const url = await PokiSDK.shareableURL(params);
      return url;
    } catch (error) {
      console.warn("[Poki] Failed to create shareable URL", error);
      return null;
    }
  }

  /**
   * Get URL parameter
   */
  getURLParam(name: string): string | null {
    if (!this.isAvailable) {
      // Fallback to reading from URL directly
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    }

    return PokiSDK.getURLParam(name);
  }

  /**
   * Move the Poki Pill on mobile
   */
  movePill(topPercent: number, topPx: number): void {
    if (!this.isAvailable) return;
    PokiSDK.movePill(topPercent, topPx);
  }

  /**
   * Check if SDK is available
   */
  get available(): boolean {
    return this.isAvailable;
  }

  /**
   * Check if SDK is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const poki = new PokiService();
