import { MongoClient } from "mongodb";
import { loadEnvironment, loadConfig } from "../server/config.mjs";
import { DataConnectRepository } from "../server/dataConnectRepository.mjs";

loadEnvironment();
let client;
try {
  const config = loadConfig();
  if (config.mode === "local")
    throw new Error("DATA_MODE=local. Configure um banco remoto no .env.");
  if (config.mode === "dataconnect") {
    const repository = new DataConnectRepository(config);
    const snapshot = await repository.snapshot();
    console.log(
      `Firebase Data Connect conectado: ${config.firebaseProject} / ${config.dataConnectService}. Revisão ${snapshot.revision}; ${snapshot.services.length} serviços. Nenhum dado foi alterado pelo teste.`,
    );
  } else {
    client = new MongoClient(config.uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    await client.db(config.database).command({ ping: 1 });
    await client
      .db(config.database)
      .collection(`${config.prefix}_meta`)
      .findOne({ _id: "salon" });
    console.log(
      "Conexão e leitura autenticadas com sucesso. Nenhum dado foi alterado por este teste.",
    );
  }
} catch (error) {
  const message = error.name?.startsWith("Mongo")
    ? error.code === 18
      ? "O banco recusou o usuário ou a senha. Confira as credenciais SCRAM."
      : "Não foi possível acessar o banco. Confira rede, credenciais e permissões de leitura/escrita do MongoDB."
    : error.message;
  console.error(message);
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
