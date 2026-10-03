import {
  available,
  availableSlots,
  occupies,
  overlaps,
  STATUSES,
} from "./availability.js";
import { minutes, dateKey, digits } from "../utils/format.js";
const id = () => crypto.randomUUID();
const required = (v, label) => {
  const s = String(v ?? "").trim();
  if (!s) throw Error(`${label} é obrigatório.`);
  return s;
};
const imageOk = (v) =>
  !v ||
  /^(\/assets\/[^.][^]*|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/.test(
    v,
  );
function validateService(v) {
  v.name = required(v.name, "Nome");
  v.description = required(v.description, "Descrição");
  v.category = required(v.category, "Categoria");
  v.price = Number(v.price);
  v.duration = Number(v.duration);
  if (!Number.isFinite(v.price) || v.price < 0)
    throw Error("Informe um preço válido.");
  if (!Number.isInteger(v.duration) || v.duration < 5 || v.duration > 720)
    throw Error("A duração deve ser de 5 a 720 minutos.");
  if (!imageOk(v.image)) throw Error("Use uma imagem local válida.");
  v.active = !!v.active;
  return v;
}
function validateCustomer(v) {
  const name = required(v.name, "Nome"),
    phone = digits(v.phone);
  if (name.length < 2) throw Error("Informe o nome completo.");
  if (!/^\d{10,13}$/.test(phone))
    throw Error("Informe um telefone válido com DDD.");
  return { name, phone };
}
export function createServices(repository) {
  const read = () => repository.read();
  const find = (db, collection, key) => {
    const item = db[collection].find((x) => x.id === key);
    if (!item) throw Error("Registro não encontrado. Atualize a página.");
    return item;
  };
  const saveBooking = (db, v, existing) => {
    const stored = db.services.find((s) => s.id === v.serviceId);
    const service =
      stored ||
      (existing?.serviceId === v.serviceId
        ? {
            id: existing.serviceId,
            name: existing.serviceName,
            price: existing.price,
            duration: existing.duration,
            active: false,
          }
        : null);
    if (!service) throw Error("Serviço não encontrado.");
    const profile = validateCustomer(v);
    const status = v.status || existing?.status || "Agendado";
    if (!STATUSES.includes(status)) throw Error("Status inválido.");
    const unchanged =
      existing &&
      existing.serviceId === v.serviceId &&
      existing.date === v.date &&
      existing.time === v.time;
    const sameService = existing && existing.serviceId === v.serviceId;
    const snapshot = sameService
      ? {
          ...service,
          duration: existing.duration,
          active: unchanged || service.active,
        }
      : service;
    if (
      occupies({ status }) &&
      (!unchanged || !occupies(existing)) &&
      !available(db, snapshot, v.date, v.time, existing?.id)
    )
      throw Error(
        "Este horário não está mais disponível. Escolha outro horário.",
      );
    if (!unchanged && !service.active)
      throw Error("Este serviço está inativo.");
    let customer = db.customers.find((c) => c.phone === profile.phone);
    if (!customer) {
      customer = { id: id(), ...profile };
      db.customers.push(customer);
    } else {
      customer.name = profile.name;
    }
    const record = {
      id: existing?.id || id(),
      customerId: customer.id,
      serviceId: service.id,
      serviceName: sameService ? existing.serviceName : service.name,
      price: sameService ? existing.price : service.price,
      duration: sameService ? existing.duration : service.duration,
      date: required(v.date, "Data"),
      time: required(v.time, "Horário"),
      status,
      notes: String(v.notes || "").trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (existing) Object.assign(existing, record);
    else db.appointments.push(record);
    return record;
  };
  return {
    getSnapshot: read,
    subscribe: (fn) => repository.subscribe(fn),
    getServices: () => read().services,
    createService: (v) =>
      repository.transaction((db) => {
        const s = { ...validateService({ ...v }), id: id() };
        db.services.push(s);
        return s;
      }),
    updateService: (key, v) =>
      repository.transaction((db) => {
        const s = find(db, "services", key);
        Object.assign(s, validateService({ ...s, ...v }));
        return s;
      }),
    deleteService: (key) =>
      repository.transaction((db) => {
        find(db, "services", key);
        if (
          db.appointments.some(
            (a) =>
              a.serviceId === key &&
              a.date >= dateKey() &&
              occupies(a) &&
              a.status !== "Concluído",
          )
        )
          throw Error(
            "Este serviço possui atendimentos futuros. Desative-o ou cancele/reagende os atendimentos antes de excluir.",
          );
        db.services = db.services.filter((s) => s.id !== key);
        return { id: key };
      }),
    getAppointments: () => read().appointments,
    getCustomers: () => read().customers,
    getAvailableSlots: (serviceId, date, excludeId) => {
      const db = read();
      let service = db.services.find((s) => s.id === serviceId);
      const old = db.appointments.find((a) => a.id === excludeId);
      if (old?.serviceId === serviceId)
        service = { ...service, duration: old.duration };
      return availableSlots(db, service, date, excludeId);
    },
    createAppointment: (v) =>
      repository.transaction((db) => saveBooking(db, v)),
    updateAppointment: (key, v) =>
      repository.transaction((db) => {
        const old = find(db, "appointments", key);
        const c = find(db, "customers", old.customerId);
        return saveBooking(
          db,
          { ...old, name: c.name, phone: c.phone, ...v },
          old,
        );
      }),
    cancelAppointment: (key) =>
      repository.transaction((db) => {
        const a = find(db, "appointments", key);
        a.status = "Cancelado";
        return a;
      }),
    deleteAppointment: (key) =>
      repository.transaction((db) => {
        find(db, "appointments", key);
        db.appointments = db.appointments.filter((a) => a.id !== key);
        return { id: key };
      }),
    getBlockedTimes: () => read().blocks,
    createBlockedTime: (v) =>
      repository.transaction((db) => {
        const b = {
          id: id(),
          reason: required(v.reason, "Motivo"),
          startDate: v.startDate,
          endDate: v.endDate,
          startTime: v.allDay ? "00:00" : v.startTime,
          endTime: v.allDay ? "23:59" : v.endTime,
          allDay: !!v.allDay,
        };
        for (const d of [b.startDate, b.endDate])
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
            dateKey(new Date(d + "T12:00:00")) !== d
          )
            throw Error("Informe datas válidas.");
        if (b.endDate < b.startDate)
          throw Error("A data final deve ser igual ou posterior à inicial.");
        if (
          ![b.startTime, b.endTime].every((t) =>
            /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
          ) ||
          minutes(b.endTime) <= minutes(b.startTime)
        )
          throw Error("Informe um intervalo de horas válido.");
        if (
          db.appointments.some(
            (a) =>
              occupies(a) &&
              a.date >= b.startDate &&
              a.date <= b.endDate &&
              overlaps(
                minutes(a.time),
                minutes(a.time) + a.duration,
                minutes(b.startTime),
                minutes(b.endTime),
              ),
          )
        )
          throw Error(
            "Há agendamentos nesse período. Cancele ou reagende esses atendimentos antes de bloquear.",
          );
        db.blocks.push(b);
        return b;
      }),
    deleteBlockedTime: (key) =>
      repository.transaction((db) => {
        db.blocks = db.blocks.filter((b) => b.id !== key);
        return { id: key };
      }),
    createGalleryItem: (v) =>
      repository.transaction((db) => {
        if (!v.image || !imageOk(v.image))
          throw Error("Selecione uma foto válida.");
        const g = {
          id: id(),
          image: v.image,
          description: required(v.description, "Descrição"),
          category: required(v.category, "Categoria"),
        };
        db.gallery.push(g);
        return g;
      }),
    deleteGalleryItem: (key) =>
      repository.transaction((db) => {
        db.gallery = db.gallery.filter((g) => g.id !== key);
        return { id: key };
      }),
    updateSettings: (v) =>
      repository.transaction((db) => {
        const s = { ...db.settings, ...v };
        required(s.name, "Nome do salão");
        if (![15, 20, 30, 60].includes(+s.slotInterval))
          throw Error("Intervalo inválido.");
        s.slotInterval = +s.slotInterval;
        if (!imageOk(s.logo)) throw Error("Logo inválido.");
        if (s.whatsapp && !/^\d{10,13}$/.test(digits(s.whatsapp)))
          throw Error("Informe um WhatsApp válido com DDD.");
        if (s.instagram && !/^[a-zA-Z0-9_.]+$/.test(s.instagram))
          throw Error("Informe apenas o usuário do Instagram, sem @ ou link.");
        for (const h of s.hours) {
          if (
            h.open &&
            (![h.start, h.end].every((t) =>
              /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
            ) ||
              minutes(h.end) <= minutes(h.start))
          )
            throw Error("Revise os horários de funcionamento.");
        }
        db.settings = s;
        return s;
      }),
    exportData: () => JSON.stringify(read(), null, 2),
  };
}
