import { api, connectionState } from "../services/index.js";
import { brand, toast } from "../components/ui.js";
import { calendar, shiftMonth } from "../components/calendar.js";
import {
  dateKey,
  dateLabel,
  money,
  esc,
  imageSrc,
  clock,
  minutes,
} from "../utils/format.js";
let state;
export function resetBooking() {
  const selected = new URLSearchParams(location.search).get("servico");
  state = {
    step: selected ? 1 : 0,
    serviceId: selected || "",
    month: dateKey().slice(0, 7),
    date: "",
    time: "",
    name: "",
    phone: "",
    notes: "",
    consent: false,
    success: null,
  };
}
export function renderBooking() {
  if (!state) resetBooking();
  const db = api.getSnapshot(),
    s = db.settings,
    service = db.services.find((x) => x.id === state.serviceId && x.active);
  if (!service && !state.success) {
    state.step = 0;
    state.serviceId = "";
  }
  const steps = ["Serviço", "Data", "Horário", "Dados", "Confirmação"];
  document.querySelector("#app").innerHTML =
    `<header class="booking-header">${brand(s)}<a class="text-link" href="/">Voltar ao site</a></header><main class="booking-page">${state.success ? successView(state.success) : `<div class="booking-heading"><p class="eyebrow">UM TEMPO SÓ SEU</p><h1>Agende seu <em>momento.</em></h1><p>Escolha o cuidado. Nós cuidamos dos detalhes.</p></div><ol class="steps">${steps.map((x, i) => `<li class="${i === state.step ? "current" : i < state.step ? "complete" : ""}"><span>${i < state.step ? "✓" : i + 1}</span><b>${x}</b></li>`).join("")}</ol><div class="booking-layout"><section class="booking-panel"><div class="panel-intro"><p class="eyebrow">ETAPA ${state.step + 1} DE 5</p><h2>${["Qual cuidado combina com você?", "Escolha o melhor dia", "Um horário para o seu momento", "Vamos nos conhecer?", "Tudo pronto para o seu momento?"][state.step]}</h2></div>${stepView(db, service)}${state.step > 0 ? '<button class="back-link" id="booking-back">Voltar à etapa anterior</button>' : ""}</section><aside class="booking-summary"><img src="/assets/unhas.png" alt="Unhas com acabamento delicado"><div><p class="eyebrow">SEU MOMENTO DE CUIDADO</p><h3>${service ? esc(service.name) : "Uma pausa para você"}</h3>${service ? `<p>${service.duration} minutos <span>·</span> ${money(service.price)}</p>` : "<p>Selecione um serviço para começar.</p>"}${state.date ? `<p class="summary-date">${dateLabel(state.date)}${state.time ? `<br>${state.time} – ${clock(minutes(state.time) + service.duration)}` : ""}</p>` : ""}<hr><small>${esc(s.cancellationPolicy)}</small></div></aside></div>`}</main><div class="booking-footer">CUIDADO · QUALIDADE · CONFIANÇA</div>`;
  bind(db, service);
}
function stepView(db, service) {
  switch (state.step) {
    case 0:
      return `<div class="booking-services">${
        db.services
          .filter((x) => x.active)
          .map(
            (x) =>
              `<button class="booking-service" data-service="${x.id}"><img src="${imageSrc(x.image)}" alt=""><span><small>${esc(x.category)}</small><strong>${esc(x.name)}</strong><small>${x.duration} minutos</small></span><b>${money(x.price)}</b></button>`,
          )
          .join("") ||
        "<p>Em breve teremos novos horários. Entre em contato pelo Instagram.</p>"
      }</div>`;
    case 1:
      return (
        calendar(state.month, state.date, db, service) +
        '<p class="helper">Datas indisponíveis aparecem desabilitadas.</p>'
      );
    case 2: {
      const slots = api.getAvailableSlots(service.id, state.date);
      return `<p class="date-heading">${dateLabel(state.date)} · ${service.duration} minutos</p><div class="slots">${slots.map((t) => `<button data-time="${t}" class="slot">${t}</button>`).join("")}</div>${!slots.length ? '<div class="empty"><h3>Sem horários disponíveis neste dia</h3><p>Escolha outra data para encontrar seu momento.</p></div>' : '<p class="helper">Horários já consideram a duração do serviço.</p>'}`;
    }
    case 3:
      return `<form id="customer-form" class="form-grid"><label class="full">Nome completo<input name="name" autocomplete="name" required minlength="2" maxlength="100" value="${esc(state.name)}"></label><label class="full">WhatsApp com DDD<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required pattern="[0-9 ()+\-]{10,20}" placeholder="(11) 99999-9999" value="${esc(state.phone)}"></label><label class="full">Observações <span class="muted">(opcional)</span><textarea name="notes" maxlength="1000" placeholder="Algo que você gostaria que soubéssemos?">${esc(state.notes)}</textarea></label><label class="checkbox-label full"><input name="consent" type="checkbox" required ${state.consent ? "checked" : ""}>Li e concordo com a política de cancelamento apresentada.</label><p class="helper full">${connectionState.mode !== "local" ? "Usaremos seus dados para registrar e acompanhar este agendamento." : "Nesta demonstração, os dados ficam neste navegador. Use dados fictícios para testar."}</p><button class="button full" type="submit">Revisar agendamento</button></form>`;
    case 4:
      return `<div class="review-booking"><p>Revise seus dados antes de confirmar.</p><dl><dt>Serviço</dt><dd>${esc(service.name)}</dd><dt>Data e horário</dt><dd>${dateLabel(state.date)}, às ${state.time}</dd><dt>Duração</dt><dd>${service.duration} minutos</dd><dt>Valor</dt><dd>${money(service.price)}</dd><dt>Cliente</dt><dd>${esc(state.name)}</dd><dt>WhatsApp</dt><dd>${esc(state.phone)}</dd>${state.notes ? `<dt>Observações</dt><dd>${esc(state.notes)}</dd>` : ""}</dl><p class="helper">${esc(db.settings.cancellationPolicy)}</p><button id="confirm-booking" class="button">Confirmar agendamento</button><div id="booking-error" role="alert"></div></div>`;
  }
}
function successView(a) {
  return `<section class="booking-success"><div class="success-mark">✓</div><p class="eyebrow">SEU MOMENTO ESTÁ RESERVADO</p><h1>Agendamento realizado<br><em>com sucesso!</em></h1><p>Esperamos por você para um momento de cuidado.</p><div class="success-ticket"><h3>${esc(a.serviceName)}</h3><p>${dateLabel(a.date)} · ${a.time}</p><p>${a.duration} minutos · ${money(a.price)}</p><small>Reserva ${a.id.slice(0, 8).toUpperCase()} · Agendado</small></div><p class="helper">Salve estas informações. O comprovante do seu agendamento está nesta página.</p><a href="/" class="button">Voltar ao início</a><button id="another-booking" class="button secondary">Agendar outro cuidado</button></section>`;
}
function bind(db, service) {
  document.querySelectorAll("[data-service]").forEach(
    (el) =>
      (el.onclick = () => {
        state.serviceId = el.dataset.service;
        state.step = 1;
        state.date = "";
        state.time = "";
        renderBooking();
      }),
  );
  document.querySelectorAll("[data-month]").forEach(
    (el) =>
      (el.onclick = () => {
        state.month = shiftMonth(state.month, +el.dataset.month);
        renderBooking();
      }),
  );
  document.querySelectorAll("[data-date]").forEach(
    (el) =>
      (el.onclick = () => {
        state.date = el.dataset.date;
        state.time = "";
        state.step = 2;
        renderBooking();
      }),
  );
  document.querySelectorAll("[data-time]").forEach(
    (el) =>
      (el.onclick = () => {
        state.time = el.dataset.time;
        state.step = 3;
        renderBooking();
      }),
  );
  const back = document.querySelector("#booking-back");
  if (back)
    back.onclick = () => {
      capture();
      state.step--;
      renderBooking();
    };
  const form = document.querySelector("#customer-form");
  if (form) {
    form.oninput = capture;
    form.onsubmit = (e) => {
      e.preventDefault();
      capture();
      state.step = 4;
      renderBooking();
    };
  }
  const confirm = document.querySelector("#confirm-booking");
  if (confirm)
    confirm.onclick = async () => {
      confirm.disabled = true;
      confirm.textContent = "Confirmando…";
      try {
        state.success = await api.createAppointment(state);
        renderBooking();
      } catch (e) {
        document.querySelector("#booking-error").innerHTML =
          `<p class="error">${esc(e.message)}</p>`;
        confirm.disabled = false;
        confirm.textContent = "Confirmar agendamento";
      }
    };
  const another = document.querySelector("#another-booking");
  if (another)
    another.onclick = () => {
      history.replaceState({}, "", "/agendar");
      resetBooking();
      renderBooking();
    };
}
function capture() {
  const f = document.querySelector("#customer-form");
  if (f) {
    state.name = f.elements.name.value;
    state.phone = f.elements.phone.value;
    state.notes = f.elements.notes.value;
    state.consent = f.elements.consent.checked;
  }
}
