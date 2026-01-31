/**
 * Source Task
 * TypeScript compilation via Bun.build
 */

import { BaseTask, type TaskContext, type TaskResult } from "./base.ts";

export interface SourceConfig {
  entryPoints: string[];
  outdir: string;
  watchPaths: string[];
  minify?: boolean;
  sourcemap?: boolean;
}

export class SourceTask extends BaseTask {
  readonly name = "Source";
  readonly description = "Compile TypeScript source code with Bun.build";

  constructor(private config: SourceConfig) {
    super();
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    const startTime = performance.now();
    ctx.logger.start(this.name);

    return await this.safeExecute(ctx, async () => {
      const result = await Bun.build({
        entrypoints: this.config.entryPoints,
        outdir: this.config.outdir,
        naming: "game.[ext]",
        minify: this.config.minify ?? false,
        sourcemap: this.config.sourcemap ? "external" : "none",
        target: "browser",
        format: "esm",
        splitting: false,
      });

      if (!result.success) {
        const errors = result.logs
          .filter((log) => log.level === "error")
          .map((log) => log.message)
          .join("\n");
        throw new Error(`Build failed:\n${errors}`);
      }

      const duration = Math.round(performance.now() - startTime);
      ctx.logger.success(this.name, `Compiled to ${this.config.outdir}`, duration);

      return { output: this.config.outdir };
    });
  }

  async watch(ctx: TaskContext, onChange: () => Promise<void>): Promise<void> {
    await this.watchPaths(this.config.watchPaths, ctx, onChange, 200);
  }
}
