export const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dateLabel = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
export const minutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const clock = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const imageSrc = (v) =>
  /^(\/assets\/|data:image\/(png|jpeg|webp|gif);base64,)/.test(v || "")
    ? esc(v)
    : "/assets/unhas.png";
export const digits = (v) => String(v || "").replace(/\D/g, "");
export const whatsapp = (v) => {
  const p = digits(v);
  return p.length === 10 || p.length === 11 ? "55" + p : p;
};
export const addDays = (key, n) => {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
