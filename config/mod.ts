/**
 * Configuration loader
 * Exports the appropriate config based on CFG environment variable
 */

const mode = (process.env.CFG || "base") as "base" | "dev" | "prod";

let configModule: { default: any };
switch (mode) {
  case "dev":
    configModule = await import("./dev.config.ts");
    break;
  case "prod":
    configModule = await import("./prod.config.ts");
    break;
  default:
    configModule = await import("./base.config.ts");
}

export const config = configModule.default;
export type Config = typeof config;
