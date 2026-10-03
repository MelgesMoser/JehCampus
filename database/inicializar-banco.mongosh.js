/**
 * Espaço Jeh Campus — inicialização do banco
 * Execute com mongosh conectado ao banco default.
 * Compatível com as coleções utilizadas por server/mongoRepository.mjs.
 * Não contém credenciais nem clientes/agendamentos fictícios.
 */
const PREFIX = 'jeh_campus';
const DATABASE = 'default';

if (db.getName() !== DATABASE) {
  throw new Error('Conecte ao banco ' + DATABASE + ' antes de executar este script.');
}

await db.runCommand({ ping: 1 });
const collectionNames = [
  'services', 'appointments', 'customers', 'blocks', 'gallery',
  'settings', 'meta', 'sessions', 'requests'
];

for (const name of collectionNames) {
  try {
    await db.createCollection(PREFIX + '_' + name);
  } catch (error) {
    if (error.code !== 48 && error.codeName !== 'NamespaceExists') throw error;
  }
}

// Catálogo inicial editável pelo painel. Preços e expediente são demonstrativos.
const services = [
  {
    "id": "s1",
    "name": "Manicure & pedicure",
    "description": "Um cuidado essencial, com acabamento delicado e atenção a cada detalhe.",
    "category": "Cuidados essenciais",
    "image": "/assets/unhas.png",
    "price": 65,
    "duration": 90,
    "active": true
  },
  {
    "id": "s2",
    "name": "Alongamento em gel",
    "description": "Comprimento, resistência e naturalidade em perfeita harmonia.",
    "category": "Alongamentos",
    "image": "/assets/unhas.png",
    "price": 160,
    "duration": 120,
    "active": true
  },
  {
    "id": "s3",
    "name": "Esmaltação em gel",
    "description": "Cor intensa e brilho duradouro para acompanhar a sua rotina.",
    "category": "Esmaltação",
    "image": "/assets/noiva.png",
    "price": 85,
    "duration": 60,
    "active": true
  },
  {
    "id": "s4",
    "name": "Blindagem / banho de gel",
    "description": "Uma camada de proteção e beleza para suas unhas naturais.",
    "category": "Cuidados essenciais",
    "image": "/assets/unhas.png",
    "price": 110,
    "duration": 90,
    "active": true
  },
  {
    "id": "s5",
    "name": "Spa dos pés",
    "description": "Uma pausa de relaxamento com escalda-pés e cuidado especial.",
    "category": "Bem-estar",
    "image": "/assets/espaco.png",
    "price": 90,
    "duration": 60,
    "active": true
  },
  {
    "id": "s6",
    "name": "Manutenção do gel",
    "description": "Renove o formato e o acabamento das suas unhas.",
    "category": "Alongamentos",
    "image": "/assets/noiva.png",
    "price": 100,
    "duration": 90,
    "active": true
  }
];
const gallery = [
  {
    "id": "g1",
    "image": "/assets/unhas.png",
    "description": "A delicadeza dos tons rosados",
    "category": "Alongamentos"
  },
  {
    "id": "g2",
    "image": "/assets/noiva.png",
    "description": "Um detalhe para o seu grande dia",
    "category": "Noivas"
  },
  {
    "id": "g3",
    "image": "/assets/espaco.png",
    "description": "Um espaço pensado para acolher",
    "category": "Nosso espaço"
  }
];
const settings = {
  "name": "Espaço Jeh Campus",
  "logo": "",
  "phone": "",
  "whatsapp": "",
  "instagram": "espaco_jehcampus",
  "address": "Av. Pref. Hirant Sanazar, 1597 (antigo 38) · Jardim Oriental · Osasco/SP · CEP 06033-255",
  "cancellationPolicy": "Se precisar cancelar ou reagendar, entre em contato com pelo menos 24 horas de antecedência.",
  "slotInterval": 30,
  "hours": [
    {
      "day": 0,
      "open": false,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 1,
      "open": true,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 2,
      "open": true,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 3,
      "open": true,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 4,
      "open": true,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 5,
      "open": true,
      "start": "09:00",
      "end": "18:00"
    },
    {
      "day": 6,
      "open": true,
      "start": "09:00",
      "end": "17:00"
    }
  ]
};

// Documento compartilhado que coordena as transações de agendamento.
await db.getCollection(PREFIX + '_meta').updateOne(
  { _id: 'salon' },
  { $setOnInsert: { revision: 0 } },
  { upsert: true }
);

const session = db.getMongo().startSession();
try {
  await session.withTransaction(async () => {
    const database = session.getDatabase(DATABASE);
    const meta = database.getCollection(PREFIX + '_meta');
    const existing = await meta.findOne({ _id: 'salon' });
    if (existing.initialized) {
      print('Banco já inicializado. Dados existentes preservados.');
      return;
    }

    await meta.updateOne(
      { _id: 'salon' },
      { $inc: { revision: 1 }, $set: { initialized: true } }
    );

    for (const service of services) {
      await database.getCollection(PREFIX + '_services').updateOne(
        { _id: service.id }, { $setOnInsert: service }, { upsert: true }
      );
    }
    for (const photo of gallery) {
      await database.getCollection(PREFIX + '_gallery').updateOne(
        { _id: photo.id }, { $setOnInsert: photo }, { upsert: true }
      );
    }
    await database.getCollection(PREFIX + '_settings').updateOne(
      { _id: 'salon' }, { $setOnInsert: settings }, { upsert: true }
    );
  }, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' }
  });
} finally {
  await session.endSession();
}

print('Banco do Espaço Jeh Campus pronto.');
print('Coleções: ' + collectionNames.map(name => PREFIX + '_' + name).join(', '));
print('Clientes e agendamentos serão cadastrados pelo sistema.');
