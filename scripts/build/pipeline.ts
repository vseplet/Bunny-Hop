/**
 * Build Pipeline
 * Task orchestrator with dependencies and watch mode support
 */

import { createLogger, type Logger } from "./logger.ts";
import type { BuildTask, TaskContext } from "./tasks/base.ts";

export interface PipelineOptions {
  isDev?: boolean;
  verbose?: boolean;
  force?: boolean;
  onBuildComplete?: () => void;
}

export class BuildPipeline {
  private tasks: Map<string, BuildTask> = new Map();
  private logger: Logger;
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = options;
    this.logger = createLogger(options.verbose);
  }

  register(task: BuildTask): this {
    if (this.tasks.has(task.name)) {
      throw new Error(`Task "${task.name}" is already registered`);
    }
    this.tasks.set(task.name, task);
    return this;
  }

  registerAll(...tasks: BuildTask[]): this {
    for (const task of tasks) {
      this.register(task);
    }
    return this;
  }

  async run(): Promise<boolean> {
    const startTime = performance.now();
    this.logger.newline();

    const orderedTasks = this.getTopologicalOrder();

    const ctx: TaskContext = {
      logger: this.logger,
      isDev: this.options.isDev ?? false,
      force: this.options.force,
    };

    const results: Record<string, unknown> = {};
    let hasErrors = false;

    for (const task of orderedTasks) {
      const depsData: Record<string, unknown> = {};
      if (task.dependencies) {
        for (const depName of task.dependencies) {
          if (results[depName] !== undefined) {
            depsData[depName] = results[depName];
          }
        }
      }

      const result = await task.execute(ctx, depsData);

      if (!result.success) {
        hasErrors = true;
      }

      if (result.data !== undefined) {
        results[task.name] = result.data;
      }
    }

    const totalDuration = Math.round(performance.now() - startTime);

    if (hasErrors) {
      this.logger.error("Pipeline", "Build completed with errors");
    } else {
      this.logger.done(totalDuration);
      this.options.onBuildComplete?.();
    }

    this.logger.newline();

    return !hasErrors;
  }

  async watch(): Promise<void> {
    await this.run();

    this.logger.separator();
    this.logger.info("Pipeline", "Starting watch mode...");
    this.logger.newline();

    const ctx: TaskContext = {
      logger: this.logger,
      isDev: true,
      force: false,
    };

    const watchPromises: Promise<void>[] = [];

    for (const task of this.tasks.values()) {
      if (task.watch) {
        const onChange = async () => {
          await this.runTaskWithDependents(task.name, ctx);
        };

        watchPromises.push(task.watch(ctx, onChange));
      }
    }

    await Promise.all(watchPromises);
  }

  private async runTaskWithDependents(taskName: string, ctx: TaskContext): Promise<void> {
    const task = this.tasks.get(taskName);
    if (!task) return;

    const results: Record<string, unknown> = {};

    const result = await task.execute(ctx, {});
    if (result.data !== undefined) {
      results[task.name] = result.data;
    }

    const dependents = this.getDependentTasks(taskName);

    for (const dependent of dependents) {
      const depsData: Record<string, unknown> = {};
      if (dependent.dependencies) {
        for (const depName of dependent.dependencies) {
          if (results[depName] !== undefined) {
            depsData[depName] = results[depName];
          } else {
            const depTask = this.tasks.get(depName);
            if (depTask) {
              const depResult = await depTask.execute(ctx, {});
              if (depResult.data !== undefined) {
                results[depName] = depResult.data;
                depsData[depName] = depResult.data;
              }
            }
          }
        }
      }

      const depResult = await dependent.execute(ctx, depsData);
      if (depResult.data !== undefined) {
        results[dependent.name] = depResult.data;
      }
    }

    this.options.onBuildComplete?.();
  }

  private getDependentTasks(taskName: string): BuildTask[] {
    const dependents: BuildTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.dependencies?.includes(taskName)) {
        dependents.push(task);
      }
    }

    return dependents;
  }

  private getTopologicalOrder(): BuildTask[] {
    const visited = new Set<string>();
    const result: BuildTask[] = [];
    const visiting = new Set<string>();

    const visit = (taskName: string) => {
      if (visited.has(taskName)) return;
      if (visiting.has(taskName)) {
        throw new Error(`Circular dependency detected: ${taskName}`);
      }

      const task = this.tasks.get(taskName);
      if (!task) {
        throw new Error(`Task not found: ${taskName}`);
      }

      visiting.add(taskName);

      if (task.dependencies) {
        for (const depName of task.dependencies) {
          visit(depName);
        }
      }

      visiting.delete(taskName);
      visited.add(taskName);
      result.push(task);
    };

    for (const taskName of this.tasks.keys()) {
      visit(taskName);
    }

    return result;
  }
}
