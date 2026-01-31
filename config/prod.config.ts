import { extendConfig } from "#/build/utils/config-loader.ts";
import baseConfig from "./base.config.ts";

const config = extendConfig("prod", baseConfig, {
  scripts: {
    build: {
      source: {
        minify: true,
        sourcemap: false,
      },
    },
  },

  game: {
    poki: {
      debug: false,
    },
  },
});

export default config;
