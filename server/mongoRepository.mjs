import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";
import { seed } from "../dist/data/seed.js";
import { createServices } from "../dist/services/domain.js";

const collections = [
  "services",
  "appointments",
  "customers",
  "blocks",
  "gallery",
];
const transactionOptions = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
  maxCommitTimeMS: 10000,
};
const clean = ({ _id, ...record }) => record;

export class MongoRepository {
  constructor(config, client) {
    this.config = config;
    this.client =
      client ||
      new MongoClient(config.uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 20000,
        maxPoolSize: 10,
        maxIdleTimeMS: 5000,
        appName: "Espaco-Jeh-Campus",
      });
    if (process.env.VERCEL) attachDatabasePool(this.client);
    this.db = this.client.db(config.database);
  }

  collection(name) {
    return this.db.collection(`${this.config.prefix}_${name}`);
  }

  async connect() {
    await this.client.connect();
    await this.db.command({ ping: 1 });
    for (const name of [
      ...collections,
      "settings",
      "meta",
      "sessions",
      "requests",
      "private",
    ]) {
      try {
        await this.db.createCollection(`${this.config.prefix}_${name}`);
      } catch (error) {
        if (error.code !== 48 && error.codeName !== "NamespaceExists")
          throw error;
      }
    }
    // Never seed demo customers or demo appointments into the real database.
    await this.collection("meta").updateOne(
      { _id: "salon" },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
    await this.client.withSession(async (session) =>
      session.withTransaction(async () => {
        const meta = await this.collection("meta").findOne(
          { _id: "salon" },
          { session },
        );
        if (meta.initialized) return;
        await this.collection("meta").updateOne(
          { _id: "salon" },
          { $inc: { revision: 1 }, $set: { initialized: true } },
          { session },
        );
        const initial = seed();
        for (const name of ["services", "gallery"]) {
          for (const item of initial[name]) {
            await this.collection(name).updateOne(
              { _id: item.id },
              { $setOnInsert: item },
              { upsert: true, session },
            );
          }
        }
        await this.collection("settings").updateOne(
          { _id: "salon" },
          { $setOnInsert: initial.settings },
          { upsert: true, session },
        );
      }, transactionOptions),
    );
    return this;
  }

  async read(session) {
    const state = { version: 1 };
    // MongoDB does not support parallel operations inside one transaction.
    for (const name of collections)
      state[name] = (
        await this.collection(name).find({}, { session }).toArray()
      ).map(clean);
    const settings = await this.collection("settings").findOne(
      { _id: "salon" },
      { session },
    );
    if (!settings) throw new Error("Configuração do salão não encontrada.");
    state.settings = clean(settings);
    state.revision = (
      await this.collection("meta").findOne({ _id: "salon" }, { session })
    ).revision;
    return state;
  }

  async snapshot() {
    return this.client.withSession((session) =>
      session.withTransaction(() => this.read(session), transactionOptions),
    );
  }

  async revision() {
    return (await this.collection("meta").findOne({ _id: "salon" })).revision;
  }

  async execute(operation, args, requestKey) {
    return this.client.withSession((session) =>
      session.withTransaction(async () => {
        // All schedule mutations touch the same document BEFORE reading the agenda.
        // Competing transactions retry against fresh state, including across servers.
        await this.collection("meta").updateOne(
          { _id: "salon" },
          { $inc: { revision: 1 } },
          { session },
        );
        if (requestKey) {
          const previous = await this.collection("requests").findOne(
            { _id: requestKey },
            { session },
          );
          if (previous) return previous.result;
        }
        const before = await this.read(session);
        const draft = structuredClone(before);
        const port = {
          read: () => structuredClone(draft),
          transaction: async (fn) => fn(draft),
          subscribe: () => () => {},
        };
        const result = await createServices(port)[operation](...args);
        for (const name of collections) {
          const old = new Map(before[name].map((item) => [item.id, item]));
          for (const item of draft[name]) {
            if (JSON.stringify(old.get(item.id)) !== JSON.stringify(item)) {
              await this.collection(name).replaceOne(
                { _id: item.id },
                { _id: item.id, ...item },
                { upsert: true, session },
              );
            }
            old.delete(item.id);
          }
          for (const id of old.keys())
            await this.collection(name).deleteOne({ _id: id }, { session });
        }
        if (
          JSON.stringify(before.settings) !== JSON.stringify(draft.settings)
        ) {
          await this.collection("settings").replaceOne(
            { _id: "salon" },
            { _id: "salon", ...draft.settings },
            { session },
          );
        }
        if (requestKey)
          await this.collection("requests").insertOne(
            { _id: requestKey, result, createdAt: new Date() },
            { session },
          );
        return result;
      }, transactionOptions),
    );
  }

  async saveSession(id, expiresAt) {
    await this.collection("sessions").deleteMany({
      expiresAt: { $lt: new Date() },
    });
    await this.collection("sessions").insertOne({ _id: id, expiresAt });
  }
  async hasSession(id) {
    return !!(await this.collection("sessions").findOne({
      _id: id,
      expiresAt: { $gt: new Date() },
    }));
  }
  async deleteSession(id) {
    await this.collection("sessions").deleteOne({ _id: id });
  }
  async close() {
    await this.client.close();
  }
  async getPrivateRecord(key) {
    return (
      (await this.collection("private").findOne({ _id: key }))?.value || null
    );
  }
  async createPrivateRecord(key, value) {
    try {
      await this.collection("private").insertOne({ _id: key, value });
      return true;
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }
  async deletePrivateRecord(key) {
    await this.collection("private").deleteOne({ _id: key });
  }
}
