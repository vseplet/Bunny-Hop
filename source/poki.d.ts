/**
 * Poki SDK TypeScript Definitions
 */

interface PokiSDK {
  /**
   * Initialize the SDK
   */
  init(): Promise<void>;

  /**
   * Fire when game loading has finished
   */
  gameLoadingFinished(): void;

  /**
   * Fire when gameplay starts (e.g. level start, unpause)
   */
  gameplayStart(): void;

  /**
   * Fire when gameplay stops (e.g. level finish, game over, pause)
   */
  gameplayStop(): void;

  /**
   * Trigger a commercial break (video ad)
   * @param beforeAd Optional callback before ad starts
   */
  commercialBreak(beforeAd?: () => void): Promise<void>;

  /**
   * Trigger a rewarded break (rewarded video ad)
   * @param options Options or callback
   */
  rewardedBreak(
    options?:
      | {
          size?: "small" | "medium" | "large";
          onStart?: () => void;
        }
      | (() => void)
  ): Promise<boolean>;

  /**
   * Create a shareable URL
   */
  shareableURL(params: Record<string, string>): Promise<string>;

  /**
   * Get URL parameter
   */
  getURLParam(name: string): string | null;

  /**
   * Move the Poki Pill on mobile
   * @param topPercent Percentage from top (0-50)
   * @param topPx Additional pixel offset
   */
  movePill(topPercent: number, topPx: number): void;
}

declare const PokiSDK: PokiSDK;

interface Window {
  PokiSDK: PokiSDK;
}
