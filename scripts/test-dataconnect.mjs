// Explicit integration test. Uses an isolated row, never the salon's live row.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DataConnectRepository } from "../server/dataConnectRepository.mjs";
import { DataConnectTransport } from "../server/dataConnectTransport.mjs";
import { loadConfig, loadEnvironment } from "../server/config.mjs";
import { availableSlots } from "../dist/services/availability.js";

loadEnvironment();
const config = loadConfig();
if (config.mode !== "dataconnect")
  throw new Error("Configure DATA_MODE=dataconnect.");
const stateId = `test-${randomUUID()}`;
const testConfig = { ...config, dataConnectStateId: stateId };
const transport = new DataConnectTransport(config);
try {
  const a = await new DataConnectRepository(testConfig).connect();
  const b = await new DataConnectRepository(testConfig).connect();
  assert.equal((await a.snapshot()).appointments.length, 0);
  const original = (await a.snapshot()).services[0];
  const created = await a.execute("createService", [
    { ...original, name: "Teste remoto isolado", price: 30, duration: 30 },
  ]);
  await b.execute("updateService", [created.id, { ...created, price: 35 }]);
  assert.equal(
    (await a.snapshot()).services.find((x) => x.id === created.id).price,
    35,
  );
  await a.execute("deleteService", [created.id]);
  assert.ok(!(await b.snapshot()).services.some((x) => x.id === created.id));
  const booking = {
    serviceId: "s1",
    name: "Teste remoto isolado",
    phone: "11999990000",
    date: "2099-10-20",
    time: "10:00",
  };
  const request = "test-" + randomUUID();
  const results = await Promise.allSettled([
    a.execute("createAppointment", [booking], request),
    b.execute(
      "createAppointment",
      [{ ...booking, time: "10:30" }],
      "other-" + request,
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const appointment = (await a.snapshot()).appointments[0];
  await a.execute("updateAppointment", [
    appointment.id,
    { time: "14:00", status: "Confirmado" },
  ]);
  assert.equal((await b.snapshot()).appointments[0].time, "14:00");
  assert.equal((await b.snapshot()).appointments[0].status, "Confirmado");
  const block = await b.execute("createBlockedTime", [
    {
      startDate: booking.date,
      endDate: booking.date,
      startTime: "10:00",
      endTime: "11:30",
      reason: "Teste isolado",
      allDay: false,
    },
  ]);
  const blocked = await a.snapshot();
  assert.ok(
    !availableSlots(blocked, blocked.services[0], booking.date).includes(
      "10:00",
    ),
  );
  await assert.rejects(() =>
    a.execute("createAppointment", [booking], "blocked-" + request),
  );
  await a.execute("deleteBlockedTime", [block.id]);
  await b.execute("cancelAppointment", [appointment.id]);
  assert.equal((await a.snapshot()).appointments[0].status, "Cancelado");
  await a.execute("deleteAppointment", [appointment.id]);
  assert.equal((await b.snapshot()).appointments.length, 0);
  await a.saveSession("integration", new Date(Date.now() + 60000));
  assert.equal(await b.hasSession("integration"), true);
  await a.deleteSession("integration");
  assert.equal(await b.hasSession("integration"), false);
  const reconnect = await new DataConnectRepository(testConfig).connect();
  assert.ok((await reconnect.snapshot()).revision > 1);
  console.log(
    "PASS: CRUD, preço, persistência entre conexões, concorrência, reagendamento, status, bloqueios e sessões no PostgreSQL remoto.",
  );
} finally {
  // Exact generated IDs: only data created by this test is removed.
  await transport.execute(
    "mutation CleanTest($id: String!) { salonState_delete(key: {id: $id}) }",
    { id: stateId },
  );
  await transport.execute(
    "mutation CleanSession($id: String!) { salonSession_delete(key: {id: $id}) }",
    { id: `${stateId}:integration` },
  );
}
