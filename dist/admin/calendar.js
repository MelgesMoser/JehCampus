import { icon } from "../components/icons.js";
import { dateKey, dateLabel, addDays, esc, money } from "../utils/format.js";
import { status, empty } from "../components/ui.js";
export const agendaState = { view: "Semana", date: dateKey() };
function event(a, db) {
  const c = db.customers.find((c) => c.id === a.customerId);
  return `<button class="agenda-event ${a.status === "Cancelado" ? "cancelled" : ""}" data-appointment="${a.id}"><small>${a.time} · ${money(a.price)}</small><strong>${esc(c?.name)}</strong><span>${esc(a.serviceName)}</span>${status(a.status)}</button>`;
}
export function agendaPage(db) {
  const { view, date } = agendaState;
  let dates = [];
  const d = new Date(date + "T12:00:00");
  if (view === "Dia") dates = [date];
  else if (view === "Semana") {
    const start = addDays(date, -((d.getDay() + 6) % 7));
    dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  } else {
    const first = date.slice(0, 7) + "-01",
      offset = (new Date(first + "T12:00:00").getDay() + 6) % 7;
    dates = Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
  }
  return `<div class="page-toolbar"><div class="segmented" aria-label="Visualização da agenda">${["Dia", "Semana", "Mês"].map((v) => `<button data-view="${v}" class="${view === v ? "active" : ""}" aria-pressed="${view === v}">${v}</button>`).join("")}</div><div class="agenda-nav"><button class="icon-button" data-agenda-shift="-1" aria-label="Período anterior">${icon("chevronLeft")}</button><button id="agenda-today" class="button secondary small">Hoje</button><button class="icon-button" data-agenda-shift="1" aria-label="Próximo período">${icon("chevronRight")}</button><input type="date" id="agenda-date" value="${date}" aria-label="Data da agenda"></div></div><div class="agenda-period"><h3>${view === "Dia" ? dateLabel(date) : view === "Semana" ? `${new Date(dates[0] + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${dateLabel(dates[6])}` : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3><span class="muted">${db.appointments.filter((a) => dates.includes(a.date)).length} agendamentos</span></div><div class="agenda-scroll"><div class="agenda-grid agenda-${view === "Mês" ? "month" : view === "Semana" ? "week" : "day"}">${dates
    .map((key) => {
      const events = db.appointments
          .filter((a) => a.date === key)
          .sort((a, b) => a.time.localeCompare(b.time)),
        blocks = db.blocks.filter(
          (b) => key >= b.startDate && key <= b.endDate,
        ),
        day = new Date(key + "T12:00:00");
      return `<section class="agenda-cell ${key === dateKey() ? "is-today" : ""} ${key.slice(0, 7) !== date.slice(0, 7) && view === "Mês" ? "other-month" : ""}"><div class="agenda-day-heading"><span>${day.toLocaleDateString("pt-BR", { weekday: "short" })}</span><b>${day.getDate()}</b></div><button class="month-summary ${events.length ? "has-events" : " "}" data-day-view="${key}" aria-label="Ver ${dateLabel(key)}: ${events.length} agendamentos${blocks.length ? ", com bloqueio" : " "}">${events.length || (blocks.length ? "⊘" : "—")}</button>${blocks.map((b) => `<div class="agenda-block"><small>${b.allDay ? "Dia inteiro" : b.startTime + " – " + b.endTime}</small><strong>${icon("blocked")} ${esc(b.reason)}</strong></div>`).join("")}${events.map((a) => event(a, db)).join("")}${!events.length && !blocks.length ? `<span class="agenda-free">${db.settings.hours[day.getDay()].open ? "Sem agendamentos" : "Fechado"}</span>` : ""}</section>`;
    })
    .join("")}</div></div>`;
}
export function bindAgenda(render) {
  document.querySelectorAll("[data-day-view]").forEach(
    (button) =>
      (button.onclick = () => {
        agendaState.date = button.dataset.dayView;
        agendaState.view = "Dia";
        render();
      }),
  );
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        agendaState.view = b.dataset.view;
        render();
      }),
  );
  document.querySelector("#agenda-date").onchange = (e) => {
    if (e.target.value) {
      agendaState.date = e.target.value;
      render();
    }
  };
  document.querySelector("#agenda-today").onclick = () => {
    agendaState.date = dateKey();
    render();
  };
  document.querySelectorAll("[data-agenda-shift]").forEach(
    (b) =>
      (b.onclick = () => {
        if (agendaState.view === "Mês") {
          const d = new Date(agendaState.date.slice(0, 7) + "-01T12:00:00");
          d.setMonth(d.getMonth() + +b.dataset.agendaShift);
          agendaState.date = dateKey(d);
        } else
          agendaState.date = addDays(
            agendaState.date,
            +b.dataset.agendaShift * (agendaState.view === "Dia" ? 1 : 7),
          );
        render();
      }),
  );
}
