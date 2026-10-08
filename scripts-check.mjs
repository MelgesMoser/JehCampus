import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function scan(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = dir + "/" + f.name;
    if (f.isDirectory()) await scan(p);
    else if (p.endsWith(".js") || p.endsWith(".mjs")) {
      const r = spawnSync(process.execPath, ["--check", p], {
        encoding: "utf8",
      });
      if (r.status) {
        console.error(p, r.stderr);
        process.exitCode = 1;
      }
    }
  }
}
await scan("dist");
await scan("server");
await scan("scripts").catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
await scan("api");
const main = spawnSync(process.execPath, ["--check", "server.mjs"], {
  encoding: "utf8",
});
if (main.status) {
  console.error(main.stderr);
  process.exitCode = 1;
}
if (!process.exitCode)
  console.log("Sintaxe verificada no site, servidor e scripts.");
