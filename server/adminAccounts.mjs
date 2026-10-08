import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./validation.mjs";
const scrypt = promisify(derive);
export async function createAdmin(repository, body, reservedName) {
  const username =
    typeof body?.username === "string"
      ? body.username.trim().toLowerCase()
      : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (
    !/^[a-z0-9._-]{3,60}$/.test(username) ||
    name.length < 2 ||
    name.length > 100
  )
    throw new HttpError(
      400,
      "Informe nome e usuário (3 a 60 letras, números, ponto ou traço).",
    );
  if (
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    throw new HttpError(400, "Use uma senha de 12 a 128 caracteres.");
  if (username === reservedName.toLowerCase())
    throw new HttpError(409, "Este usuário já existe.");
  const salt = randomBytes(16).toString("hex");
  const account = {
    name,
    username,
    salt,
    passwordHash: (await scrypt(body.password, salt, 64)).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  if (!(await repository.createPrivateRecord("admin:" + username, account)))
    throw new HttpError(409, "Este usuário já existe.");
  return { name, username };
}
export async function verifyAdmin(repository, username, password) {
  const normalized = username.trim().toLowerCase();
  const account = /^[a-z0-9._-]{3,60}$/.test(normalized)
    ? await repository.getPrivateRecord("admin:" + normalized)
    : null;
  const candidate = await scrypt(
    password,
    account?.salt || "nonexistent-admin",
    64,
  );
  return (
    timingSafeEqual(
      candidate,
      Buffer.from(account?.passwordHash || "00".repeat(64), "hex"),
    ) && !!account
  );
}
