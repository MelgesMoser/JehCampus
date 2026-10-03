import { api } from "../services/index.js";
import { modal, empty } from "../components/ui.js";
import { esc, dateKey, whatsapp } from "../utils/format.js";
import { appointmentRows, bindAppointments } from "./appointments.js";
export function customersPage(db, query = "") {
  const customers = db.customers.filter((c) =>
    (c.name + " " + c.phone).toLowerCase().includes(query.toLowerCase()),
  );
  return `<div class="page-toolbar"><p>Conheça cada cliente e acompanhe seu histórico.</p><input type="search" id="customer-search" placeholder="Buscar nome ou telefone" value="${esc(query)}" aria-label="Buscar cliente"></div><div id="customer-results">${customerTable(customers, db)}</div>`;
}
function customerTable(customers, db) {
  return customers.length
    ? `<div class="table-wrap"><table class="responsive-table customers-table"><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Último atendimento</th><th>Próximo atendimento</th><th>Atendimentos</th><th></th></tr></thead><tbody>${customers
        .map((c) => {
          const visits = db.appointments
              .filter((a) => a.customerId === c.id)
              .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
            last = visits.filter((a) => a.status === "Concluído").at(-1),
            next = visits.find(
              (a) =>
                new Date(a.date + "T" + a.time) >= new Date() &&
                ["Agendado", "Confirmado", "Em atendimento"].includes(a.status),
            );
          return `<tr><td data-label="Cliente"><div class="customer-name"><span class="avatar">${esc(
            c.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join(""),
          )}</span><strong>${esc(c.name)}</strong></div></td><td data-label="WhatsApp"><a href="https://wa.me/${whatsapp(c.phone)}" target="_blank" rel="noopener">${esc(c.phone)}</a></td><td data-label="Último atendimento">${last ? new Date(last.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td><td data-label="Próximo atendimento">${next ? new Date(next.date + "T12:00:00").toLocaleDateString("pt-BR") + " · " + next.time : "—"}</td><td data-label="Atendimentos">${visits.filter((a) => a.status === "Concluído").length} concluídos <small>${visits.length} registros</small></td><td class="table-card-action"><button class="table-action" data-customer="${c.id}">Ver histórico</button></td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : empty("Nenhuma cliente encontrada");
}
export function bindCustomers() {
  const bind = () =>
    document.querySelectorAll("[data-customer]").forEach(
      (b) =>
        (b.onclick = () => {
          const db = api.getSnapshot(),
            c = db.customers.find((c) => c.id === b.dataset.customer);
          modal(
            "Histórico da cliente",
            `<div class="customer-detail"><h3>${esc(c.name)}</h3><a class="button secondary small" href="https://wa.me/${whatsapp(c.phone)}" target="_blank" rel="noopener">Conversar no WhatsApp</a></div>${appointmentRows(
              db.appointments
                .filter((a) => a.customerId === c.id)
                .sort((a, b) =>
                  (b.date + b.time).localeCompare(a.date + a.time),
                ),
              db,
            )}`,
            true,
          );
          bindAppointments();
        }),
    );
  bind();
  document.querySelector("#customer-search").oninput = (e) => {
    const db = api.getSnapshot(),
      q = e.target.value.toLowerCase();
    document.querySelector("#customer-results").innerHTML = customerTable(
      db.customers.filter((c) =>
        (c.name + " " + c.phone).toLowerCase().includes(q),
      ),
      db,
    );
    bind();
  };
}
