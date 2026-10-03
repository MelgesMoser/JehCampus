import { icon } from "./icons.js";
import { esc, imageSrc } from "../utils/format.js";
export const brand = (s) =>
  `<a class="brand" href="/" aria-label="${esc(s.name)} — início">${s.logo ? `<img src="${imageSrc(s.logo)}" alt="">` : '<span class="brand-mark">JC</span>'}<span>${esc(s.name)}<small>BELEZA COM PROPÓSITO</small></span></a>`;
export function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4500);
}
export function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
  document.body.classList.remove("modal-open");
  closeModal.trigger?.focus();
}
export function modal(title, body, wide = false) {
  closeModal.trigger = document.activeElement;
  document.querySelector("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-close aria-label="Fechar">${icon("close")}</button></header><div class="modal-body">${body}</div></section></div>`;
  document.body.classList.add("modal-open");
  document.querySelector("[data-close]").onclick = closeModal;
  document.querySelector(".modal-backdrop").onclick = (e) => {
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  };
  document.querySelector(".modal").focus();
}
document.addEventListener("keydown", (e) => {
  const m = document.querySelector(".modal");
  if (!m) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "Tab") {
    const nodes = [
      ...m.querySelectorAll("button,input,select,textarea,a[href]"),
    ].filter((x) => !x.disabled && x.offsetParent !== null);
    const first = nodes[0],
      last = nodes.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === m)
    ) {
      e.preventDefault();
      last?.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last || document.activeElement === m)
    ) {
      e.preventDefault();
      first?.focus();
    }
  }
});
export const field = (label, name, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const empty = (title, description = "") =>
  `<div class="empty"><span>${icon("calendar")}</span><h3>${title}</h3><p>${description}</p></div>`;
export const status = (s) =>
  `<span class="status status-${s === "Cancelado" || s === "Não compareceu" ? "muted" : s === "Concluído" ? "done" : s === "Em atendimento" ? "live" : "booked"}">${esc(s)}</span>`;
