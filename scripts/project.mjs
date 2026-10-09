import { spawn, spawnSync } from "node:child_process";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  unlink,
} from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnvironment, loadConfig } from "../server/config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const runDir = path.join(root, ".run");
const pidFile = path.join(runDir, "server.json");
const serverFile = path.join(root, "server.mjs");
const projectId = createHash("sha256")
  .update(path.resolve(root))
  .digest("hex")
  .slice(0, 16);
const command = process.argv[2] || "start";
const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function belongsToProject(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const result =
    process.platform === "win32"
      ? spawnSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); (Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
          ],
          { encoding: "utf8", windowsHide: true },
        )
      : spawnSync("ps", ["-p", String(pid), "-o", "args="], {
          encoding: "utf8",
        });
  return (
    result.status === 0 &&
    result.stdout
      .normalize("NFC")
      .toLowerCase()
      .includes(serverFile.normalize("NFC").toLowerCase())
  );
}

async function stop(config) {
  let record;
  try {
    record = JSON.parse(await readFile(pidFile, "utf8"));
  } catch {
    const current = await probe(config.port);
    if (
      current?.projectId === projectId &&
      (await belongsToProject(current.pid))
    )
      record = current;
    else {
      console.log("Nenhum servidor iniciado por este projeto foi encontrado.");
      return;
    }
  }
  if (record.projectId !== projectId || !(await belongsToProject(record.pid))) {
    console.log(
      "O registro anterior não corresponde a um servidor deste projeto. Nenhum processo foi encerrado.",
    );
    await unlink(pidFile).catch(() => {});
    return;
  }
  process.kill(record.pid, "SIGTERM");
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      process.kill(record.pid, 0);
    } catch {
      break;
    }
    await delay(150);
  }
  await unlink(pidFile).catch(() => {});
  console.log("Projeto parado. Seus dados foram preservados.");
}

async function installIfNeeded() {
  const lock = await readFile(path.join(root, "package-lock.json"));
  const digest = createHash("sha256").update(lock).digest("hex");
  const stamp = await readFile(
    path.join(runDir, "dependencies.sha256"),
    "utf8",
  ).catch(() => "");
  if (
    stamp === digest &&
    (await exists(path.join(root, "node_modules/mongodb/package.json")))
  )
    return;
  console.log(
    "Preparando as dependências do projeto. Isso só acontece na primeira abertura ou após uma atualização.",
  );
  const env = {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --use-system-ca`.trim(),
  };
  const result = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "npm",
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          "npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000",
        ]
      : ["ci", "--no-audit", "--no-fund"],
    { cwd: root, env, stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      "Não foi possível instalar as dependências. Confira a internet e execute Iniciar.cmd novamente.",
    );
  await writeFile(path.join(runDir, "dependencies.sha256"), digest);
}

async function start(config) {
  const current = await probe(config.port);
  if (current?.projectId === projectId) {
    if (await belongsToProject(current.pid))
      await writeFile(
        pidFile,
        JSON.stringify({ pid: current.pid, projectId, port: config.port }),
      );
    console.log(`O projeto já está aberto em http://127.0.0.1:${config.port}`);
    return;
  }
  if (current)
    throw new Error(
      `A porta ${config.port} está em uso por outro projeto. Altere PORT no .env.`,
    );
  await installIfNeeded();
  const out = openSync(path.join(runDir, "server.log"), "w");
  const err = openSync(path.join(runDir, "error.log"), "w");
  const child = spawn(process.execPath, [serverFile], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, err],
    env: {
      ...process.env,
      TZ: process.env.TZ || "America/Sao_Paulo",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --use-system-ca`.trim(),
    },
  });
  child.unref();
  closeSync(out);
  closeSync(err);
  await writeFile(
    pidFile,
    JSON.stringify({ pid: child.pid, projectId, port: config.port }),
  );
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await probe(config.port);
    if (status?.projectId === projectId) {
      console.log(`Site: http://127.0.0.1:${config.port}`);
      console.log(`Painel: http://127.0.0.1:${config.port}/admin`);
      console.log(
        config.mode !== "local"
          ? config.mode === "file"
            ? "Banco local persistente. Use seu usuário e senha do painel."
            : "Modo banco compartilhado. Use seu usuário e senha do painel."
          : "Modo demonstração local. Seus dados anteriores foram mantidos.",
      );
      return;
    }
    try {
      process.kill(child.pid, 0);
    } catch {
      break;
    }
    await delay(250);
  }
  const error = await readFile(path.join(runDir, "error.log"), "utf8").catch(
    () => "",
  );
  // Server messages are sanitized, but never print a possible credential URI.
  throw new Error(
    error.includes("EADDRINUSE")
      ? `A porta ${config.port} já está ocupada. Feche a versão anterior ou altere PORT no .env.`
      : "O servidor não iniciou. Confira .run/error.log e a configuração do arquivo .env.",
  );
}

try {
  await mkdir(runDir, { recursive: true });
  if (!(await exists(path.join(root, ".env"))))
    await copyFile(path.join(root, ".env.example"), path.join(root, ".env"));
  loadEnvironment();
  const config =
    command === "stop"
      ? { port: Number(process.env.PORT || 4173) }
      : loadConfig();
  if (!["start", "stop", "restart"].includes(command))
    throw new Error("Use start, stop ou restart.");
  if (command === "stop" || command === "restart") await stop(config);
  if (command !== "stop") await start(config);
  if (process.argv.includes("--open") && command !== "stop") {
    const url = `http://127.0.0.1:${config.port}`;
    if (process.platform === "win32")
      spawn(
        "powershell.exe",
        ["-NoProfile", "-Command", `Start-Process '${url}'`],
        { windowsHide: true, stdio: "ignore" },
      ).unref();
    else
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
        stdio: "ignore",
      }).unref();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
