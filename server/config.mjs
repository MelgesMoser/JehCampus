import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export function loadConfig(env = process.env) {
  const mode = env.DATA_MODE || "local";
  if (!["local", "file", "mongodb", "dataconnect"].includes(mode))
    throw new Error("DATA_MODE deve ser local, file, mongodb ou dataconnect.");
  const config = {
    mode,
    localDatabase: fileURLToPath(
      new URL("../.run/local-database.json", import.meta.url),
    ),
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4173),
    origin: env.PUBLIC_ORIGIN || "",
    vercel: env.VERCEL === "1",
    allowedOrigins: [
      env.PUBLIC_ORIGIN,
      ...[env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
        .filter(Boolean)
        .map((host) => `https://${host}`),
    ].filter(Boolean),
    username: env.ADMIN_USERNAME || "admin",
    password: env.ADMIN_PASSWORD || "",
    prefix: env.MONGODB_COLLECTION_PREFIX || "jeh_campus",
    database: env.MONGODB_DATABASE || "default",
  };
  if (!/^[a-zA-Z0-9_]{1,40}$/.test(config.prefix))
    throw new Error("Prefixo de coleções inválido.");
  if (mode !== "local") {
    if (config.password.length < 12)
      throw new Error(
        "Defina ADMIN_PASSWORD com pelo menos 12 caracteres no arquivo .env.",
      );
  }
  if (mode === "file" && env.VERCEL)
    throw new Error(
      "Na Vercel, utilize MongoDB; o disco local não é persistente.",
    );
  if (mode === "dataconnect") {
    config.firebaseProject = env.FIREBASE_PROJECT_ID;
    config.dataConnectLocation = env.DATA_CONNECT_LOCATION;
    config.dataConnectService = env.DATA_CONNECT_SERVICE;
    config.dataConnectAuth = env.DATA_CONNECT_AUTH || "adc";
    config.firebaseCliPath = env.FIREBASE_CLI_PATH;
    for (const value of [
      config.firebaseProject,
      config.dataConnectLocation,
      config.dataConnectService,
    ]) {
      if (!value || !/^[a-z0-9-]+$/.test(value))
        throw new Error(
          "Preencha FIREBASE_PROJECT_ID, DATA_CONNECT_LOCATION e DATA_CONNECT_SERVICE.",
        );
    }
    if (!["adc", "firebase-cli"].includes(config.dataConnectAuth))
      throw new Error("DATA_CONNECT_AUTH deve ser adc ou firebase-cli.");
    if (
      config.dataConnectAuth === "firebase-cli" &&
      !["127.0.0.1", "localhost", "::1"].includes(config.host)
    )
      throw new Error(
        "Para hospedar o site, utilize DATA_CONNECT_AUTH=adc com identidade do servidor.",
      );
  }
  if (mode === "mongodb") {
    if (env.MONGODB_URI) {
      if (/[<>]/.test(env.MONGODB_URI))
        throw new Error(
          "Substitua os campos de usuário e senha da conexão no arquivo .env.",
        );
      config.uri = env.MONGODB_URI;
    } else {
      if (!env.MONGODB_USERNAME || !env.MONGODB_PASSWORD || !env.MONGODB_HOST) {
        throw new Error(
          "Preencha MONGODB_HOST, MONGODB_USERNAME e MONGODB_PASSWORD no arquivo .env.",
        );
      }
      config.uri = `mongodb://${encodeURIComponent(env.MONGODB_USERNAME)}:${encodeURIComponent(env.MONGODB_PASSWORD)}@${env.MONGODB_HOST}/${encodeURIComponent(config.database)}?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false`;
    }
    if (!/^mongodb(?:\+srv)?:\/\//.test(config.uri))
      throw new Error("Use uma conexão mongodb:// ou mongodb+srv:// válida.");
  }
  if (
    !["127.0.0.1", "localhost", "::1"].includes(config.host) &&
    !config.origin.startsWith("https://")
  ) {
    throw new Error("Para acesso externo, configure PUBLIC_ORIGIN com HTTPS.");
  }
  return config;
}

export function loadEnvironment() {
  try {
    loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error("Não foi possível ler o arquivo .env.");
  }
}
