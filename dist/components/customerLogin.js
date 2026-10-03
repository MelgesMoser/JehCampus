import { api, connectionState } from "../services/index.js";
import { esc } from "../utils/format.js";
let register = false;
export function customerLoginView() {
  if (connectionState.mode === "local")
    return '<p class="error">O cadastro e o agendamento com senha exigem conexão com o banco do salão.</p>';
  return `<section class="customer-access"><p class="eyebrow">SUA CONTA NO JEH CAMPUS</p><h3>${register ? "Seu primeiro momento aqui?" : "Que bom ter você de volta."}</h3><p>${register ? "Crie sua conta para reservar seu horário." : "Entre para continuar. Seu serviço, dia e horário serão mantidos."}</p><form id="customer-access-form" class="form-grid">
  ${register ? '<label class="full">Nome completo<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label><label class="full">WhatsApp com DDD<input name="phone" type="tel" autocomplete="tel" maxlength="20" required></label>' : ""}
  <label class="full">E-mail<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
  <label class="full">Senha<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" ${register ? 'minlength="12"' : ""} maxlength="128" required></label>
  ${register ? '<label class="full">Confirmar senha<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><small class="helper full">Use pelo menos 12 caracteres. Seu nome e WhatsApp serão usados nos agendamentos.</small>' : ""}
  <div class="full" id="customer-access-error" role="alert"></div><button class="button full" type="submit">${register ? "Criar conta e continuar" : "Entrar e continuar"}</button></form>
  <button class="text-link" id="switch-customer-access">${register ? "Já tenho conta · Entrar" : "Primeira visita? Criar minha conta"}</button></section>`;
}
export function bindCustomerLogin(onSuccess, onRender) {
  const toggle = document.querySelector("#switch-customer-access");
  if (toggle)
    toggle.onclick = () => {
      register = !register;
      onRender();
    };
  const form = document.querySelector("#customer-access-form");
  if (!form) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const error = document.querySelector("#customer-access-error");
    error.textContent = "";
    if (register && data.password !== data.confirmation) {
      error.innerHTML = '<p class="error">As senhas devem ser iguais.</p>';
      return;
    }
    delete data.confirmation;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Aguarde…";
    try {
      await api.customerLogin(data, register);
      form.reset();
      onSuccess();
    } catch (e) {
      error.innerHTML = `<p class="error">${esc(e.message)}</p>`;
      button.disabled = false;
      button.textContent = register
        ? "Criar conta e continuar"
        : "Entrar e continuar";
    }
  };
}
