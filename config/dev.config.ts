import { extendConfig } from "#/build/utils/config-loader.ts";
import baseConfig from "./base.config.ts";

const config = extendConfig("dev", baseConfig, {
  scripts: {
    build: {
      source: {
        minify: false,
        sourcemap: true,
      },
    },
  },

  game: {
    poki: {
      debug: true,
    },
  },
});

export default config;
