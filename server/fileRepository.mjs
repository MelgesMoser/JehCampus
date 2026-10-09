import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { seed } from "../dist/data/seed.js";
import { createServices } from "../dist/services/domain.js";

// One local server owns this file. Cloud deployments always use MongoDB.
export class FileRepository {
  constructor(config) {
    this.filename = config.localDatabase;
    this.queue = Promise.resolve();
  }
  async connect() {
    try {
      this.data = JSON.parse(await readFile(this.filename, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          "O banco local não pôde ser lido. Preserve o arquivo antes de restaurar um backup.",
        );
      const state = seed();
      state.appointments = [];
      state.customers = [];
      state.blocks = [];
      state.revision = 1;
      this.data = { state, privateRecords: [], sessions: [], requests: [] };
      await this.persist(this.data);
    }
    return this;
  }
  async persist(data) {
    await mkdir(path.dirname(this.filename), { recursive: true });
    const temporary = this.filename + ".tmp";
    await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
    await rename(temporary, this.filename);
  }
  mutate(fn) {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.data);
      const result = await fn(draft);
      await this.persist(draft);
      this.data = draft;
      return structuredClone(result);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async snapshot() {
    await this.queue;
    return structuredClone(this.data.state);
  }
  async revision() {
    await this.queue;
    return this.data.state.revision;
  }
  execute(operation, args, key) {
    return this.mutate(async (data) => {
      const previous = key && data.requests.find((x) => x.key === key);
      if (previous) return previous.result;
      const api = createServices({
        read: () => structuredClone(data.state),
        subscribe: () => () => {},
        transaction: async (fn) => fn(data.state),
      });
      const result = await api[operation](...args);
      data.state.revision++;
      if (key) data.requests.push({ key, result });
      return result;
    });
  }
  async getPrivateRecord(key) {
    await this.queue;
    return structuredClone(
      this.data.privateRecords.find((x) => x.key === key)?.value || null,
    );
  }
  createPrivateRecord(key, value) {
    return this.mutate((data) => {
      if (data.privateRecords.some((x) => x.key === key)) return false;
      data.privateRecords.push({ key, value });
      return true;
    });
  }
  deletePrivateRecord(key) {
    return this.mutate((data) => {
      data.privateRecords = data.privateRecords.filter((x) => x.key !== key);
    });
  }
  saveSession(key, expiresAt) {
    return this.mutate((data) => {
      data.sessions = data.sessions.filter(
        (x) => x.expiresAt > Date.now() && x.key !== key,
      );
      data.sessions.push({ key, expiresAt: new Date(expiresAt).getTime() });
    });
  }
  async hasSession(key) {
    await this.queue;
    return this.data.sessions.some(
      (x) => x.key === key && x.expiresAt > Date.now(),
    );
  }
  deleteSession(key) {
    return this.mutate((data) => {
      data.sessions = data.sessions.filter((x) => x.key !== key);
    });
  }
  async close() {
    await this.queue;
  }
}
