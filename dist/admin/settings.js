import { api, connectionState } from "../services/index.js";
import { uploadImage } from "../services/images.js";
import { field, toast } from "../components/ui.js";
import { esc, imageSrc } from "../utils/format.js";
export function settingsPage(db) {
  const s = db.settings;
  return `<form id="settings-form"><div id="settings-error" role="alert"></div><section class="settings-card"><h3>Identidade & contato</h3><p>Estas informações aparecem no site da cliente.</p><div class="form-grid">${field("Nome do salão", "name", s.name, "text", 'required maxlength="100"')}${field("Telefone", "phone", s.phone, "tel")}${field("WhatsApp com DDD", "whatsapp", s.whatsapp, "tel")}${field("Instagram (sem @)", "instagram", s.instagram, "text")}<label class="full">Endereço<input name="address" required value="${esc(s.address)}" maxlength="300"></label><label>Logo<input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>${s.logo ? `<div class="logo-preview"><img src="${imageSrc(s.logo)}" alt="Logo atual"><label class="checkbox-label"><input type="checkbox" name="removeLogo">Remover logo</label></div>` : ""}</div></section><section class="settings-card"><h3>Funcionamento & agendamento</h3><p>Novas reservas respeitam os horários abaixo. Reservas existentes são preservadas.</p><div class="business-hours">${s.hours.map((h, i) => `<div><label class="checkbox-label"><input name="open${i}" type="checkbox" ${h.open ? "checked" : ""}>${["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][i]}</label><input aria-label="Abertura ${i}" type="time" name="start${i}" value="${h.start}" required><span>até</span><input aria-label="Fechamento ${i}" type="time" name="end${i}" value="${h.end}" required></div>`).join("")}</div><div class="form-grid"><label>Intervalo entre opções de horário<select name="slotInterval">${[15, 20, 30, 60].map((n) => `<option value="${n}" ${n === s.slotInterval ? "selected" : ""}>${n} minutos</option>`).join("")}</select></label><label class="full">Política de cancelamento<textarea name="cancellationPolicy" required maxlength="1000">${esc(s.cancellationPolicy)}</textarea></label></div></section><div class="settings-save"><p>${connectionState.mode !== "local" ? "Alterações serão salvas no banco compartilhado." : "Alterações são aplicadas neste navegador."}</p><button class="button" type="submit">Salvar configurações</button></div></form><section class="settings-card local-data"><h3>${connectionState.mode !== "local" ? "Dados do salão" : "Dados desta demonstração"}</h3><p>${connectionState.mode !== "local" ? "As informações são salvas no banco e compartilhadas com as clientes. Você também pode exportar uma cópia." : "As informações ficam neste navegador. Exporte uma cópia antes de limpar seus dados."}</p><button class="button secondary" id="export-data">Exportar dados (JSON)</button></section>`;
}
export function bindSettings() {
  const f = document.querySelector("#settings-form");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const button = f.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const v = Object.fromEntries(new FormData(f));
      delete v.logoFile;
      v.logo = f.elements.removeLogo?.checked
        ? ""
        : (await uploadImage(f.elements.logoFile.files[0])) ||
          api.getSnapshot().settings.logo;
      v.hours = Array.from({ length: 7 }, (_, i) => ({
        day: i,
        open: f.elements["open" + i].checked,
        start: f.elements["start" + i].value,
        end: f.elements["end" + i].value,
      }));
      for (let i = 0; i < 7; i++) {
        delete v["open" + i];
        delete v["start" + i];
        delete v["end" + i];
      }
      delete v.removeLogo;
      await api.updateSettings(v);
      toast("Configurações salvas.");
      button.disabled = false;
    } catch (err) {
      document.querySelector("#settings-error").innerHTML =
        `<p class="error">${esc(err.message)}</p>`;
      button.disabled = false;
      document
        .querySelector("#settings-error")
        .scrollIntoView({ block: "center" });
    }
  };
  document.querySelector("#export-data").onclick = () => {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([api.exportData()], { type: "application/json" }),
      );
    a.href = url;
    a.download = "jeh-campus-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Cópia dos dados exportada.");
  };
}
