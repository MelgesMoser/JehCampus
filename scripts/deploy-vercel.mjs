import { spawn } from "node:child_process";
import { loadEnvironment, loadConfig } from "../server/config.mjs";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
loadEnvironment();
const config = loadConfig();
if (config.mode !== "mongodb")
  throw new Error("Configure DATA_MODE=mongodb antes de publicar.");
function cli(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "vercel", ...args, "--scope", "melgesmoser"],
      {
        shell: process.platform === "win32",
        env: { ...process.env, NODE_OPTIONS: "--use-system-ca" },
        stdio: input === undefined ? "inherit" : ["pipe", "pipe", "pipe"],
      },
    );
    // Secrets only travel over stdin; never include them in arguments or logs.
    if (input !== undefined) child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Vercel não concluiu a etapa. Verifique login, permissões e projeto.",
            ),
          ),
    );
  });
}
try {
  await cli(["whoami"]);
  try {
    await readFile(".vercel/project.json");
  } catch {
    await cli(["link", "--yes", "--project", "jeh-campus"]);
  }
  const variables = {
    DATA_MODE: "mongodb",
    MONGODB_URI: config.uri,
    MONGODB_DATABASE: config.database,
    MONGODB_COLLECTION_PREFIX: config.prefix,
    ADMIN_USERNAME: config.username,
    ADMIN_PASSWORD: config.password,
    TZ: "America/Sao_Paulo",
  };
  for (const [name, value] of Object.entries(variables)) {
    await cli(
      [
        "env",
        "add",
        name,
        "production",
        "--force",
        "--yes",
        ...(name === "MONGODB_URI" || name === "ADMIN_PASSWORD"
          ? ["--sensitive"]
          : ["--no-sensitive"]),
      ],
      value,
    );
    console.log(name + ": configurado na Vercel");
  }
  await cli(["deploy", "--prod", "--yes"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
