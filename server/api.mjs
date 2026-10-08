import { createAdmin, verifyAdmin } from "./adminAccounts.mjs";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { HttpError, validateOperation, publicSnapshot } from "./validation.mjs";
import { customerAuth } from "./customerAuth.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const cookieName = "jeh_admin_session";
export function createApi({ config, getRepository }) {
  const attempts = new Map();
  const salt = randomBytes(32);
  const passwordHash = scryptSync(
    config.password || "local-mode-unused",
    salt,
    64,
  );
  const send = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const tokenFrom = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || "";
  const cookie = (token, expires = 28800) =>
    `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expires}${config.vercel || config.origin?.startsWith("https://") ? "; Secure" : ""}`;

  function limit(req, group, max) {
    const now = Date.now(),
      key =
        group +
        ":" +
        (config.vercel
          ? req.headers["x-vercel-forwarded-for"] || req.socket.remoteAddress
          : req.socket.remoteAddress);
    // Trust Vercel's overwritten IP header only inside the Vercel runtime.
    // This bounded per-instance limiter complements the hosting firewall.
    for (const [id, value] of attempts)
      if (value.until < now) attempts.delete(id);
    if (!attempts.has(key)) {
      if (attempts.size >= 10000)
        throw new HttpError(
          429,
          "Muitas solicitações. Tente novamente mais tarde.",
        );
      attempts.set(key, { count: 0, until: now + 15 * 60 * 1000 });
    }
    if (++attempts.get(key).count > max)
      throw new HttpError(
        429,
        "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      );
  }

  async function readBody(req) {
    if (req.body !== undefined) {
      const raw =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(raw) > 3000000)
        throw new HttpError(413, "Formulário muito grande.");
      try {
        return JSON.parse(raw);
      } catch {
        throw new HttpError(400, "JSON inválido.");
      }
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 3000000)
        throw new HttpError(413, "Imagem ou formulário muito grande.");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new HttpError(400, "JSON inválido.");
    }
  }

  async function signedIn(req, repository) {
    const token = tokenFrom(req);
    return (
      /^[a-f0-9]{64}$/.test(token) && (await repository.hasSession(hash(token)))
    );
  }

  const customers = customerAuth({ config, send, readBody, limit });
  return async function handleApi(req, res, url) {
    if (!url.pathname.startsWith("/api/")) return false;
    try {
      if (!["GET", "POST"].includes(req.method))
        throw new HttpError(405, "Método não permitido.");
      if (req.method === "POST") {
        const origin = config.origin || `http://${req.headers.host}`;
        if (
          !(
            config.allowedOrigins?.length ? config.allowedOrigins : [origin]
          ).includes(req.headers.origin)
        )
          throw new HttpError(403, "Origem não permitida.");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new HttpError(415, "Envie dados em JSON.");
      }
      if (url.pathname === "/api/config" && req.method === "GET") {
        send(res, 200, { mode: config.mode });
        return true;
      }
      if (url.pathname === "/api/health" && req.method === "GET") {
        send(res, 200, {
          application: "espaco-jeh-campus",
          projectId: config.projectId,
          pid: process.pid,
          mode: config.mode,
        });
        return true;
      }
      if (!["mongodb", "dataconnect"].includes(config.mode))
        throw new HttpError(
          503,
          "O banco compartilhado ainda não está ativado.",
        );
      let repository;
      try {
        repository = await getRepository();
      } catch {
        throw new HttpError(
          503,
          "Não foi possível conectar ao banco. Verifique as credenciais e a conexão no servidor.",
        );
      }

      if (await customers.handle(req, res, url, repository)) return true;
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        limit(req, "login", 8);
        const body = await readBody(req);
        if (
          !body ||
          typeof body.username !== "string" ||
          typeof body.password !== "string" ||
          body.password.length > 256
        )
          throw new HttpError(400, "Informe usuário e senha.");
        const validPassword = timingSafeEqual(
          scryptSync(body.password, salt, 64),
          passwordHash,
        );
        if (
          !(validPassword && body.username === config.username) &&
          !(await verifyAdmin(repository, body.username, body.password))
        )
          throw new HttpError(401, "Usuário ou senha incorretos.");
        const token = randomBytes(32).toString("hex");
        const oldToken = tokenFrom(req);
        if (oldToken) await repository.deleteSession(hash(oldToken));
        await repository.saveSession(
          hash(token),
          new Date(Date.now() + 8 * 60 * 60 * 1000),
        );
        res.setHeader("Set-Cookie", cookie(token));
        send(res, 200, { authenticated: true });
        return true;
      }
      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        const token = tokenFrom(req);
        if (token) await repository.deleteSession(hash(token));
        res.setHeader("Set-Cookie", cookie("", 0));
        send(res, 200, { authenticated: false });
        return true;
      }

      const authenticated = await signedIn(req, repository);
      if (url.pathname === "/api/admin/accounts" && req.method === "POST") {
        if (!authenticated)
          throw new HttpError(
            401,
            "Entre como administrador para criar outro administrador.",
          );
        limit(req, "create-admin", 20);
        const account = await createAdmin(
          repository,
          await readBody(req),
          config.username,
        );
        send(res, 201, { account });
        return true;
      }
      const customer = await customers.current(req, repository);
      if (url.pathname === "/api/snapshot" && req.method === "GET") {
        if (
          url.searchParams.get("revision") ===
            String(await repository.revision()) &&
          url.searchParams.get("scope") === (authenticated ? "admin" : "public")
        ) {
          send(res, 200, { unchanged: true, authenticated, customer });
          return true;
        }
        const state = await repository.snapshot();
        send(res, 200, {
          authenticated,
          customer,
          snapshot: authenticated ? state : publicSnapshot(state),
        });
        return true;
      }
      if (url.pathname === "/api/operations" && req.method === "POST") {
        const body = await readBody(req);
        if (!body || typeof body.operation !== "string")
          throw new HttpError(400, "Operação inválida.");
        if (!authenticated && body.operation !== "createAppointment")
          throw new HttpError(401, "Entre no painel para continuar.");
        if (!authenticated && !customer)
          throw new HttpError(
            401,
            "Entre na sua conta para confirmar o agendamento.",
          );
        const args = validateOperation(body.operation, body.args);
        if (!authenticated) {
          limit(req, "booking", 30);
          // Public clients cannot set status, customer IDs, price, or duration.
          args[0] = {
            ...args[0],
            name: customer.name,
            phone: customer.phone,
            status: "Agendado",
          };
        }
        let requestKey;
        if (body.operation === "createAppointment") {
          if (
            typeof body.requestId !== "string" ||
            !/^[a-f0-9-]{36}$/.test(body.requestId)
          )
            throw new HttpError(400, "Identificador da reserva inválido.");
          requestKey = hash(body.requestId + JSON.stringify(args));
        }
        let result;
        try {
          result = await repository.execute(body.operation, args, requestKey);
        } catch (error) {
          if (
            error.name?.startsWith("Mongo") ||
            error.hasErrorLabel ||
            error.code
          )
            throw new HttpError(
              503,
              "Não foi possível salvar no banco. Tente novamente; nenhuma confirmação foi emitida.",
            );
          throw new HttpError(
            409,
            error.message || "Não foi possível concluir esta alteração.",
          );
        }
        if (!authenticated) {
          const { id, serviceName, price, duration, date, time, status } =
            result;
          result = { id, serviceName, price, duration, date, time, status };
        }
        send(res, 200, { result });
        return true;
      }
      throw new HttpError(404, "Recurso não encontrado.");
    } catch (error) {
      // Do not expose driver errors, hosts, usernames, passwords, or stack traces.
      send(res, error instanceof HttpError ? error.status : 503, {
        error:
          error instanceof HttpError
            ? error.message
            : "Banco temporariamente indisponível. Tente novamente em instantes.",
      });
      return true;
    }
  };
}
