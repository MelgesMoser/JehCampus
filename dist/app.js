import { api, initializeData, connectionState } from "./services/index.js";
import { auth } from "./services/auth.js";
import { home } from "./pages/home.js";
import { renderCustomerAccount } from "./pages/customerAccount.js";
import { renderBooking, resetBooking } from "./pages/booking.js";
import { renderAdmin } from "./admin/index.js";
import { watchStore } from "./hooks/store.js";
import { modal } from "./components/ui.js";
import { esc, imageSrc } from "./utils/format.js";

function showError(message) {
  document.querySelector("#app").innerHTML =
    `<main class="empty startup-state"><h1>Vamos reconectar seu espaço.</h1><p>${esc(message)}</p><button class="button" id="retry-startup">Tentar novamente</button></main>`;
  document.querySelector("#retry-startup").onclick = () => location.reload();
}
function render() {
  document.body.classList.remove("sidebar-open");
  try {
    if (location.pathname.startsWith("/admin")) renderAdmin();
    else if (location.pathname === "/agendar") renderBooking();
    else if (location.pathname === "/entrar") renderCustomerAccount();
    else if (location.pathname === "/") {
      const db = api.getSnapshot();
      document.title = db.settings.name + " · Beleza com propósito";
      document.querySelector("#app").innerHTML = home(db);
      document.querySelectorAll("[data-photo]").forEach(
        (button) =>
          (button.onclick = () => {
            const photo = db.gallery.find(
              (item) => item.id === button.dataset.photo,
            );
            modal(
              photo.description,
              `<img class="lightbox-photo" src="${imageSrc(photo.image)}" alt="${esc(photo.description)}">`,
              true,
            );
          }),
      );
    } else {
      document.querySelector("#app").innerHTML =
        '<main class="empty"><h1>Página não encontrada</h1><a class="button" href="/">Voltar ao início</a></main>';
    }
  } catch (error) {
    showError(error.message);
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (
    !link ||
    link.target ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.hash) return;
  event.preventDefault();
  history.pushState({}, "", url.pathname + url.search);
  if (url.pathname === "/agendar") resetBooking();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});
window.addEventListener("popstate", () => {
  resetBooking();
  render();
});

async function start() {
  document.querySelector("#app").innerHTML =
    '<main class="startup-state"><span class="brand-mark">JC</span><h1>Seu espaço de cuidado.</h1><p>Preparando tudo para você…</p></main>';
  try {
    await initializeData();
    watchStore(() => {
      // Preserve in-progress forms during background sync. Expired sessions are
      // handled immediately so private admin data cannot stay on screen.
      if (
        connectionState.mode !== "local" &&
        location.pathname.startsWith("/admin") &&
        !auth.isSignedIn()
      ) {
        document.querySelector("#modal-root").innerHTML = "";
        document.body.classList.remove("modal-open");
        render();
        return;
      }
      if (
        document.querySelector("#customer-access-form") ||
        document.querySelector("#admin-login-form") ||
        document.querySelector("#customer-form") ||
        (document
          .querySelector("#settings-form")
          ?.contains(document.activeElement) &&
          document.activeElement?.matches("input,textarea,select")) ||
        document.querySelector(".sidebar.is-open")
      )
        return;
      render();
    });
    render();
    registerAvailabilityTool();
  } catch (error) {
    showError(error.message);
  }
}

function registerAvailabilityTool() {
  if (!document.modelContext?.registerTool) return;
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "get_available_appointment_times",
        title: "Consultar horários disponíveis",
        description:
          "Consulta os horários disponíveis para um serviço e uma data, sem criar uma reserva.",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: { type: "string" },
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          },
          required: ["serviceId", "date"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        async execute({ serviceId, date }) {
          if (connectionState.mode !== "local") await api.refresh(true);
          if (
            !api.getServices().some((service) => service.id === serviceId) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)
          )
            throw Error("Serviço ou data inválidos.");
          return { times: api.getAvailableSlots(serviceId, date) };
        },
      }),
    ).catch(() => {});
  } catch {}
}
start();
