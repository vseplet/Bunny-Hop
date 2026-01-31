/**
 * Clean Task
 */

import { cleanDir } from "#/build/utils/fs.ts";
import { BaseTask, type TaskContext, type TaskResult } from "./base.ts";

export interface CleanTaskConfig {
  targetDir: string;
}

export class CleanTask extends BaseTask {
  readonly name = "Clean";
  readonly description = "Clean build directory";

  constructor(private config: CleanTaskConfig) {
    super();
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    const startTime = performance.now();
    ctx.logger.start(this.name, `Cleaning ${this.config.targetDir}...`);

    return await this.safeExecute(ctx, async () => {
      await cleanDir(this.config.targetDir);

      const duration = Math.round(performance.now() - startTime);
      ctx.logger.success(this.name, "Build directory cleaned", duration);

      return { targetDir: this.config.targetDir };
    });
  }
}
