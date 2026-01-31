/**
 * Build Task Base
 */

import { watch } from "node:fs";
import type { Logger } from "#/build/logger.ts";

export interface TaskContext {
  logger: Logger;
  isDev: boolean;
  force?: boolean;
}

export interface TaskResult {
  success: boolean;
  error?: Error;
  data?: unknown;
}

export interface BuildTask {
  readonly name: string;
  readonly description?: string;
  readonly dependencies?: string[];

  execute(ctx: TaskContext, depsData?: Record<string, unknown>): Promise<TaskResult>;
  watch?(ctx: TaskContext, onChange: () => Promise<void>): Promise<void>;
}

export abstract class BaseTask implements BuildTask {
  abstract readonly name: string;
  readonly description?: string;
  readonly dependencies?: string[];

  abstract execute(ctx: TaskContext, depsData?: Record<string, unknown>): Promise<TaskResult>;

  protected success(data?: unknown): TaskResult {
    return { success: true, data };
  }

  protected failure(error: Error): TaskResult {
    return { success: false, error };
  }

  protected async safeExecute(ctx: TaskContext, fn: () => Promise<unknown>): Promise<TaskResult> {
    try {
      const data = await fn();
      return this.success(data);
    } catch (error) {
      ctx.logger.error(this.name, error instanceof Error ? error.message : String(error));
      return this.failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  protected async watchPaths(
    paths: string[],
    ctx: TaskContext,
    onChange: () => Promise<void>,
    debounceMs = 100
  ): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let isProcessing = false;

    ctx.logger.info(this.name, `Watching: ${paths.join(", ")}`);

    const handleChange = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
          ctx.logger.info(this.name, "Changes detected, rebuilding...");
          await onChange();
        } catch (error) {
          ctx.logger.error(this.name, error instanceof Error ? error.message : String(error));
        } finally {
          isProcessing = false;
        }
      }, debounceMs);
    };

    const _watchers = paths.map((path) => {
      return watch(path, { recursive: true }, handleChange);
    });

    await new Promise(() => {});
  }
}
