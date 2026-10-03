import { api } from "../services/index.js";
import { brand, toast } from "../components/ui.js";
import {
  customerLoginView,
  bindCustomerLogin,
} from "../components/customerLogin.js";
import { esc } from "../utils/format.js";
export function renderCustomerAccount() {
  const customer = api.customer;
  document.querySelector("#app").innerHTML =
    `<header class="booking-header">${brand(api.getSnapshot().settings)}<a href="/" class="text-link">Voltar ao site</a></header><main class="customer-account-page booking-panel">${customer ? `<p class="eyebrow">MINHA CONTA</p><h1>Olá, <em>${esc(customer.name)}.</em></h1><p>${esc(customer.email)}</p><p>WhatsApp: ${esc(customer.phone)}</p><a href="/agendar" class="button">Agendar horário</a><button id="customer-signout" class="button secondary">Sair da minha conta</button>` : customerLoginView()}</main>`;
  bindCustomerLogin(renderCustomerAccount, renderCustomerAccount);
  const logout = document.querySelector("#customer-signout");
  if (logout)
    logout.onclick = async () => {
      logout.disabled = true;
      try {
        await api.customerLogout();
        renderCustomerAccount();
      } catch (e) {
        toast(e.message);
        logout.disabled = false;
      }
    };
}
