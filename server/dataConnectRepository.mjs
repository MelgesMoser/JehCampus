import { seed } from "../dist/data/seed.js";
import { createServices } from "../dist/services/domain.js";
import {
  DataConnectTransport,
  DatabaseError,
} from "./dataConnectTransport.mjs";

export const dcQueries = {
  read: "query SalonRead($id: String!) { salonState(key: {id: $id}) { revision payload } }",
  revision:
    "query SalonRevision($id: String!) { salonState(key: {id: $id}) { revision } }",
  insert:
    "mutation SalonInitialize($id: String!, $payload: String!) { salonState_insert(data: {id: $id, revision: 1, payload: $payload}) }",
  commit: `mutation SalonCommit($id: String!, $expected: Int!, $next: Int!, $payload: String!) {
    changed: salonState_updateMany(where: {id: {eq: $id}, revision: {eq: $expected}}, data: {revision: $next, payload: $payload})
  }`,
  session:
    "query SalonSessionRead($id: String!) { salonSession(key: {id: $id}) { expiresAt } }",
  saveSession:
    "mutation SalonSessionSave($id: String!, $expiresAt: Timestamp!) { salonSession_upsert(data: {id: $id, expiresAt: $expiresAt}) }",
  deleteSession:
    "mutation SalonSessionDelete($id: String!) { salonSession_delete(key: {id: $id}) }",
};

export class DataConnectRepository {
  constructor(config, transport = new DataConnectTransport(config)) {
    this.transport = transport;
    this.stateId = config.dataConnectStateId || "jeh-campus";
  }

  async connect() {
    const existing = await this.readEnvelope();
    if (!existing) {
      const state = seed();
      state.appointments = [];
      state.customers = [];
      state.blocks = [];
      const payload = JSON.stringify({ state, requests: {} });
      try {
        await this.transport.execute(dcQueries.insert, {
          id: this.stateId,
          payload,
        });
      } catch (error) {
        // Two servers may initialize together; never upsert over existing data.
        if (!(await this.readEnvelope())) throw error;
      }
    }
    return this;
  }

  async readEnvelope() {
    const result = await this.transport.execute(
      dcQueries.read,
      { id: this.stateId },
      true,
    );
    if (!result.salonState) return null;
    const { revision, payload } = result.salonState;
    try {
      const envelope = JSON.parse(payload);
      if (!envelope.state?.settings || !Number.isInteger(revision))
        throw new Error();
      return { ...envelope, revision };
    } catch {
      throw new DatabaseError("Dados do salão inválidos no banco remoto.");
    }
  }

  async snapshot() {
    const envelope = await this.readEnvelope();
    if (!envelope) throw new DatabaseError("Dados do salão não encontrados.");
    return { ...envelope.state, revision: envelope.revision };
  }

  async revision() {
    const result = await this.transport.execute(
      dcQueries.revision,
      { id: this.stateId },
      true,
    );
    if (!result.salonState) throw new DatabaseError();
    return result.salonState.revision;
  }

  async execute(operation, args, requestKey) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.readEnvelope();
      if (!before) throw new DatabaseError();
      const requests = before.requests || {};
      if (requestKey && Object.hasOwn(requests, requestKey))
        return requests[requestKey];
      const draft = structuredClone(before.state);
      const port = {
        read: () => structuredClone(draft),
        transaction: async (fn) => fn(draft),
        subscribe: () => () => {},
      };
      const result = await createServices(port)[operation](...args);
      if (requestKey) requests[requestKey] = result;
      const payload = JSON.stringify({ state: draft, requests });
      // One conditional SQL UPDATE atomically commits the entire validated state.
      // A competing writer changes revision, so we re-read and revalidate availability.
      const saved = await this.transport.execute(dcQueries.commit, {
        id: this.stateId,
        expected: before.revision,
        next: before.revision + 1,
        payload,
      });
      if (saved.changed === 1) return result;
      if (saved.changed !== 0) throw new DatabaseError();
    }
    throw new DatabaseError(
      "Agenda sendo atualizada. Tente novamente em instantes.",
    );
  }

  sessionId(id) {
    return `${this.stateId}:${id}`;
  }
  async saveSession(id, expiresAt) {
    await this.transport.execute(dcQueries.saveSession, {
      id: this.sessionId(id),
      expiresAt: expiresAt.toISOString(),
    });
  }
  async hasSession(id) {
    const data = await this.transport.execute(
      dcQueries.session,
      { id: this.sessionId(id) },
      true,
    );
    return (
      !!data.salonSession &&
      new Date(data.salonSession.expiresAt).getTime() > Date.now()
    );
  }
  async deleteSession(id) {
    await this.transport.execute(dcQueries.deleteSession, {
      id: this.sessionId(id),
    });
  }
  async close() {}
}
