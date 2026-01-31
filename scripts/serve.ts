/**
 * Development Server (Bun version)
 * With WebSocket support for live reload
 */

import { consola } from "consola";

export interface ServerOptions {
  port?: number;
  root?: string;
}

const wsClients = new Set<{ send: (data: string) => void }>();

export function triggerReload() {
  for (const ws of wsClients) {
    try {
      ws.send("reload");
    } catch {
      wsClients.delete(ws);
    }
  }
}

export async function startServer(options: ServerOptions = {}) {
  const root = options.root || "./target";
  const port = options.port || 8000;

  try {
    const server = Bun.serve({
      port,
      async fetch(req, server) {
        const url = new URL(req.url);
        let pathname = url.pathname;

        // WebSocket upgrade for live reload
        if (pathname === "/__reload") {
          const upgraded = server.upgrade(req);
          if (upgraded) return undefined;
          return new Response("WebSocket upgrade failed", { status: 500 });
        }

        if (pathname === "/" || pathname === "") {
          pathname = "/index.html";
        }

        const filePath = `${root}${pathname}`;
        const file = Bun.file(filePath);

        if (await file.exists()) {
          return new Response(file);
        }

        const indexFile = Bun.file(`${root}/index.html`);
        if (await indexFile.exists()) {
          return new Response(indexFile);
        }

        return new Response("Not Found", { status: 404 });
      },
      websocket: {
        open(ws) {
          wsClients.add(ws);
        },
        close(ws) {
          wsClients.delete(ws);
        },
        message() {
          // No messages expected from client
        },
      },
    });

    consola.box(`Server running at http://localhost:${server.port}`);

    return server;
  } catch (error) {
    consola.error(`Failed to start server on port ${port}. Is it already in use?`);
    throw error;
  }
}

if (import.meta.main) {
  startServer();
}
