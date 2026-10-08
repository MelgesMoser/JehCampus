import { loadConfig } from "../server/config.mjs";
import { createRuntime } from "../server/runtime.mjs";
import { createApi } from "../server/api.mjs";
process.env.TZ = "America/Sao_Paulo";
const config = loadConfig({ ...process.env, DATA_MODE: "mongodb" });
const runtime = createRuntime(config);
const handle = createApi({
  config,
  getRepository: () => runtime.getRepository(),
});
export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  await handle(req, res, new URL(req.url, "https://localhost"));
}
