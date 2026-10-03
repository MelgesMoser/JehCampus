import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from '../server.mjs';
import { seed } from '../dist/data/seed.js';
import { createServices } from '../dist/services/domain.js';
import { loadConfig } from '../server/config.mjs';

function testRepository() {
  let state = seed();
  state.revision = 1;
  state.appointments = [];
  state.customers = [];
  state.settings.hours.forEach(day => day.open = true);
  const sessions = new Map(), requests = new Map();
  const api = createServices({
    read: () => structuredClone(state), subscribe: () => () => {},
    async transaction(fn) { const draft = structuredClone(state); const result = fn(draft); state = draft; state.revision++; return result; },
  });
  return {
    sessions,
    async snapshot() { return structuredClone(state); },
    async revision() { return state.revision; },
    async execute(operation, args, key) {
      if (key && requests.has(key)) return requests.get(key);
      const result = await api[operation](...args);
      if (key) requests.set(key, result);
      return result;
    },
    async saveSession(id, expiresAt) { sessions.set(id, expiresAt); },
    async hasSession(id) { return sessions.has(id) && sessions.get(id) > new Date(); },
    async deleteSession(id) { sessions.delete(id); },
  };
}

async function setup() {
  const repository = testRepository();
  const config = { mode: 'mongodb', username: 'admin', password: 'a-local-test-password-123', origin: '' };
  const server = createServer({ config, runtime: { getRepository: async () => repository } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '', origin = base) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body),
  });
  const login = async () => {
    const response = await post('/api/auth/login', { username: config.username, password: config.password });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  return { repository, base, post, login, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
const booking = { name: 'Cliente teste API', phone: '11944443333', serviceId: 's1', date: '2099-10-20', time: '10:00', notes: 'Observação privada' };

test('API pública não expõe nome, telefone, observações, ID de cliente ou valor das reservas', async () => {
  const app = await setup();
  try {
    const response = await app.post('/api/operations', { operation: 'createAppointment', args: [booking], requestId: randomUUID() });
    assert.equal(response.status, 200);
    const state = await (await fetch(app.base + '/api/snapshot')).json();
    assert.equal(state.authenticated, false);
    assert.deepEqual(state.snapshot.customers, []);
    const json = JSON.stringify(state);
    assert.ok(!json.includes(booking.name)); assert.ok(!json.includes(booking.phone)); assert.ok(!json.includes(booking.notes));
    assert.deepEqual(Object.keys(state.snapshot.appointments[0]).sort(), ['date','duration','status','time']);
  } finally { await app.close(); }
});

test('CRUD administrativo exige sessão e protege contra requisições de outra origem', async () => {
  const app = await setup();
  try {
    const operation = { operation: 'updateService', args: ['s1', { price: 70 }] };
    assert.equal((await app.post('/api/operations', operation)).status, 401);
    const cookie = await app.login();
    assert.equal((await app.post('/api/operations', operation, cookie, 'https://outro-site.example')).status, 403);
    assert.equal((await app.post('/api/operations', operation, cookie)).status, 200);
    const state = await (await fetch(app.base + '/api/snapshot', { headers: { Cookie: cookie } })).json();
    assert.equal(state.authenticated, true);
    assert.equal(state.snapshot.services.find(s => s.id === 's1').price, 70);
  } finally { await app.close(); }
});

test('reserva pública força Agendado e rejeita preço ou ID enviados pelo navegador', async () => {
  const app = await setup();
  try {
    const response = await app.post('/api/operations', { operation: 'createAppointment', args: [{ ...booking, status: 'Concluído' }], requestId: randomUUID() });
    assert.equal((await response.json()).result.status, 'Agendado');
    for (const extra of [{ price: 0 }, { id: 'injetado' }, { duration: 1 }, { customerId: 'c1' }]) {
      assert.equal((await app.post('/api/operations', { operation: 'createAppointment', args: [{ ...booking, ...extra }], requestId: randomUUID() })).status, 400);
    }
  } finally { await app.close(); }
});

test('servidor revalida conflito e torna repetição da confirmação idempotente', async () => {
  const app = await setup();
  try {
    const payload = { operation: 'createAppointment', args: [booking], requestId: randomUUID() };
    const first = await (await app.post('/api/operations', payload)).json();
    const repeat = await (await app.post('/api/operations', payload)).json();
    assert.equal(first.result.id, repeat.result.id);
    assert.equal((await app.repository.snapshot()).appointments.length, 1);
    assert.equal((await app.post('/api/operations', { ...payload, requestId: randomUUID(), args: [{ ...booking, phone: '11955556666' }] })).status, 409);
  } finally { await app.close(); }
});

test('logout e expiração revogam o acesso administrativo no servidor', async () => {
  const app = await setup();
  try {
    const cookie = await app.login();
    const logout = await app.post('/api/auth/logout', {}, cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await (await fetch(app.base + '/api/snapshot', { headers: { Cookie: cookie } })).json()).authenticated, false);
    const nextCookie = await app.login();
    for (const key of app.repository.sessions.keys()) app.repository.sessions.set(key, new Date(0));
    assert.equal((await (await fetch(app.base + '/api/snapshot', { headers: { Cookie: nextCookie } })).json()).authenticated, false);
  } finally { await app.close(); }
});

test('falha de conexão não revela credenciais nem muda silenciosamente para dados locais', async () => {
  const server = createServer({ config: { mode: 'mongodb', password: 'testpassword123' }, runtime: { getRepository: async () => { throw Error('mongodb://sensitive:secret@host'); } } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/snapshot`);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('configuração monta URI SCRAM com caracteres de senha codificados e rejeita placeholders', () => {
  const base = { DATA_MODE: 'mongodb', ADMIN_PASSWORD: 'admin-password-123', MONGODB_HOST: 'example.firestore.goog:443', MONGODB_USERNAME: 'name@space', MONGODB_PASSWORD: 'pass:@/word?' };
  const config = loadConfig(base);
  assert.ok(config.uri.includes('name%40space:pass%3A%40%2Fword%3F@'));
  assert.match(config.uri, /loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false/);
  assert.throws(() => loadConfig({ ...base, MONGODB_URI: 'mongodb://<username>:<password>@host' }), /Substitua/);
  assert.throws(() => loadConfig({ ...base, ADMIN_PASSWORD: '' }), /ADMIN_PASSWORD/);
});
