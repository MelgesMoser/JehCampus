import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { MongoRepository } from '../server/mongoRepository.mjs';

test('MongoDB real: persistência, transações concorrentes e rollback', { timeout: 180000 }, async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const config = { uri: replica.getUri(), database: 'integration_salon', prefix: 'qa' };
  const first = await new MongoRepository(config).connect();
  const second = await new MongoRepository(config).connect();
  const date = '2099-10-20';
  const booking = { name: 'Teste isolado', phone: '11977778888', serviceId: 's1', date, time: '10:00' };
  try {
    await t.test('banco inicializado sem clientes ou atendimentos fictícios', async () => {
      const snapshot = await first.snapshot();
      assert.equal(snapshot.customers.length, 0);
      assert.equal(snapshot.appointments.length, 0);
      assert.equal(snapshot.services.length, 6);
    });
    await t.test('duas conexões disputam o mesmo intervalo; apenas uma reserva é confirmada', async () => {
      const results = await Promise.allSettled([
        first.execute('createAppointment', [booking], 'first-request'),
        second.execute('createAppointment', [{ ...booking, phone: '11988889999' }], 'second-request'),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const snapshot = await first.snapshot();
      assert.equal(snapshot.appointments.length, 1);
      assert.equal(snapshot.customers.length, 1);
    });
    await t.test('serviços, configurações, fotos e sessões persistem entre conexões', async () => {
      await first.execute('updateService', ['s1', { price: 79 }]);
      await first.execute('updateSettings', [{ name: 'Salão de teste isolado' }]);
      const photo = await first.execute('createGalleryItem', [{ image: '/assets/unhas.png', category: 'Teste', description: 'Foto de teste' }]);
      const snapshot = await second.snapshot();
      assert.equal(snapshot.settings.name, 'Salão de teste isolado');
      assert.equal(snapshot.services.find(s => s.id === 's1').price, 79);
      assert.ok(snapshot.gallery.some(p => p.id === photo.id));
      await first.saveSession('test-session-hash', new Date(Date.now() + 10000));
      assert.equal(await second.hasSession('test-session-hash'), true);
      await second.deleteSession('test-session-hash');
      assert.equal(await first.hasSession('test-session-hash'), false);
    });
    await t.test('cancelamento libera horário; bloqueio impede reativação; falha não grava alterações parciais', async () => {
      const appointment = (await first.snapshot()).appointments[0];
      await first.execute('cancelAppointment', [appointment.id]);
      await second.execute('createBlockedTime', [{ reason: 'Pausa', startDate: date, endDate: date, startTime: '10:00', endTime: '12:00' }]);
      await assert.rejects(first.execute('updateAppointment', [appointment.id, { status: 'Confirmado' }]), /não está mais disponível/);
      assert.equal((await second.snapshot()).appointments[0].status, 'Cancelado');
      assert.equal((await second.snapshot()).blocks.length, 1);
    });
  } finally {
    await first.close(); await second.close(); await replica.stop();
  }
});
