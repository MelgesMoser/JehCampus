import { LocalRepository } from "./localRepository.js";
import { createServices } from "./domain.js";
import { RemoteServices } from "./remoteServices.js";
export { createServices } from "./domain.js";

export const connectionState = { mode: "local", connected: true };
export let api;

export async function initializeData() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok)
    throw new Error("Não foi possível consultar a configuração do servidor.");
  const config = await response.json();
  connectionState.mode = config.mode;
  if (["mongodb", "dataconnect", "file"].includes(config.mode)) {
    api = new RemoteServices(connectionState);
    await api.refresh(true);
    api.startSync();
  } else if (config.mode === "local") {
    api = createServices(new LocalRepository());
  } else {
    throw new Error("Modo de armazenamento inválido.");
  }
}
