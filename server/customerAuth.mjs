import {
  randomBytes,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./validation.mjs";
const scrypt = promisify(derive);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cookieName = "jeh_customer_session";
const profile = (account) => ({
  name: account.name,
  email: account.email,
  phone: account.phone,
});
const tokenFrom = (req) =>
  (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1) || "";

export function customerAuth({ config, send, readBody, limit }) {
  const cookie = (token, maxAge = 28800) =>
    `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${config.vercel || config.origin?.startsWith("https://") ? "; Secure" : ""}`;
  async function current(req, repository) {
    const token = tokenFrom(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await repository.getPrivateRecord(
      "customer-session:" + hash(token),
    );
    if (!session || session.expiresAt <= Date.now()) return null;
    const account = await repository.getPrivateRecord(session.accountId);
    return account ? profile(account) : null;
  }
  async function handle(req, res, url, repository) {
    if (!url.pathname.startsWith("/api/customer/")) return false;
    if (req.method !== "POST")
      throw new HttpError(405, "Método não permitido.");
    if (url.pathname === "/api/customer/logout") {
      const token = tokenFrom(req);
      if (/^[a-f0-9]{64}$/.test(token))
        await repository.deletePrivateRecord("customer-session:" + hash(token));
      res.setHeader("Set-Cookie", cookie("", 0));
      send(res, 200, { customer: null });
      return true;
    }
    const register = url.pathname === "/api/customer/register";
    if (!register && url.pathname !== "/api/customer/login")
      throw new HttpError(404, "Recurso não encontrado.");
    limit(req, "customer-auth", 12);
    const body = await readBody(req);
    if (
      !body ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    )
      throw new HttpError(400, "Informe e-mail e senha.");
    const email = body.email.trim().toLowerCase();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      body.password.length > 128
    )
      throw new HttpError(
        400,
        "Informe um e-mail válido e senha de até 128 caracteres.",
      );
    const key = "account:" + hash(email);
    let account = await repository.getPrivateRecord(key);
    if (register) {
      if (body.password.length < 12)
        throw new HttpError(400, "Use uma senha com pelo menos 12 caracteres.");
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const phone =
        typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
      if (name.length < 2 || name.length > 100 || !/^\d{10,13}$/.test(phone))
        throw new HttpError(400, "Informe nome completo e WhatsApp com DDD.");
      if (account)
        throw new HttpError(
          409,
          "Não foi possível cadastrar este e-mail. Se já possui conta, entre com sua senha.",
        );
      const salt = randomBytes(16).toString("hex");
      account = {
        name,
        phone,
        email,
        salt,
        passwordHash: (await scrypt(body.password, salt, 64)).toString("hex"),
      };
      if (!(await repository.createPrivateRecord(key, account)))
        throw new HttpError(
          409,
          "Não foi possível cadastrar este e-mail. Se já possui conta, entre com sua senha.",
        );
    } else {
      const candidate = await scrypt(
        body.password,
        account?.salt || "invalid-account-salt",
        64,
      );
      const expected = Buffer.from(
        account?.passwordHash || "00".repeat(64),
        "hex",
      );
      if (!timingSafeEqual(candidate, expected) || !account)
        throw new HttpError(401, "E-mail ou senha incorretos.");
    }
    const old = tokenFrom(req);
    if (/^[a-f0-9]{64}$/.test(old))
      await repository.deletePrivateRecord("customer-session:" + hash(old));
    const token = randomBytes(32).toString("hex");
    await repository.createPrivateRecord("customer-session:" + hash(token), {
      accountId: key,
      expiresAt: Date.now() + 28800000,
    });
    res.setHeader("Set-Cookie", cookie(token));
    send(res, 200, { customer: profile(account) });
    return true;
  }
  return { current, handle };
}
