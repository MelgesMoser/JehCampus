import { loadConfig } from "../server/config.mjs";
import { createRuntime } from "../server/runtime.mjs";
import { createApi } from "../server/api.mjs";
process.env.TZ = "America/Sao_Paulo";
let handle;
export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!handle) {
    try {
      const config = loadConfig({ ...process.env, DATA_MODE: "mongodb" });
      const runtime = createRuntime(config);
      handle = createApi({
        config,
        getRepository: () => runtime.getRepository(),
      });
    } catch {
      res.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          error:
            "Configuração do servidor pendente. Verifique as variáveis de ambiente da Vercel.",
        }),
      );
      return;
    }
  }
  await handle(req, res, new URL(req.url, "https://localhost"));
}
