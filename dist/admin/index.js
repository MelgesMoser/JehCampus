import { api, connectionState } from "../services/index.js";
import { icon } from "../components/icons.js";
import { renderLogin } from "./login.js";
import { auth } from "../services/auth.js";
import { brand, toast } from "../components/ui.js";
import { esc } from "../utils/format.js";
import { dashboardPage } from "./dashboard.js";
import { agendaPage, bindAgenda } from "./calendar.js";
import { appointmentRows, bindAppointments } from "./appointments.js";
import {
  servicesPage,
  bindServices,
  galleryPage,
  bindGallery,
  blocksPage,
  bindBlocks,
} from "./catalog.js";
import { customersPage, bindCustomers } from "./customers.js";
import { settingsPage, bindSettings } from "./settings.js";
import { STATUSES } from "../services/availability.js";
const menu = [
  ["", "Dashboard", "dashboard"],
  ["agenda", "Agenda", "calendar"],
  ["agendamentos", "Agendamentos", "clipboard"],
  ["clientes", "Clientes", "users"],
  ["servicos", "Serviços", "sparkle"],
  ["galeria", "Galeria", "gallery"],
  ["bloqueios", "Horários bloqueados", "blocked"],
  ["configuracoes", "Configurações", "settings"],
];
const filters = { query: "", status: "", date: "" };
export function renderAdmin() {
  const db = api.getSnapshot();
  if (!auth.isSignedIn()) {
    renderLogin(renderAdmin);
    return;
  }
  const route = location.pathname.split("/")[2] || "",
    item = menu.find((x) => x[0] === route);
  if (!item) {
    document.querySelector("#app").innerHTML =
      '<main class="empty"><h1>Página não encontrada</h1><a class="button" href="/admin">Voltar ao painel</a></main>';
    return;
  }
  let content = "";
  switch (route) {
    case "":
      content = dashboardPage(db);
      break;
    case "agenda":
      content = agendaPage(db);
      break;
    case "agendamentos":
      content = appointmentsPage(db);
      break;
    case "clientes":
      content = customersPage(db);
      break;
    case "servicos":
      content = servicesPage(db);
      break;
    case "galeria":
      content = galleryPage(db);
      break;
    case "bloqueios":
      content = blocksPage(db);
      break;
    case "configuracoes":
      content = settingsPage(db);
  }
  document.querySelector("#app").innerHTML =
    `<div class="admin-layout"><button class="sidebar-backdrop" id="sidebar-backdrop" aria-label="Fechar menu" tabindex="-1" hidden></button><aside class="sidebar" id="admin-sidebar">${brand(db.settings)}<p class="sidebar-caption">GESTÃO DO SALÃO</p><nav aria-label="Painel administrativo">${menu.map(([path, name, iconName]) => `<a href="/admin${path ? "/" + path : ""}" class="${path === route ? "active" : ""}" ${path === route ? 'aria-current="page"' : ""}>${icon(iconName)}${name}</a>`).join("")}</nav><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">${icon("external")} Ver site da cliente</a><button id="admin-logout">${icon("logout")} Sair do painel</button><div class="admin-profile"><span class="avatar">JC</span><div>${esc(db.settings.name)}<small>Administração</small></div></div></div></aside><div class="admin-main"><header class="admin-topbar"><button id="toggle-menu" class="icon-button" aria-label="Abrir menu" aria-expanded="false" aria-controls="admin-sidebar">${icon("menu")}</button><div><span class="breadcrumb">MEU ESPAÇO / GESTÃO</span><h1>${item[1]}</h1></div><div class="topbar-right"><span>${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span><button data-new-appointment aria-label="Novo agendamento" class="button small">${icon("plus")} <span>Novo agendamento</span></button></div></header><div class="demo-banner connection-banner ${connectionState.mode !== "local" ? "is-cloud" : "is-local"}" role="status">${icon(connectionState.mode !== "local" ? (connectionState.connected ? "database" : "wifiOff") : "shield")}<span>${connectionState.mode !== "local" ? (connectionState.connected ? (connectionState.mode === "file" ? "BANCO LOCAL" : "BANCO CONECTADO") : "SEM CONEXÃO") : "DEMONSTRAÇÃO LOCAL"}</span><p>${connectionState.mode !== "local" ? (connectionState.connected ? (connectionState.mode === "file" ? "Dados salvos neste computador · Login protegido" : "Agenda compartilhada · Atualização automática") : "Os dados exibidos podem estar desatualizados. Tente novamente em instantes.") : "Dados salvos neste navegador · Banco aguardando configuração"}</p></div><main class="admin-content">${content}</main></div></div>`;
  document.querySelector("#admin-logout").onclick = async () => {
    try {
      await auth.signOut();
      renderAdmin();
    } catch (e) {
      toast(e.message);
    }
  };
  bindMenu();
  bindAppointments();
  if (route === "agenda") bindAgenda(renderAdmin);
  if (route === "servicos") bindServices();
  if (route === "galeria") bindGallery();
  if (route === "bloqueios") bindBlocks();
  if (route === "clientes") bindCustomers();
  if (route === "configuracoes") bindSettings();
  if (route === "agendamentos") bindFilters();
}
function filtered(db) {
  return db.appointments
    .filter((a) => {
      const c = db.customers.find((c) => c.id === a.customerId);
      return (
        (!filters.status || a.status === filters.status) &&
        (!filters.date || a.date === filters.date) &&
        (!filters.query ||
          (c?.name + " " + a.serviceName + " " + c?.phone)
            .toLowerCase()
            .includes(filters.query.toLowerCase()))
      );
    })
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
function appointmentsPage(db) {
  return `<div class="filter-bar"><input id="appointment-search" type="search" aria-label="Buscar agendamentos" placeholder="Buscar cliente ou serviço" value="${esc(filters.query)}"><select id="status-filter" aria-label="Filtrar por status"><option value="">Todos os status</option>${STATUSES.map((s) => `<option ${s === filters.status ? "selected" : ""}>${s}</option>`).join("")}</select><input type="date" id="date-filter" aria-label="Filtrar por data" value="${filters.date}"><button id="clear-filters" class="button secondary small">Limpar</button></div><div id="appointments-results">${appointmentRows(filtered(db), db)}</div>`;
}
function bindFilters() {
  const update = () => {
    document.querySelector("#appointments-results").innerHTML = appointmentRows(
      filtered(api.getSnapshot()),
      api.getSnapshot(),
    );
    bindAppointments();
  };
  document.querySelector("#appointment-search").oninput = (e) => {
    filters.query = e.target.value;
    update();
  };
  document.querySelector("#status-filter").onchange = (e) => {
    filters.status = e.target.value;
    update();
  };
  document.querySelector("#date-filter").onchange = (e) => {
    filters.date = e.target.value;
    update();
  };
  document.querySelector("#clear-filters").onclick = () => {
    Object.assign(filters, { query: "", status: "", date: "" });
    renderAdmin();
  };
}

function bindMenu() {
  const toggle = document.querySelector("#toggle-menu");
  const backdrop = document.querySelector("#sidebar-backdrop");
  const sidebar = document.querySelector(".sidebar");
  const close = document.createElement("button");
  close.className = "icon-button sidebar-close";
  close.setAttribute("aria-label", "Fechar menu");
  close.innerHTML = icon("close");
  sidebar.prepend(close);
  function setOpen(open) {
    sidebar.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    document.body.classList.toggle("sidebar-open", open);
    if (open) sidebar.querySelector("nav a").focus();
    else toggle.focus();
  }
  toggle.onclick = () => setOpen(!sidebar.classList.contains("is-open"));
  backdrop.onclick = () => setOpen(false);
  close.onclick = () => setOpen(false);
  sidebar.onkeydown = (event) => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "Tab" && sidebar.classList.contains("is-open")) {
      const links = [...sidebar.querySelectorAll("a,button")];
      if (event.shiftKey && document.activeElement === links[0]) {
        event.preventDefault();
        links.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
        event.preventDefault();
        links[0].focus();
      }
    }
  };
  sidebar
    .querySelectorAll("nav a")
    .forEach((link) =>
      link.addEventListener("click", () =>
        document.body.classList.remove("sidebar-open"),
      ),
    );
}
