import test from "node:test";
import assert from "node:assert/strict";
import {
  DataConnectRepository,
  dcQueries,
} from "../server/dataConnectRepository.mjs";
import { loadConfig } from "../server/config.mjs";

function transport() {
  const rows = new Map(),
    sessions = new Map();
  return {
    rows,
    sessions,
    async execute(query, v) {
      // Yield allows independent repositories to race on a stale revision.
      await new Promise((resolve) => setImmediate(resolve));
      const row = rows.get(v.id);
      if (query === dcQueries.read)
        return { salonState: row ? structuredClone(row) : null };
      if (query === dcQueries.revision)
        return { salonState: row ? { revision: row.revision } : null };
      if (query === dcQueries.insert) {
        if (row) throw new Error("Duplicate");
        rows.set(v.id, { revision: 1, payload: v.payload });
        return {};
      }
      if (query === dcQueries.commit) {
        if (row.revision !== v.expected) return { changed: 0 };
        rows.set(v.id, { revision: v.next, payload: v.payload });
        return { changed: 1 };
      }
      if (query === dcQueries.session)
        return { salonSession: sessions.get(v.id) || null };
      if (query === dcQueries.saveSession) {
        sessions.set(v.id, { expiresAt: v.expiresAt });
        return {};
      }
      if (query === dcQueries.deleteSession) {
        sessions.delete(v.id);
        return {};
      }
      throw new Error("Unexpected query");
    },
  };
}

const booking = {
  serviceId: "s1",
  name: "Teste de concorrência",
  phone: "11999990000",
  date: "2099-10-20",
  time: "10:00",
};

test("Data Connect inicializa sem clientes fictícios e preserva alterações ao reconectar", async () => {
  const store = transport(),
    repo = await new DataConnectRepository({}, store).connect();
  assert.equal((await repo.snapshot()).appointments.length, 0);
  await repo.execute("updateService", [
    "s1",
    { ...(await repo.snapshot()).services[0], price: 77 },
  ]);
  const second = await new DataConnectRepository({}, store).connect();
  assert.equal((await second.snapshot()).services[0].price, 77);
});

test("Data Connect CAS rejeita sobreposição entre dois servidores", async () => {
  const store = transport();
  const a = await new DataConnectRepository({}, store).connect(),
    b = await new DataConnectRepository({}, store).connect();
  const results = await Promise.allSettled([
    a.execute("createAppointment", [booking], "a"),
    b.execute("createAppointment", [{ ...booking, time: "10:30" }], "b"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await a.snapshot()).appointments.length, 1);
});

test("Data Connect idempotência sobrevive a reconexões e sessões expiram", async () => {
  const store = transport(),
    a = await new DataConnectRepository({}, store).connect();
  const first = await a.execute("createAppointment", [booking], "same");
  const b = await new DataConnectRepository({}, store).connect();
  assert.equal(
    (await b.execute("createAppointment", [booking], "same")).id,
    first.id,
  );
  assert.equal((await b.snapshot()).appointments.length, 1);
  await a.saveSession("session", new Date(Date.now() + 60000));
  assert.equal(await b.hasSession("session"), true);
  await b.deleteSession("session");
  assert.equal(await a.hasSession("session"), false);
  await a.saveSession("expired", new Date(Date.now() - 1000));
  assert.equal(await a.hasSession("expired"), false);
});

test("configuração Data Connect exige identificação real e senha administrativa", () => {
  const env = {
    DATA_MODE: "dataconnect",
    FIREBASE_PROJECT_ID: "jehcampus-bd",
    DATA_CONNECT_LOCATION: "southamerica-east1",
    DATA_CONNECT_SERVICE: "jehcampus-bd-service",
    ADMIN_PASSWORD: "test-password-123",
    DATA_CONNECT_AUTH: "firebase-cli",
  };
  assert.equal(loadConfig(env).mode, "dataconnect");
  assert.throws(() => loadConfig({ ...env, ADMIN_PASSWORD: "" }));
  assert.throws(() => loadConfig({ ...env, DATA_CONNECT_SERVICE: "" }));
  assert.throws(() =>
    loadConfig({
      ...env,
      HOST: "0.0.0.0",
      PUBLIC_ORIGIN: "https://example.com",
    }),
  );
});
