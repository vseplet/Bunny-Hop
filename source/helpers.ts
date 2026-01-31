/**
 * Game Helpers
 * Utility functions for common game operations
 */

import { poki } from "./poki.ts";

/**
 * Show commercial break before starting next level/round
 * Usage: Call this before starting a new level or after game over
 */
export async function showCommercialBreak(callbacks?: {
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  disableInput?: () => void;
  enableInput?: () => void;
}): Promise<void> {
  await poki.commercialBreak({
    onStart: () => {
      console.log("[Helper] Commercial break started");
    },
    onFinish: () => {
      console.log("[Helper] Commercial break finished");
    },
    ...callbacks,
  });
}

/**
 * Show rewarded break to give player a reward
 * Usage: Call this when player wants to watch ad for reward
 *
 * @returns true if player watched the ad, false otherwise
 */
export async function showRewardedBreak(options?: {
  size?: "small" | "medium" | "large";
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  disableInput?: () => void;
  enableInput?: () => void;
}): Promise<boolean> {
  const success = await poki.rewardedBreak({
    size: options?.size || "medium",
    onStart: () => {
      console.log("[Helper] Rewarded break started");
    },
    onFinish: (success) => {
      console.log(`[Helper] Rewarded break finished, success: ${success}`);
    },
    ...options,
  });

  return success;
}

/**
 * Example usage in game:
 *
 * // After level complete:
 * await showCommercialBreak({
 *   muteAudio: () => audioManager.mute(),
 *   unmuteAudio: () => audioManager.unmute(),
 *   disableInput: () => inputManager.disable(),
 *   enableInput: () => inputManager.enable(),
 * });
 * poki.gameplayStart();
 * startNextLevel();
 *
 * // For rewarded ad (e.g., revive, extra coins):
 * const watched = await showRewardedBreak({
 *   size: 'medium',
 *   muteAudio: () => audioManager.mute(),
 *   unmuteAudio: () => audioManager.unmute(),
 * });
 *
 * if (watched) {
 *   // Give player reward
 *   player.addCoins(100);
 * }
 *
 * poki.gameplayStart();
 */
