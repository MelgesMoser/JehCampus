import { minutes, clock, dateKey } from "../utils/format.js";
export const STATUSES = [
  "Agendado",
  "Confirmado",
  "Em atendimento",
  "Concluído",
  "Cancelado",
  "Não compareceu",
];
export const occupies = (a) =>
  !["Cancelado", "Não compareceu"].includes(a.status);
export const overlaps = (a, b, c, d) => a < d && c < b;
export function available(
  db,
  service,
  date,
  time,
  excludeId = null,
  now = new Date(),
) {
  if (
    !service ||
    !service.active ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return false;
  const dt = new Date(date + "T12:00:00");
  if (Number.isNaN(+dt) || dateKey(dt) !== date) return false;
  const start = minutes(time),
    end = start + service.duration,
    h = db.settings.hours[dt.getDay()];
  if (
    !h?.open ||
    start < minutes(h.start) ||
    end > minutes(h.end) ||
    new Date(date + "T" + time) <= now
  )
    return false;
  if ((start - minutes(h.start)) % db.settings.slotInterval !== 0) return false;
  if (
    db.appointments.some(
      (a) =>
        a.id !== excludeId &&
        a.date === date &&
        occupies(a) &&
        overlaps(start, end, minutes(a.time), minutes(a.time) + a.duration),
    )
  )
    return false;
  return !db.blocks.some(
    (b) =>
      date >= b.startDate &&
      date <= b.endDate &&
      overlaps(start, end, minutes(b.startTime), minutes(b.endTime)),
  );
}
export function availableSlots(
  db,
  service,
  date,
  excludeId = null,
  now = new Date(),
) {
  const h = db.settings.hours[new Date(date + "T12:00:00").getDay()];
  if (!h?.open || !service) return [];
  const result = [];
  for (
    let t = minutes(h.start);
    t + service.duration <= minutes(h.end);
    t += db.settings.slotInterval
  ) {
    const time = clock(t);
    if (available(db, service, date, time, excludeId, now)) result.push(time);
  }
  return result;
}
