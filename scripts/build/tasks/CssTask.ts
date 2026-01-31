/**
 * CSS Task
 */

import { writeTextFile } from "#/build/utils/fs.ts";
import { BaseTask, type TaskContext, type TaskResult } from "./base.ts";

export interface CssTaskConfig {
  output: string;
  backgroundColor: string;
  minify?: boolean;
}

export class CssTask extends BaseTask {
  readonly name = "CSS";

  constructor(private config: CssTaskConfig) {
    super();
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    const startTime = performance.now();
    ctx.logger.start(this.name);

    return await this.safeExecute(ctx, async () => {
      const css = this.generateCss();
      const content = this.config.minify ? this.minify(css) : css;

      await writeTextFile(this.config.output, content);

      const duration = Math.round(performance.now() - startTime);
      ctx.logger.success(this.name, `Generated ${this.config.output}`, duration);

      return { output: this.config.output };
    });
  }

  private generateCss(): string {
    return `
@font-face {
  font-family: 'Jersey 10';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('./assets/fonts/Jersey10.ttf') format('truetype');
}

html, body {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  position: fixed;
  overflow: hidden;
  background-color: ${this.config.backgroundColor};
  font-family: 'Jersey 10', Arial, sans-serif;
}

body {
  display: flex;
  justify-content: center;
  align-items: center;
}

#game-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  display: block;
  outline: none;
}
`.trim();
  }

  private minify(input: string): string {
    return input
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{};:,>~+])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  }
}
