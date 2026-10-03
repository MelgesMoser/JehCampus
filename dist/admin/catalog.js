import { icon } from "../components/icons.js";
import { api } from "../services/index.js";
import { uploadImage } from "../services/images.js";
import { modal, closeModal, toast, field, empty } from "../components/ui.js";
import { esc, money, imageSrc, dateKey, dateLabel } from "../utils/format.js";
import { confirmAction } from "./appointments.js";
export function servicesPage(db) {
  return `<div class="page-toolbar"><p>Serviços e valores exibidos para suas clientes.</p><button class="button" id="new-service">${icon("plus")} Cadastrar serviço</button></div><div class="admin-services">${db.services.map((s) => `<article class="admin-service"><img src="${imageSrc(s.image)}" alt="${esc(s.name)}"><div><div class="service-title"><p class="eyebrow">${esc(s.category)}</p><span class="status ${s.active ? "status-done" : "status-muted"}">${s.active ? "Ativo" : "Inativo"}</span></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="admin-service-price"><strong>${money(s.price)}</strong><small>${s.duration} minutos</small></div><div class="row-actions"><button data-edit-service="${s.id}" class="button secondary small">Editar</button><button data-toggle-service="${s.id}" class="text-button">${s.active ? "Desativar" : "Ativar"}</button><button data-delete-service="${s.id}" class="text-button danger-text">Excluir</button></div></div></article>`).join("") || empty("Nenhum serviço cadastrado", "Cadastre seu primeiro serviço.")}</div>`;
}
export function bindServices() {
  document.querySelector("#new-service").onclick = () => serviceForm();
  document
    .querySelectorAll("[data-edit-service]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          serviceForm(
            api.getServices().find((s) => s.id === b.dataset.editService),
          )),
    );
  document.querySelectorAll("[data-toggle-service]").forEach(
    (b) =>
      (b.onclick = async () => {
        const s = api
          .getServices()
          .find((s) => s.id === b.dataset.toggleService);
        try {
          await api.updateService(s.id, { active: !s.active });
          toast(s.active ? "Serviço desativado." : "Serviço ativado.");
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  document.querySelectorAll("[data-delete-service]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Excluir serviço?",
          "Agendamentos anteriores manterão seu histórico. Serviços com reservas futuras precisam ser desativados.",
          async () => {
            await api.deleteService(b.dataset.deleteService);
            toast("Serviço excluído.");
          },
        )),
  );
}
function serviceForm(s = null) {
  modal(
    s ? "Editar serviço" : "Cadastrar serviço",
    `<form id="service-form"><div id="form-error" role="alert"></div><div class="form-grid">${field("Nome", "name", s?.name || "", "text", 'required maxlength="100"')}${field("Categoria", "category", s?.category || "", "text", 'required maxlength="80"')}<label class="full">Descrição<textarea name="description" required maxlength="500">${esc(s?.description)}</textarea></label>${field("Preço (R$)", "price", s?.price ?? "", "number", 'required min="0" step="0.01"')}${field("Duração (minutos)", "duration", s?.duration || 60, "number", 'required min="5" max="720" step="5"')}<label class="full">Imagem do serviço<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>JPG, PNG, WebP ou GIF. Até 10 MB.</small></label><label class="checkbox-label full"><input type="checkbox" name="active" ${s?.active !== false ? "checked" : ""}>Disponível para agendamento</label></div><div class="form-actions"><button class="button" type="submit">Salvar serviço</button></div></form>`,
  );
  bindSave(
    "service-form",
    async (f) => {
      const v = Object.fromEntries(new FormData(f));
      v.active = f.elements.active.checked;
      v.image =
        (await uploadImage(f.elements.imageFile.files[0])) ||
        s?.image ||
        "/assets/unhas.png";
      delete v.imageFile;
      if (s) await api.updateService(s.id, v);
      else await api.createService(v);
    },
    "Serviço salvo. O site já está atualizado.",
  );
}
export function galleryPage(db) {
  return `<div class="page-toolbar"><p>Uma vitrine dos seus trabalhos e do seu espaço.</p><button id="new-photo" class="button">${icon("plus")} Adicionar foto</button></div><div class="admin-gallery">${db.gallery.map((g) => `<article><img src="${imageSrc(g.image)}" alt="${esc(g.description)}"><div><small>${esc(g.category)}</small><h3>${esc(g.description)}</h3><button class="text-button danger-text" data-delete-photo="${g.id}">Remover foto</button></div></article>`).join("") || empty("Sua galeria está vazia", "Adicione uma foto para começar.")}</div>`;
}
export function bindGallery() {
  document.querySelector("#new-photo").onclick = () => {
    modal(
      "Adicionar foto",
      `<form id="gallery-form"><div id="form-error" role="alert"></div><div class="form-grid"><label class="full">Foto<input type="file" name="imageFile" accept="image/png,image/jpeg,image/webp,image/gif" required><small>Até 10 MB. A imagem será otimizada e salva neste navegador.</small></label>${field("Descrição", "description", "", "text", 'required maxlength="150"')}${field("Categoria", "category", "", "text", 'required maxlength="80"')}</div><div class="form-actions"><button class="button">Adicionar à galeria</button></div></form>`,
    );
    bindSave(
      "gallery-form",
      async (f) => {
        await api.createGalleryItem({
          description: f.elements.description.value,
          category: f.elements.category.value,
          image: await uploadImage(f.elements.imageFile.files[0]),
        });
      },
      "Foto adicionada à galeria.",
    );
  };
  document.querySelectorAll("[data-delete-photo]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Remover foto?",
          "Esta imagem deixará de aparecer na galeria pública.",
          async () => {
            await api.deleteGalleryItem(b.dataset.deletePhoto);
            toast("Foto removida.");
          },
        )),
  );
}
export function blocksPage(db) {
  return `<div class="page-toolbar"><p>Reserve pausas, compromissos ou dias de fechamento.</p><button id="new-block" class="button">${icon("plus")} Bloquear horário</button></div><div class="block-list">${db.blocks.map((b) => `<article class="block-card"><div class="block-icon">${icon("blocked")}</div><div><h3>${esc(b.reason)}</h3><p>${dateLabel(b.startDate)}${b.endDate !== b.startDate ? ` a ${dateLabel(b.endDate)}` : ""}</p><small>${b.allDay ? "Dia inteiro" : b.startTime + " – " + b.endTime}</small></div><button data-delete-block="${b.id}" class="button secondary small">Desbloquear</button></article>`).join("") || empty("Nenhum horário bloqueado", "Adicione pausas ou dias em que o salão não vai abrir.")}</div>`;
}
export function bindBlocks() {
  document.querySelector("#new-block").onclick = () => {
    modal(
      "Bloquear horário",
      `<form id="block-form"><div id="form-error" role="alert"></div><div class="form-grid">${field("Motivo", "reason", "", "text", 'required maxlength="120" class="full"')}${field("Data inicial", "startDate", dateKey(), "date", "required")}${field("Data final", "endDate", dateKey(), "date", "required")}<label class="checkbox-label"><input type="checkbox" name="allDay">Dia inteiro</label>${field("Início", "startTime", "12:00", "time", "required")}${field("Fim", "endTime", "13:00", "time", "required")}<p class="helper full">Em um período de vários dias, este intervalo será bloqueado em cada dia. Reservas existentes precisam ser canceladas ou reagendadas antes.</p></div><div class="form-actions"><button class="button">Salvar bloqueio</button></div></form>`,
    );
    const f = document.querySelector("#block-form");
    f.elements.allDay.onchange = () => {
      f.elements.startTime.disabled = f.elements.endTime.disabled =
        f.elements.allDay.checked;
    };
    f.elements.startDate.onchange = () => {
      if (f.elements.endDate.value < f.elements.startDate.value)
        f.elements.endDate.value = f.elements.startDate.value;
    };
    bindSave(
      "block-form",
      async (f) => {
        await api.createBlockedTime({
          ...Object.fromEntries(new FormData(f)),
          allDay: f.elements.allDay.checked,
        });
      },
      "Período bloqueado. A disponibilidade foi atualizada.",
    );
  };
  document.querySelectorAll("[data-delete-block]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Desbloquear período?",
          "Os horários livres voltarão a aparecer para as clientes.",
          async () => {
            await api.deleteBlockedTime(b.dataset.deleteBlock);
            toast("Bloqueio removido.");
          },
        )),
  );
}
export function bindSave(id, save, message) {
  const f = document.getElementById(id);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const button = f.querySelector("button[type=submit],button:not([type])");
    button.disabled = true;
    try {
      await save(f);
      closeModal();
      toast(message);
    } catch (err) {
      f.querySelector("#form-error").innerHTML =
        `<p class="error">${esc(err.message)}</p>`;
      button.disabled = false;
    }
  };
}
