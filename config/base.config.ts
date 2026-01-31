import { createConfig } from "#/build/utils/config-loader.ts";

const config = createConfig("base", {
  scripts: {
    build: {
      targetDir: "./target",

      // ===== ASSETS =====
      assets: {
        models: {
          sources: ["./assets/models"],
          output: "./target/assets/models",
        },

        textures: {
          sources: ["./assets/textures"],
          output: "./target/assets/textures",
        },

        fonts: {
          sources: ["./assets/fonts"],
          output: "./target/assets/fonts",
        },
      },

      // ===== SOURCE =====
      source: {
        entryPoints: ["./source/main.ts"],
        outdir: "./target",
        watchPaths: ["./source/", "./config/", "./keys/"],
        minify: false,
        sourcemap: true,
      },

      // ===== HTML =====
      html: {
        output: "./target/index.html",
        title: "Bunny Hop",
      },

      // ===== CSS =====
      css: {
        output: "./target/style.css",
        backgroundColor: "#000000",
      },
    },

    serve: {
      root: "./target",
    },
  },

  game: {
    title: "Bunny Hop",
    version: "0.1.0",

    renderer: {
      antialias: true,
      alpha: false,
    },

    camera: {
      fov: 75,
      near: 0.1,
      far: 1000,
      position: { x: 0, y: 0, z: 5 },
    },

    poki: {
      enabled: true,
      debug: true,
    },
  },
});

export default config;
export type ConfigType = typeof config;
