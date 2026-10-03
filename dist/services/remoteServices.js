import { availableSlots } from "./availability.js";

const mutationFields = {
  createService: [
    "name",
    "description",
    "category",
    "image",
    "price",
    "duration",
    "active",
  ],
  updateService: [
    "name",
    "description",
    "category",
    "image",
    "price",
    "duration",
    "active",
  ],
  createAppointment: ["name", "phone", "serviceId", "date", "time", "notes"],
  updateAppointment: [
    "name",
    "phone",
    "serviceId",
    "date",
    "time",
    "notes",
    "status",
  ],
  createBlockedTime: [
    "reason",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "allDay",
  ],
  createGalleryItem: ["image", "description", "category"],
  updateSettings: [
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

export class RemoteServices {
  constructor(connectionState) {
    this.connectionState = connectionState;
    this.listeners = new Set();
    this.authenticated = false;
    this.sequence = 0;
    this.bookingKeys = new Map();
    for (const operation of [
      ...Object.keys(mutationFields),
      "deleteService",
      "cancelAppointment",
      "deleteAppointment",
      "deleteBlockedTime",
      "deleteGalleryItem",
    ]) {
      this[operation] = (...args) => this.mutate(operation, args);
    }
  }

  async request(path, data) {
    let response;
    try {
      response = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
        ...(data === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }),
      });
    } catch {
      this.setConnected(false);
      throw new Error(
        "Não foi possível acessar o servidor. Confira sua conexão e tente novamente.",
      );
    }
    const body = await response
      .json()
      .catch(() => ({ error: "Resposta inesperada do servidor." }));
    if (!response.ok) {
      if (response.status >= 500) this.setConnected(false);
      if (response.status === 401 && !path.includes("/auth/login")) {
        this.authenticated = false;
        if (this.state) {
          this.state.customers = [];
          this.state.appointments = [];
        }
        this.emit();
      }
      throw new Error(body.error || "Não foi possível concluir esta operação.");
    }
    this.setConnected(true);
    return body;
  }

  setConnected(connected) {
    if (this.connectionState.connected === connected) return;
    this.connectionState.connected = connected;
    this.emit();
  }
  emit() {
    this.listeners.forEach((listener) => listener());
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refresh(force = false) {
    const sequence = ++this.sequence;
    const params =
      !force && this.state
        ? `?revision=${this.state.revision}&scope=${this.authenticated ? "admin" : "public"}`
        : "";
    const response = await this.request("/api/snapshot" + params);
    if (sequence !== this.sequence) return;
    this.authenticated = response.authenticated;
    if (!response.unchanged) {
      this.state = response.snapshot;
      this.emit();
    }
  }

  startSync() {
    this.timer = setInterval(() => {
      if (document.visibilityState === "visible")
        this.refresh().catch(() => {});
    }, 15000);
    window.addEventListener("focus", () => this.refresh().catch(() => {}));
  }

  getSnapshot() {
    if (!this.state) throw new Error("Carregando dados do salão.");
    return structuredClone(this.state);
  }
  getServices() {
    return this.getSnapshot().services;
  }
  getAppointments() {
    return this.getSnapshot().appointments;
  }
  getCustomers() {
    return this.getSnapshot().customers;
  }
  getBlockedTimes() {
    return this.getSnapshot().blocks;
  }
  exportData() {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }
  getAvailableSlots(serviceId, date, excludeId) {
    const state = this.getSnapshot();
    let service = state.services.find((item) => item.id === serviceId);
    const previous =
      excludeId && state.appointments.find((item) => item.id === excludeId);
    if (previous?.serviceId === serviceId)
      service = { ...service, duration: previous.duration };
    return availableSlots(state, service, date, excludeId);
  }

  async mutate(operation, input) {
    const fields = mutationFields[operation];
    const args = input.map((value) =>
      fields && value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).filter(([key]) => fields.includes(key)),
          )
        : value,
    );
    const payload = { operation, args };
    if (operation === "createAppointment") {
      const signature = JSON.stringify(args);
      if (!this.bookingKeys.has(signature))
        this.bookingKeys.set(signature, crypto.randomUUID());
      payload.requestId = this.bookingKeys.get(signature);
    }
    const response = await this.request("/api/operations", payload);
    await this.refresh(true).catch(() => {});
    return response.result;
  }

  async login(credentials) {
    await this.request("/api/auth/login", credentials);
    await this.refresh(true);
  }
  async logout() {
    await this.request("/api/auth/logout", {});
    ++this.sequence;
    this.authenticated = false;
    if (this.state) {
      this.state.customers = [];
      this.state.appointments = [];
      this.state.blocks = [];
      this.state.services = this.state.services.filter(
        (service) => service.active,
      );
    }
    await this.refresh(true).catch(() => {});
    this.emit();
  }
}
