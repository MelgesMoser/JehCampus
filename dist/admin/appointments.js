import { bookingIds, sameSelection } from "../services/selection.js";
import { api } from "../services/index.js";
import { STATUSES } from "../services/availability.js";
import {
  modal,
  closeModal,
  toast,
  field,
  status,
  empty,
} from "../components/ui.js";
import {
  esc,
  money,
  dateLabel,
  dateKey,
  clock,
  minutes,
  whatsapp,
} from "../utils/format.js";
export function appointmentRows(list, db) {
  return list.length
    ? `<div class="table-wrap"><table class="responsive-table appointments-table"><thead><tr><th>Data / horário</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${list
        .map((a) => {
          const c = db.customers.find((c) => c.id === a.customerId);
          return `<tr><td data-label="Data / horário"><strong>${new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}</strong><small>${a.time} – ${clock(minutes(a.time) + a.duration)}</small></td><td data-label="Cliente">${esc(c?.name)}</td><td data-label="Serviço">${esc(a.serviceName)}</td><td data-label="Valor">${money(a.price)}</td><td data-label="Status">${status(a.status)}</td><td class="table-card-action"><button class="table-action" data-appointment="${a.id}">Detalhes</button></td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : empty(
        "Nenhum atendimento encontrado",
        "Os novos agendamentos aparecerão aqui.",
      );
}
export function bindAppointments() {
  document
    .querySelectorAll("[data-appointment]")
    .forEach((b) => (b.onclick = () => showAppointment(b.dataset.appointment)));
  document
    .querySelectorAll("[data-new-appointment]")
    .forEach((b) => (b.onclick = () => appointmentForm()));
}
export function showAppointment(id) {
  const db = api.getSnapshot(),
    a = db.appointments.find((a) => a.id === id);
  if (!a) return;
  const c = db.customers.find((c) => c.id === a.customerId);
  modal(
    "Detalhes do agendamento",
    `<div class="detail-heading"><h3>${esc(c?.name)}</h3>${status(a.status)}</div><dl class="detail-list"><dt>Serviço</dt><dd>${esc(a.serviceName)}</dd><dt>Data</dt><dd>${dateLabel(a.date)}</dd><dt>Horário</dt><dd>${a.time} – ${clock(minutes(a.time) + a.duration)}</dd><dt>Valor</dt><dd>${money(a.price)}</dd><dt>WhatsApp</dt><dd><a class="text-link" href="https://wa.me/${whatsapp(c?.phone)}" target="_blank" rel="noopener">${esc(c?.phone)}</a></dd><dt>Observações</dt><dd>${esc(a.notes) || "Sem observações"}</dd></dl><label>Status<select id="appointment-status">${STATUSES.map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><div id="detail-error" role="alert"></div><div class="form-actions"><button class="button secondary" id="edit-appointment">Editar / Reagendar</button><button class="button" id="save-status">Salvar status</button></div><div class="detail-danger"><button class="text-button" id="cancel-appointment">Cancelar agendamento</button><button class="text-button danger-text" id="delete-appointment">Excluir registro</button></div>`,
  );
  document.querySelector("#edit-appointment").onclick = () =>
    appointmentForm(a);
  document.querySelector("#save-status").onclick = async () => {
    try {
      await api.updateAppointment(id, {
        status: document.querySelector("#appointment-status").value,
      });
      closeModal();
      toast("Status atualizado.");
    } catch (e) {
      document.querySelector("#detail-error").innerHTML =
        `<p class="error">${esc(e.message)}</p>`;
    }
  };
  document.querySelector("#cancel-appointment").onclick = () =>
    confirmAction(
      "Cancelar agendamento?",
      "O horário será liberado para novas reservas.",
      async () => {
        await api.cancelAppointment(id);
        toast("Agendamento cancelado.");
      },
    );
  document.querySelector("#delete-appointment").onclick = () =>
    confirmAction(
      "Excluir este registro?",
      "Esta ação remove o atendimento do histórico e dos indicadores.",
      async () => {
        await api.deleteAppointment(id);
        toast("Agendamento excluído.");
      },
    );
}
export function confirmAction(title, text, action) {
  modal(
    title,
    `<p>${text}</p><div id="confirm-error" role="alert"></div><div class="form-actions"><button class="button secondary" id="dismiss-confirm">Voltar</button><button class="button danger" id="accept-confirm">Confirmar</button></div>`,
  );
  document.querySelector("#dismiss-confirm").onclick = closeModal;
  document.querySelector("#accept-confirm").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await action();
      closeModal();
    } catch (err) {
      document.querySelector("#confirm-error").innerHTML =
        `<p class="error">${esc(err.message)}</p>`;
      document.querySelector("#accept-confirm").disabled = false;
    }
  };
}
export function appointmentForm(a = null) {
  const db = api.getSnapshot(),
    c = db.customers.find((c) => c.id === a?.customerId),
    services = db.services.filter(
      (s) => s.active || (a && bookingIds(a).includes(s.id)),
    );
  modal(
    a ? "Editar / Reagendar" : "Novo agendamento",
    `<form id="appointment-form"><div id="form-error" role="alert"></div><div class="form-grid">${field("Nome da cliente", "name", c?.name || "", "text", 'required minlength="2" maxlength="100"')}${field("WhatsApp com DDD", "phone", c?.phone || "", "tel", "required")}<fieldset class="full service-checks"><legend>Serviços — selecione um ou mais</legend>${services.map((s) => `<label class="checkbox-label"><input type="checkbox" name="serviceIds" value="${s.id}" ${a && bookingIds(a).includes(s.id) ? "checked" : ""}>${esc(s.name)} · ${s.duration} min · ${money(s.price)}</label>`).join("")}</fieldset>${field("Data", "date", a?.date || dateKey(), "date", "required")}<label>Horário<select name="time" required><option value="">Selecione serviço e data</option></select></label><label class="full">Observações<textarea name="notes" maxlength="1000">${esc(a?.notes)}</textarea></label><p class="helper full">A disponibilidade será conferida novamente ao salvar. O valor e a duração de reservas existentes são preservados ao reagendar o mesmo serviço.</p></div><div class="form-actions"><button type="button" class="button secondary" data-abort>Voltar</button><button class="button" type="submit">${a ? "Salvar alterações" : "Criar agendamento"}</button></div></form>`,
  );
  const form = document.querySelector("#appointment-form");
  const update = () => {
    const svc = [...form.querySelectorAll('[name="serviceIds"]:checked')].map(
        (input) => input.value,
      ),
      date = form.elements.date.value;
    let slots =
      svc.length && date ? api.getAvailableSlots(svc, date, a?.id) : [];
    if (
      a &&
      a.date === date &&
      sameSelection(bookingIds(a), svc) &&
      !slots.includes(a.time)
    )
      slots = [a.time, ...slots].sort();
    form.elements.time.innerHTML = slots.length
      ? '<option value="">Escolha um horário</option>' +
        slots
          .map(
            (t) => `<option ${t === a?.time ? "selected" : ""}>${t}</option>`,
          )
          .join("")
      : '<option value="">Sem horários disponíveis</option>';
  };
  form
    .querySelectorAll('[name="serviceIds"]')
    .forEach((input) => (input.onchange = update));
  form.elements.date.onchange = update;
  update();
  form.querySelector("[data-abort]").onclick = closeModal;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const data = new FormData(form);
      const v = {
        ...Object.fromEntries(data),
        serviceIds: data.getAll("serviceIds"),
      };
      if (a) await api.updateAppointment(a.id, v);
      else await api.createAppointment(v);
      closeModal();
      toast(a ? "Agendamento atualizado." : "Agendamento criado.");
    } catch (err) {
      form.querySelector("#form-error").innerHTML =
        `<p class="error">${esc(err.message)}</p>`;
      button.disabled = false;
    }
  };
}
