#!/usr/bin/env bun
/**
 * Bunny Hop Build CLI
 */

import { consola } from "consola";

const args = process.argv.slice(2);
const command = args[0];
const flags = {
  verbose: args.includes("--verbose") || args.includes("-v"),
  help: args.includes("--help") || args.includes("-h"),
};

function showHelp() {
  console.log(`
  Bunny Hop CLI

  Usage: bun run <command>

  Commands:
    dev         Start development server with watch & live reload
    prod        Build for production
    preview     Build production and preview locally
    bundle      Build production and create zip archive

  Options:
    -v, --verbose   Verbose output
    -h, --help      Show this help
`);
}

async function startServer(port = 8000) {
  const { startServer } = await import("#/serve.ts");
  await startServer({ port });
}

async function runBuild(
  mode: "dev" | "prod",
  options: { watch?: boolean; liveReload?: boolean } = {}
): Promise<boolean> {
  process.env.CFG = mode;

  const { config } = await import("@/config");
  const { BuildPipeline } = await import("#/build/pipeline.ts");
  const { CleanTask, CopyTask, CssTask, HtmlTask, SourceTask } = await import(
    "#/build/tasks/mod.ts"
  );

  const isDev = mode === "dev";
  const buildConfig = config.data.scripts.build;

  let triggerReload: (() => void) | undefined;
  if (options.liveReload) {
    const serve = await import("#/serve.ts");
    triggerReload = serve.triggerReload;
  }

  const pipeline = new BuildPipeline({
    isDev,
    verbose: flags.verbose,
    onBuildComplete: triggerReload,
  });

  pipeline.registerAll(
    new CleanTask({ targetDir: buildConfig.targetDir }),
    new CopyTask({
      models: buildConfig.assets.models,
      textures: buildConfig.assets.textures,
      fonts: buildConfig.assets.fonts,
    }),
    new SourceTask(buildConfig.source),
    new HtmlTask({
      output: buildConfig.html.output,
      title: buildConfig.html.title,
      gameConfig: config.data.game,
      liveReload: options.liveReload,
    }),
    new CssTask({
      output: buildConfig.css.output,
      backgroundColor: buildConfig.css.backgroundColor,
      minify: !isDev,
    })
  );

  if (options.watch) {
    await pipeline.watch();
    return true;
  }
  return await pipeline.run();
}

async function createBundle() {
  const { mkdirSync, existsSync } = await import("node:fs");

  await runBuild("prod");

  const bundlesDir = "./bundles";
  if (!existsSync(bundlesDir)) {
    mkdirSync(bundlesDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const zipName = `${dateStr}.zip`;
  const zipPath = `${bundlesDir}/${zipName}`;

  consola.start("Creating bundle archive...");

  const proc = Bun.spawn(["zip", "-r", `../bundles/${zipName}`, "."], {
    cwd: "./target",
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create zip: ${stderr}`);
  }

  const stats = await Bun.file(zipPath).stat();
  const sizeKb = Math.round((stats?.size || 0) / 1024);

  consola.success(`Bundle created: ${zipPath} (${sizeKb} KB)`);
}

async function main() {
  if (flags.help || !command) {
    showHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "dev":
        // Development: watch + live reload + server
        startServer();
        await runBuild("dev", { watch: true, liveReload: true });
        break;

      case "prod": {
        const success = await runBuild("prod");
        process.exit(success ? 0 : 1);
        break;
      }

      case "preview":
        // Build prod and serve
        await runBuild("prod");
        await startServer();
        break;

      case "bundle":
        // Build prod and zip
        await createBundle();
        break;

      default:
        consola.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    consola.error(error);
    process.exit(1);
  }
}

main();
