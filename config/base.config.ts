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
      far: 100,
      position: { x: 0, y: 0, z: 5 },
      landscape: { distance: 4, height: 2.5 },
      portrait: { distance: 8, height: 5 },
    },

    scale: {
      landscape: { width: 1280, height: 720 },
      portrait: { width: 720, height: 1280 },
    },

    physics: {
      gravity: 30,
      moveSpeed: 7,
      turnSpeed: 1.5,
      jumpForce: 14,
      jumpCut: 0.4,
    },

    platforms: {
      start: { width: 6, height: 1, depth: 10 },
      tutorial: { count: 5, gap: 5, size: 3 },
      main: { count: 95 },
    },

    recordLight: {
      intensity: 15,
      distance: 30,
      orbitRadius: 2.5,
      orbitSpeed: 2,
      sphereRadius: 0.4,
    },

    poki: {
      enabled: true,
      debug: true,
    },
  },
});

export default config;
export type ConfigType = typeof config;
