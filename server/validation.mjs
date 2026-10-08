export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fields = {
  service: [
    "name",
    "description",
    "category",
    "image",
    "price",
    "duration",
    "active",
  ],
  booking: ["name", "phone", "serviceId", "serviceIds", "date", "time", "notes", "status"],
  block: ["reason", "startDate", "endDate", "startTime", "endTime", "allDay"],
  gallery: ["image", "description", "category"],
  settings: [
    "name",
    "logo",
    "phone",
    "whatsapp",
    "instagram",
    "address",
    "cancellationPolicy",
    "slotInterval",
    "hours",
  ],
};
export const operations = {
  createService: ["service"],
  updateService: ["id", "service"],
  deleteService: ["id"],
  createAppointment: ["booking"],
  updateAppointment: ["id", "booking"],
  cancelAppointment: ["id"],
  deleteAppointment: ["id"],
  createBlockedTime: ["block"],
  deleteBlockedTime: ["id"],
  createGalleryItem: ["gallery"],
  deleteGalleryItem: ["id"],
  updateSettings: ["settings"],
};
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Dados inválidos.");
}
export function validateOperation(operation, args) {
  if (
    !Object.hasOwn(operations, operation) ||
    !Array.isArray(args) ||
    args.length !== operations[operation].length
  )
    throw new HttpError(400, "Operação inválida.");
  return args.map((value, index) => {
    const kind = operations[operation][index];
    if (kind === "id") {
      if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
        throw new HttpError(400, "Identificador inválido.");
      return value;
    }
    object(value);
    for (const [key, entry] of Object.entries(value)) {
      if (!fields[kind].includes(key))
        throw new HttpError(400, "Campo não permitido.");
      if (key === "serviceIds") {
        if (!Array.isArray(entry) || !entry.length || entry.length > 20 || new Set(entry).size !== entry.length || entry.some(id => typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id))) throw new HttpError(400, "Selecione serviços válidos, sem repetições.");
      } else if (key === "hours") {
        if (!Array.isArray(entry) || entry.length !== 7)
          throw new HttpError(400, "Informe os sete dias da semana.");
        entry.forEach((hour, day) => {
          object(hour);
          if (
            Object.keys(hour).some(
              (k) => !["day", "open", "start", "end"].includes(k),
            ) ||
            hour.day !== day ||
            typeof hour.open !== "boolean" ||
            ![hour.start, hour.end].every(
              (t) =>
                typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
            )
          )
            throw new HttpError(400, "Horário de funcionamento inválido.");
        });
      } else if (["active", "allDay"].includes(key)) {
        if (typeof entry !== "boolean")
          throw new HttpError(400, "Opção inválida.");
      } else if (["price", "duration", "slotInterval"].includes(key)) {
        if (
          !["string", "number"].includes(typeof entry) ||
          !Number.isFinite(Number(entry))
        )
          throw new HttpError(400, "Número inválido.");
      } else if (
        typeof entry !== "string" ||
        entry.length >
          (["image", "logo"].includes(key)
            ? 2500000
            : key === "notes" || key === "cancellationPolicy"
              ? 1000
              : 500)
      ) {
        throw new HttpError(400, "Texto ou imagem excede o tamanho permitido.");
      }
    }
    return value;
  });
}

export function publicSnapshot(state) {
  return {
    version: state.version,
    revision: state.revision,
    services: state.services.filter((s) => s.active),
    settings: state.settings,
    gallery: state.gallery,
    customers: [],
    // Only anonymous occupancy intervals reach the public website.
    appointments: state.appointments
      .filter((a) => !["Cancelado", "Não compareceu"].includes(a.status))
      .map((a) => ({
        date: a.date,
        time: a.time,
        duration: a.duration,
        status: "Confirmado",
      })),
    blocks: state.blocks.map(
      ({ startDate, endDate, startTime, endTime, allDay }) => ({
        startDate,
        endDate,
        startTime,
        endTime,
        allDay,
      }),
    ),
  };
}
