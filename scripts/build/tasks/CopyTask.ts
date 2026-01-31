/**
 * Copy Task
 */

import { copyDir, exists } from "#/build/utils/fs.ts";
import { BaseTask, type TaskContext, type TaskResult } from "./base.ts";

export interface AssetSourceConfig {
  sources: string[];
  output: string;
}

export interface CopyTaskConfig {
  models?: AssetSourceConfig;
  textures?: AssetSourceConfig;
  fonts?: AssetSourceConfig;
}

export class CopyTask extends BaseTask {
  readonly name = "Copy";
  readonly description = "Copy static assets (models, textures, fonts)";

  constructor(private config: CopyTaskConfig) {
    super();
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    const startTime = performance.now();
    ctx.logger.start(this.name);

    return await this.safeExecute(ctx, async () => {
      let copiedCount = 0;

      if (this.config.models) {
        await this.copyAssetType(this.config.models);
        copiedCount++;
      }

      if (this.config.textures) {
        await this.copyAssetType(this.config.textures);
        copiedCount++;
      }

      if (this.config.fonts) {
        await this.copyAssetType(this.config.fonts);
        copiedCount++;
      }

      const duration = Math.round(performance.now() - startTime);
      ctx.logger.success(this.name, `Copied ${copiedCount} asset type(s)`, duration);
    });
  }

  private async copyAssetType(config: AssetSourceConfig): Promise<void> {
    for (const source of config.sources) {
      if (!(await exists(source))) {
        continue;
      }

      const dirName = source.split("/").filter(Boolean).pop();
      const outputEndsWithDirName =
        config.output.endsWith(`/${dirName}`) || config.output.endsWith(dirName!);
      const dest = outputEndsWithDirName ? config.output : `${config.output}/${dirName}`;

      await copyDir(source, dest);
    }
  }

  async watch(ctx: TaskContext, onChange: () => Promise<void>): Promise<void> {
    const watchPaths: string[] = [];

    if (this.config.models) {
      watchPaths.push(...this.config.models.sources);
    }
    if (this.config.textures) {
      watchPaths.push(...this.config.textures.sources);
    }
    if (this.config.fonts) {
      watchPaths.push(...this.config.fonts.sources);
    }

    if (watchPaths.length > 0) {
      await this.watchPaths(watchPaths, ctx, onChange);
    }
  }
}
