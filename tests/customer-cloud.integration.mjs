import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "../server.mjs";
import { DataConnectRepository } from "../server/dataConnectRepository.mjs";
import { MongoRepository } from '../server/mongoRepository.mjs';
import { loadEnvironment, loadConfig } from "../server/config.mjs";
loadEnvironment();
const config = {
  ...loadConfig(),
  dataConnectStateId: "auth-test-" + randomUUID(),
  prefix: 'auth_test_'+randomUUID().replaceAll('-','').slice(0,16),
};
assert.ok(['dataconnect','mongodb'].includes(config.mode));
const Repository=config.mode==='mongodb'?MongoRepository:DataConnectRepository;
const repository = await new Repository(config).connect();
let second;
const server = createServer({
  config,
  runtime: { getRepository: async () => repository },
}).listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const keys = [];
const sha = (v) => createHash("sha256").update(v).digest("hex");
const account = {
  email: "isolated-auth@example.invalid",
  name: "Teste isolado de conta",
  phone: "11999990000",
  password: randomUUID(),
};
keys.push("account:" + sha(account.email));
const post = (path, body, cookie = "") =>
  fetch(base + path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
const takeCookie = (response) => {
  const cookie = response.headers.get("set-cookie").split(";")[0];
  keys.push("customer-session:" + sha(cookie.split("=")[1]));
  return cookie;
};
try {
  const booking = {
    operation: "createAppointment",
    args: [
      {
        serviceId: "s1",
        date: "2099-10-20",
        time: "10:00",
        name: "Ignorar nome enviado",
        phone: "11911112222",
      },
    ],
    requestId: randomUUID(),
  };
  assert.equal((await post("/api/operations", booking)).status, 401);
  const registration = await post("/api/customer/register", account);
  assert.equal(registration.status, 200);
  const cookie = takeCookie(registration);
  assert.equal((await post("/api/operations", booking, cookie)).status, 200);
  assert.equal((await repository.snapshot()).customers[0].name, account.name);
  assert.equal(
    (
      await post(
        "/api/operations",
        { operation: "deleteService", args: ["s2"] },
        cookie,
      )
    ).status,
    401,
  );
  await post("/api/customer/logout", {}, cookie);
  assert.equal((await post("/api/operations", booking, cookie)).status, 401);
  assert.equal(
    (
      await post("/api/customer/login", {
        email: account.email,
        password: "incorrect-password",
      })
    ).status,
    401,
  );
  const login = await post("/api/customer/login", {
    email: account.email,
    password: account.password,
  });
  assert.equal(login.status, 200);
  const next = takeCookie(login);
  const snapshot = await (
    await fetch(base + "/api/snapshot", { headers: { Cookie: next } })
  ).json();
  assert.equal(snapshot.customer.email, account.email);
  assert.equal(snapshot.authenticated, false);
  assert.ok(!JSON.stringify(snapshot).includes("passwordHash"));
  second = await new Repository(config).connect();
  assert.ok((await second.getPrivateRecord(keys[0])).passwordHash);
  const concurrent={name:account.name,phone:account.phone,serviceId:'s3',date:'2099-10-20',time:'14:00'};
  const results=await Promise.allSettled([repository.execute('createAppointment',[concurrent],'race-a'),second.execute('createAppointment',[{...concurrent,time:'14:30'}],'race-b')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  console.log(
    "PASS remoto: cadastro, senha incorreta, login, reserva autenticada, isolamento do admin, logout, persistência e concorrência entre conexões.",
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  if(config.mode==='mongodb') {
    assert.match(config.prefix,/^auth_test_[a-f0-9]{16}$/);
    for(const name of ['services','appointments','customers','blocks','gallery','settings','meta','sessions','requests','private'])await repository.collection(name).drop();
  } else {
    for (const key of keys) await repository.deletePrivateRecord(key);
    await repository.transport.execute(
    "mutation Clean($id:String!){salonState_delete(key:{id:$id})}",
    { id: repository.stateId },
  );
  }
  if(second)await second.close();
  await repository.close();
}
