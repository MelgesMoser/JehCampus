import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createApi } from "./server/api.mjs";
import { loadEnvironment, loadConfig } from "./server/config.mjs";
import { createRuntime } from "./server/runtime.mjs";

const filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(filename), "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

export function createServer(options = {}) {
  const config = {
    ...(options.config || { mode: "local", password: "", origin: "" }),
    projectId: createHash("sha256")
      .update(path.dirname(filename))
      .digest("hex")
      .slice(0, 16),
  };
  const runtime = options.runtime || createRuntime(config);
  const handleApi = createApi({
    config,
    getRepository: () => runtime.getRepository(),
  });
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("X-Frame-Options", "DENY");
      if (await handleApi(req, res, url)) return;
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      if (
        decodeURIComponent(url.pathname)
          .split("/")
          .some((part) => part.startsWith("."))
      ) {
        res.writeHead(404);
        return res.end();
      }
      let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403);
        return res.end();
      }
      try {
        // /admin is both a client-side route and a source directory.
        if ((await stat(file)).isDirectory())
          file = path.join(root, "index.html");
      } catch {
        if (path.extname(file)) {
          res.writeHead(404);
          return res.end("Não encontrado");
        }
        file = path.join(root, "index.html");
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end("Erro ao carregar o arquivo");
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  try {
    loadEnvironment();
    const config = loadConfig();
    const runtime = createRuntime(config);
    const server = createServer({ config, runtime });
    server.listen(config.port, config.host, () => {
      console.log(`Espaço Jeh Campus: http://${config.host}:${config.port}`);
      console.log(
        config.mode === "mongodb"
          ? "Armazenamento: MongoDB. Conexão validada ao carregar os dados."
          : "Armazenamento: demonstração local.",
      );
    });
    process.on("SIGINT", () =>
      server.close(async () => {
        await runtime.close();
        process.exit(0);
      }),
    );
    process.on("SIGTERM", () =>
      server.close(async () => {
        await runtime.close();
        process.exit(0);
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
