import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "../server.mjs";

test("abrir ou recarregar rotas públicas e administrativas serve a aplicação", async () => {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of [
      "/",
      "/agendar",
      "/admin",
      "/admin/agenda",
      "/admin/agendamentos",
      "/admin/clientes",
      "/admin/servicos",
      "/admin/galeria",
      "/admin/bloqueios",
      "/admin/configuracoes",
    ]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), /text\/html/, route);
      assert.match(await response.text(), /id="app"/, route);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("arquivos recebem MIME correto e recursos inexistentes retornam 404", async () => {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base + "/admin/index.js");
    assert.match(response.headers.get("content-type"), /text\/javascript/);
    assert.equal(response.status, 200);
    assert.equal((await fetch(base + "/assets/inexistente.png")).status, 404);
    assert.match(
      (await fetch(base + "/styles.css")).headers.get("content-type"),
      /text\/css/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
