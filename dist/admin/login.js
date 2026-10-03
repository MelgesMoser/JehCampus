import { api, connectionState } from "../services/index.js";
import { auth } from "../services/auth.js";
import { brand } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { esc } from "../utils/format.js";

export function renderLogin(onSuccess) {
  const remote = connectionState.mode !== "local";
  document.querySelector("#app").innerHTML =
    `<main class="admin-login">${brand(api.getSnapshot().settings)}<section><p class="eyebrow">ÁREA ADMINISTRATIVA</p><h1>Seu espaço.<br><em>Sua gestão.</em></h1><p>Gerencie os cuidados que tornam cada atendimento especial.</p>${
      remote
        ? `
    <form id="admin-login-form" class="login-form">
      <div class="login-secure">${icon("shield")} Acesso restrito à administração</div>
      <label>Usuário<input name="username" autocomplete="username" required placeholder="Seu usuário"></label>
      <label>Senha<input type="password" name="password" autocomplete="current-password" required placeholder="Sua senha"></label>
      <div id="login-error" role="alert"></div>
      <button class="button" type="submit">Entrar no painel</button>
    </form>`
        : `<div class="demo-explanation"><strong>Demonstração local</strong><p>Os dados ficam neste navegador. O login com senha será utilizado quando a conexão com o banco estiver ativada.</p></div><button id="demo-login" class="button">Entrar no painel de demonstração</button>`
    }
    <a class="text-link" href="/">Voltar ao site</a></section></main>`;
  if (!remote) {
    document.querySelector("#demo-login").onclick = async () => {
      await auth.signIn();
      onSuccess();
    };
    return;
  }
  const form = document.querySelector("#admin-login-form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Entrando…";
    try {
      await auth.signIn(Object.fromEntries(new FormData(form)));
      onSuccess();
    } catch (error) {
      document.querySelector("#login-error").innerHTML =
        `<p class="error">${esc(error.message)}</p>`;
      button.disabled = false;
      button.textContent = "Entrar no painel";
    }
  };
}
