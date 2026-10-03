import { icon } from "../components/icons.js";
import { dateKey, money, esc } from "../utils/format.js";
import { appointmentRows } from "./appointments.js";
export function dashboardPage(db) {
  const today = dateKey(),
    month = today.slice(0, 7),
    all = db.appointments,
    monthly = all.filter((a) => a.date.startsWith(month)),
    future = all
      .filter(
        (a) =>
          new Date(a.date + "T" + a.time) > new Date() &&
          ["Agendado", "Confirmado"].includes(a.status),
      )
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const stats = [
    [
      "Atendimentos de hoje",
      all.filter(
        (a) =>
          a.date === today &&
          !["Cancelado", "Não compareceu"].includes(a.status),
      ).length,
      "Sua agenda para hoje",
      "clock",
    ],
    ["Próximos atendimentos", future.length, "Reservas futuras", "calendar"],
    [
      "Atendimentos do mês",
      monthly.length,
      "Todos os registros do mês",
      "clipboard",
    ],
    [
      "Cancelamentos",
      monthly.filter((a) => a.status === "Cancelado").length,
      "Neste mês",
      "blocked",
    ],
    [
      "Atendimentos concluídos",
      monthly.filter((a) => a.status === "Concluído").length,
      "Neste mês",
      "checkCircle",
    ],
    [
      "Faturamento estimado",
      money(
        monthly
          .filter((a) => !["Cancelado", "Não compareceu"].includes(a.status))
          .reduce((sum, a) => sum + a.price, 0),
      ),
      "Reservas não canceladas do mês",
      "wallet",
    ],
  ];
  return `<div class="dashboard-welcome"><div><p class="eyebrow">CUIDADO COM O SEU NEGÓCIO</p><h2>Bem-vinda ao seu <em>espaço.</em></h2><p>Um olhar sobre sua agenda e os próximos momentos de cuidado.</p></div><span class="dashboard-monogram">JC</span></div><div class="stats-grid">${stats.map(([label, value, note, iconName]) => `<article class="stat-card"><div><span>${label}</span><b>${icon(iconName)}</b></div><strong>${value}</strong><small>${note}</small></article>`).join("")}</div><section class="dashboard-upcoming"><div class="section-bar"><div><h3>Próximos atendimentos</h3><p>Quem vamos receber nos próximos dias.</p></div><a class="text-link" href="/admin/agenda">Ver agenda completa</a></div>${appointmentRows(future.slice(0, 6), db)}</section>`;
}
