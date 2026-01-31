/**
 * Build Logger
 */

import { type ConsolaInstance, consola } from "consola";

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface Logger {
  start(taskName: string, message?: string): void;
  success(taskName: string, message?: string, durationMs?: number): void;
  error(taskName: string, message: string): void;
  warn(taskName: string, message: string): void;
  info(taskName: string, message: string): void;
  debug(taskName: string, message: string): void;
  done(totalDurationMs: number): void;
  newline(): void;
  separator(): void;
  raw(): ConsolaInstance;
}

export function createLogger(verbose = false): Logger {
  const log = consola.withTag("build");

  if (verbose) {
    log.level = 4;
  } else {
    log.level = 3;
  }

  return {
    start(taskName: string, message?: string) {
      log.start(`[${taskName}] ${message || "building..."}`);
    },

    success(taskName: string, message?: string, durationMs?: number) {
      const duration = durationMs !== undefined ? ` (${formatDuration(durationMs)})` : "";
      log.success(`[${taskName}] ${message || "done"}${duration}`);
    },

    error(taskName: string, message: string) {
      log.error(`[${taskName}] ${message}`);
    },

    warn(taskName: string, message: string) {
      log.warn(`[${taskName}] ${message}`);
    },

    info(taskName: string, message: string) {
      log.info(`[${taskName}] ${message}`);
    },

    debug(taskName: string, message: string) {
      log.debug(`[${taskName}] ${message}`);
    },

    done(totalDurationMs: number) {
      log.box(`Build completed in ${formatDuration(totalDurationMs)}`);
    },

    newline() {
      console.log();
    },

    separator() {
      console.log("-".repeat(50));
    },

    raw() {
      return log;
    },
  };
}

export const logger = createLogger();
