import { dateKey, addDays } from "../utils/format.js";
export function calendar(month, selected, db, service) {
  const first = new Date(month + "-01T12:00:00"),
    length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    offset = (first.getDay() + 6) % 7;
  return `<div class="calendar"><div class="calendar-heading"><button type="button" class="icon-button" data-month="-1" aria-label="Mês anterior">‹</button><h3>${first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3><button type="button" class="icon-button" data-month="1" aria-label="Próximo mês">›</button></div><div class="calendar-grid">${["S", "T", "Q", "Q", "S", "S", "D"].map((d) => `<span class="weekday">${d}</span>`).join("")}${Array.from({ length: offset }, () => "<span></span>").join("")}${Array.from(
    { length },
    (_, i) => {
      const key = addDays(dateKey(first), i),
        h = db.settings.hours[new Date(key + "T12:00:00").getDay()],
        closed =
          key < dateKey() ||
          !h.open ||
          db.blocks.some(
            (b) => b.allDay && key >= b.startDate && key <= b.endDate,
          );
      return `<button type="button" data-date="${key}" class="calendar-day ${selected === key ? "selected" : ""} ${key === dateKey() ? "today" : ""}" ${closed ? "disabled" : ""} aria-label="${i + 1} de ${first.toLocaleDateString("pt-BR", { month: "long" })}" aria-pressed="${selected === key}">${i + 1}</button>`;
    },
  ).join("")}</div></div>`;
}
export function shiftMonth(month, by) {
  const d = new Date(month + "-01T12:00:00");
  d.setMonth(d.getMonth() + by);
  return dateKey(d).slice(0, 7);
}
