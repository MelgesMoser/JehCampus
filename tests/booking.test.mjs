import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../dist/data/seed.js";
import { createServices } from "../dist/services/index.js";
import { available, availableSlots } from "../dist/services/availability.js";
const date = "2099-10-20";
function fixture() {
  let data = seed();
  data.appointments = [];
  data.customers = [];
  data.blocks = [];
  data.settings.hours.forEach((h) => (h.open = true));
  const repo = {
    read: () => structuredClone(data),
    async transaction(fn) {
      const draft = structuredClone(data);
      const result = fn(draft);
      data = draft;
      return structuredClone(result);
    },
    subscribe: () => () => {},
  };
  return { api: createServices(repo), read: repo.read };
}
const booking = (v = {}) => ({
  serviceId: "s1",
  date,
  time: "10:00",
  name: "Cliente de teste",
  phone: "11988887777",
  ...v,
});
test("vários serviços somam duração/valor, impedem sobreposição e preservam totais ao reagendar", async () => {
  const { api } = fixture();
  const selected = api.getServices().filter((s) => ["s1", "s3"].includes(s.id));
  const a = await api.createAppointment(booking({ serviceIds: ["s1", "s3"] }));
  assert.equal(
    a.duration,
    selected.reduce((n, s) => n + s.duration, 0),
  );
  assert.equal(
    a.price,
    selected.reduce((n, s) => n + s.price, 0),
  );
  assert.deepEqual(a.serviceIds, ["s1", "s3"]);
  await assert.rejects(
    api.createAppointment(booking({ time: "12:00" })),
    /disponível/,
  );
  await assert.rejects(api.deleteService("s3"), /futuros/);
  await api.updateService("s3", { price: 999, duration: 180 });
  const moved = await api.updateAppointment(a.id, { time: "13:00" });
  assert.equal(moved.price, a.price);
  assert.equal(moved.duration, a.duration);
  assert.deepEqual(moved.serviceIds, a.serviceIds);
  await assert.rejects(
    api.createAppointment(booking({ serviceIds: ["s1", "s1"] })),
    /encontrado/,
  );
});
test("reserva de 90 minutos bloqueia toda sobreposição, preservando a fronteira 11:30", async () => {
  const { api } = fixture();
  await api.createAppointment(booking());
  const slots = api.getAvailableSlots("s3", date);
  for (const t of ["09:30", "10:00", "10:30", "11:00"])
    assert.ok(!slots.includes(t), t);
  assert.ok(slots.includes("09:00"));
  assert.ok(slots.includes("11:30"));
});
test("confere novamente o horário no momento de salvar e não cria cliente em falha", async () => {
  const { api } = fixture();
  assert.ok(api.getAvailableSlots("s1", date).includes("10:00"));
  await api.createAppointment(booking());
  await assert.rejects(
    api.createAppointment(booking({ phone: "11977776666" })),
    /não está mais disponível/,
  );
  assert.equal(api.getCustomers().length, 1);
  assert.equal(api.getAppointments().length, 1);
});
test("duas tentativas consecutivas de reserva não duplicam a agenda", async () => {
  const { api } = fixture();
  const results = await Promise.allSettled([
    api.createAppointment(booking()),
    api.createAppointment(booking()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("cancelar libera o horário e reativação conflitante é rejeitada", async () => {
  const { api } = fixture();
  const a = await api.createAppointment(booking());
  await api.cancelAppointment(a.id);
  assert.ok(api.getAvailableSlots("s1", date).includes("10:00"));
  await api.createAppointment(booking());
  await assert.rejects(
    api.updateAppointment(a.id, { status: "Confirmado" }),
    /não está mais disponível/,
  );
});
test("reagendamento preserva valor e duração anteriores e libera intervalo antigo", async () => {
  const { api } = fixture();
  const a = await api.createAppointment(booking());
  await api.updateService("s1", { price: 999, duration: 120 });
  const updated = await api.updateAppointment(a.id, { time: "14:00" });
  assert.equal(updated.price, 65);
  assert.equal(updated.duration, 90);
  assert.ok(api.getAvailableSlots("s3", date).includes("10:00"));
  assert.ok(!api.getAvailableSlots("s3", date).includes("15:00"));
  assert.ok(api.getAvailableSlots("s3", date).includes("15:30"));
});
test("bloqueios parciais e dias inteiros removem horários e podem ser removidos", async () => {
  const { api } = fixture();
  const b = await api.createBlockedTime({
    reason: "Almoço",
    startDate: date,
    endDate: date,
    startTime: "12:00",
    endTime: "13:00",
  });
  const slots = api.getAvailableSlots("s1", date);
  assert.ok(!slots.includes("11:00"));
  assert.ok(!slots.includes("12:30"));
  assert.ok(slots.includes("13:00"));
  await api.deleteBlockedTime(b.id);
  assert.ok(api.getAvailableSlots("s1", date).includes("12:00"));
  await api.createBlockedTime({
    reason: "Fechado",
    startDate: date,
    endDate: date,
    allDay: true,
  });
  assert.deepEqual(api.getAvailableSlots("s1", date), []);
});
test("bloqueio não sobrepõe atendimento existente", async () => {
  const { api } = fixture();
  await api.createAppointment(booking());
  await assert.rejects(
    api.createBlockedTime({
      reason: "Compromisso",
      startDate: date,
      endDate: date,
      startTime: "11:00",
      endTime: "12:00",
    }),
    /Há agendamentos/,
  );
  assert.equal(api.getBlockedTimes().length, 0);
});
test("não permite ultrapassar fechamento ou reservar no passado", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.createAppointment(booking({ time: "17:00" })),
    /não está mais disponível/,
  );
  await assert.rejects(
    api.createAppointment(booking({ date: "2020-10-20" })),
    /não está mais disponível/,
  );
});
test("horários e intervalos configuráveis são respeitados", async () => {
  const { api, read } = fixture();
  const hours = read().settings.hours;
  hours.forEach((h) => {
    h.start = "10:00";
    h.end = "15:00";
  });
  await api.updateSettings({ hours, slotInterval: 20 });
  assert.deepEqual(api.getAvailableSlots("s2", date), [
    "10:00",
    "10:20",
    "10:40",
    "11:00",
    "11:20",
    "11:40",
    "12:00",
    "12:20",
    "12:40",
    "13:00",
  ]);
});
test("serviços suportam criar, alterar preço, desativar e excluir", async () => {
  const { api } = fixture();
  const s = await api.createService({
    name: "Novo serviço",
    description: "Descrição",
    category: "Teste",
    price: 40,
    duration: 30,
    active: true,
    image: "/assets/unhas.png",
  });
  await api.updateService(s.id, { price: 55 });
  assert.equal(api.getServices().find((x) => x.id === s.id).price, 55);
  await api.updateService(s.id, { active: false });
  assert.deepEqual(api.getAvailableSlots(s.id, date), []);
  await api.deleteService(s.id);
  assert.ok(!api.getServices().some((x) => x.id === s.id));
});
test("exclusão de serviço preserva histórico e permite atualizar status antigo", async () => {
  const { api } = fixture();
  const a = await api.createAppointment(booking());
  await assert.rejects(api.deleteService("s1"), /atendimentos futuros/);
  await api.cancelAppointment(a.id);
  await api.deleteService("s1");
  assert.equal(api.getAppointments()[0].serviceName, "Manicure & pedicure");
  await api.updateAppointment(a.id, { notes: "Registro preservado" });
  assert.equal(api.getAppointments()[0].notes, "Registro preservado");
});
test("todos os seis status podem ser atribuídos sem alterar os dados da reserva", async () => {
  const { api } = fixture();
  const a = await api.createAppointment(booking());
  for (const status of [
    "Confirmado",
    "Em atendimento",
    "Concluído",
    "Cancelado",
    "Não compareceu",
    "Agendado",
  ]) {
    const saved = await api.updateAppointment(a.id, { status });
    assert.equal(saved.status, status);
    assert.equal(saved.price, 65);
  }
});
test("valida telefone, duração e intervalos inválidos", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.createAppointment(booking({ phone: "123" })),
    /telefone válido/,
  );
  await assert.rejects(api.updateService("s1", { duration: 0 }), /duração/);
  await assert.rejects(api.updateSettings({ slotInterval: 0 }), /Intervalo/);
  await assert.rejects(
    api.createBlockedTime({
      reason: "Inválido",
      startDate: date,
      endDate: date,
      startTime: "15:00",
      endTime: "14:00",
    }),
    /intervalo/,
  );
});
test("galeria e configurações são salvas pela camada de serviços", async () => {
  const { api, read } = fixture();
  const g = await api.createGalleryItem({
    image: "/assets/unhas.png",
    description: "Novo trabalho",
    category: "Unhas",
  });
  assert.ok(read().gallery.some((x) => x.id === g.id));
  await api.deleteGalleryItem(g.id);
  assert.ok(!read().gallery.some((x) => x.id === g.id));
  await api.updateSettings({ name: "Nome editado" });
  assert.equal(read().settings.name, "Nome editado");
});
test("excluir atendimento remove do histórico e libera a disponibilidade", async () => {
  const { api } = fixture();
  const a = await api.createAppointment(booking());
  await api.deleteAppointment(a.id);
  assert.equal(api.getAppointments().length, 0);
  assert.ok(api.getAvailableSlots("s1", date).includes("10:00"));
});
test("fechamento semanal e data inexistente não oferecem horários", () => {
  const { read } = fixture();
  const db = read();
  db.settings.hours[new Date(date + "T12:00:00").getDay()].open = false;
  assert.deepEqual(availableSlots(db, db.services[0], date), []);
  assert.equal(available(db, db.services[0], "2099-02-31", "10:00"), false);
});
