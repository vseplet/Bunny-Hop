/**
 * HTML Task
 */

import { writeTextFile } from "#/build/utils/fs.ts";
import { BaseTask, type TaskContext, type TaskResult } from "./base.ts";

export interface HtmlTaskConfig {
  output: string;
  title: string;
  gameConfig: unknown;
  liveReload?: boolean;
}

export class HtmlTask extends BaseTask {
  readonly name = "HTML";

  constructor(private config: HtmlTaskConfig) {
    super();
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    const startTime = performance.now();
    ctx.logger.start(this.name);

    return await this.safeExecute(ctx, async () => {
      const content = this.generateHtml({
        title: this.config.title,
        gameConfig: this.config.gameConfig,
        liveReload: this.config.liveReload,
        version: Date.now(),
      });

      await writeTextFile(this.config.output, content);

      const duration = Math.round(performance.now() - startTime);
      ctx.logger.success(this.name, `Generated ${this.config.output}`, duration);

      return { output: this.config.output };
    });
  }

  private generateHtml(config: {
    title: string;
    gameConfig: unknown;
    liveReload?: boolean;
    version: number;
  }): string {
    const liveReloadScript = config.liveReload
      ? `<script>
(function() {
  if (window.__WS_CONNECTION__) return;
  window.__WS_CONNECTION__ = true;

  var retryCount = 0;
  var ws = null;

  function connect() {
    if (ws) {
      ws.close();
      ws = null;
    }

    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host + '/__reload');

    ws.onopen = function() {
      retryCount = 0;
    };

    ws.onmessage = function(e) {
      if (e.data === 'reload') {
        ws.close();
        location.reload();
      }
    };

    ws.onclose = function() {
      ws = null;
      var delay = Math.min(1000 * Math.pow(2, retryCount++), 10000);
      setTimeout(connect, delay);
    };

    ws.onerror = function() {
      ws.close();
    };
  }

  connect();
})();
</script>`
      : "";

    const preventScrollScript = `<script>
// Prevent page scroll on arrow keys and space
window.addEventListener('keydown', function(ev) {
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) {
    ev.preventDefault();
  }
});
window.addEventListener('wheel', function(ev) {
  ev.preventDefault();
}, { passive: false });
</script>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${config.title}</title>
  <link rel="stylesheet" href="./style.css">
  <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>
  ${preventScrollScript}
</head>
<body>
  <div id="game-container"></div>
  <script>window.config = ${JSON.stringify(config.gameConfig)};</script>
  ${liveReloadScript}
  <script type="module" src="./game.js?v=${config.version}"></script>
</body>
</html>`;
  }
}
