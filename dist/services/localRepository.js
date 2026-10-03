import { seed } from "../data/seed.js";
export const STORAGE_KEY = "jeh-campus:database:v1";
const event = "jeh-campus:change";
export class LocalRepository {
  read() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      throw new Error(
        "O navegador não permitiu acesso ao armazenamento local. Habilite o armazenamento para continuar.",
      );
    }
    if (!raw) {
      const db = seed();
      this.write(db, false);
      return db;
    }
    try {
      const db = JSON.parse(raw);
      if (
        db.version !== 1 ||
        !Array.isArray(db.services) ||
        !Array.isArray(db.appointments) ||
        !Array.isArray(db.customers) ||
        !Array.isArray(db.blocks) ||
        !Array.isArray(db.gallery) ||
        !db.settings
      )
        throw Error();
      return db;
    } catch {
      throw new Error(
        "Os dados locais não puderam ser lidos. Preserve os dados do navegador e restaure um backup válido.",
      );
    }
  }
  write(db, emit = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      throw new Error(
        "Não foi possível salvar. O armazenamento pode estar cheio; reduza as imagens ou libere espaço.",
      );
    }
    if (emit) window.dispatchEvent(new Event(event));
  }
  async transaction(fn) {
    const run = () => {
      const db = this.read();
      const result = fn(db);
      this.write(db);
      return structuredClone(result ?? db);
    };
    if (navigator.locks?.request)
      return navigator.locks.request(STORAGE_KEY, run);
    return run();
  }
  subscribe(fn) {
    const handler = (e) => {
      if (e.type === event || e.key === STORAGE_KEY) fn();
    };
    window.addEventListener(event, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(event, handler);
      window.removeEventListener("storage", handler);
    };
  }
}
