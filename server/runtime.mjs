import { FileRepository } from "./fileRepository.mjs";
import { MongoRepository } from "./mongoRepository.mjs";
import { DataConnectRepository } from "./dataConnectRepository.mjs";
export function createRuntime(config) {
  let connection,
    repository,
    lastFailure = 0;
  return {
    async getRepository() {
      if (repository) return repository;
      if (Date.now() - lastFailure < 5000)
        throw new Error("Aguardando reconexão.");
      if (!connection) {
        const candidate =
          config.mode === "file"
            ? new FileRepository(config)
            : config.mode === "dataconnect"
              ? new DataConnectRepository(config)
              : new MongoRepository(config);
        connection = candidate
          .connect()
          .then((connected) => {
            repository = connected;
            return connected;
          })
          .catch(async () => {
            lastFailure = Date.now();
            connection = null;
            await candidate.close().catch(() => {});
            throw new Error("Banco indisponível.");
          });
      }
      return connection;
    },
    async close() {
      if (repository) await repository.close();
    },
  };
}
