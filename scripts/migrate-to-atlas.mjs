// Run with the local web server stopped. Keeps the source database untouched.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {DataConnectRepository} from '../server/dataConnectRepository.mjs';
import {loadConfig,loadEnvironment} from '../server/config.mjs';

const credentialFile=process.argv[2];
if(!credentialFile) throw new Error('Informe o caminho do arquivo de credenciais Atlas.');
loadEnvironment();
let client;
try {
  const sourceConfig=loadConfig({...process.env,DATA_MODE:'dataconnect'});
  const credentials=parseEnv(await readFile(credentialFile,'utf8'));
  const url=new URL(credentials.MONGODB_URI);
  if(url.protocol!=='mongodb+srv:' || url.hostname!=='cluster0.sufeslm.mongodb.net') throw new Error('Cluster diferente do Atlas autorizado.');
  if(!url.username)url.username=encodeURIComponent(credentials.MONGODB_USERNAME || '');
  if(!url.password)url.password=encodeURIComponent(credentials.MONGODB_PASSWORD || '');
  if(!url.username || !url.password || /[<>]/.test(url.toString())) throw new Error('Credenciais Atlas incompletas.');
  const uri=url.toString();
  const database='jeh_campus',prefix=sourceConfig.prefix;
  client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,connectTimeoutMS:10000});
  await client.connect();
  const db=client.db(database);
  await db.command({ping:1});
  const source=new DataConnectRepository(sourceConfig);
  const envelope=await source.readEnvelope();
  if(!envelope) throw new Error('Dados de origem não encontrados.');
  const accounts=[];
  for(let offset=0;;offset+=100) {
    const page=await source.transport.execute('query AccountMigration($offset:Int!){salonStates(limit:100,offset:$offset,orderBy:{id:ASC}){id payload}}',{offset},true);
    for(const row of page.salonStates) {
      const start=`${source.stateId}:private:account:`;
      if(row.id.startsWith(start)) accounts.push({_id:row.id.slice(`${source.stateId}:private:`.length),value:JSON.parse(row.payload)});
    }
    if(page.salonStates.length<100)break;
  }
  assert.equal(await source.revision(),envelope.revision,'A origem mudou durante a migração. Tente novamente com o servidor parado.');
  const names=['services','appointments','customers','blocks','gallery','settings','meta','sessions','requests','private'];
  const collection=name=>db.collection(`${prefix}_${name}`);
  for(const name of names){try{await db.createCollection(`${prefix}_${name}`);}catch(e){if(e.code!==48)throw e;}}
  await client.withSession(session=>session.withTransaction(async()=>{
    for(const name of names) if(await collection(name).findOne({},{session}))throw new Error('Destino contém registros. Nenhum dado foi sobrescrito.');
    for(const name of ['services','appointments','customers','blocks','gallery']) {
      if(envelope.state[name].length)await collection(name).insertMany(envelope.state[name].map(item=>({_id:item.id,...item})),{session});
    }
    await collection('settings').insertOne({_id:'salon',...envelope.state.settings},{session});
    if(accounts.length)await collection('private').insertMany(accounts,{session});
    const requests=Object.entries(envelope.requests||{}).map(([key,result])=>({_id:key,result,createdAt:new Date()}));
    if(requests.length)await collection('requests').insertMany(requests,{session});
    await collection('meta').insertOne({_id:'salon',revision:envelope.revision,initialized:true,migratedFrom:'jehcampus-bd-service',migratedAt:new Date()},{session});
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}}));
  // Compare every transferred document, including password hashes, without logging them.
  for(const name of ['services','appointments','customers','blocks','gallery']) {
    const values=(await collection(name).find({}).toArray()).map(({_id,...item})=>item).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(values,[...envelope.state[name]].sort((a,b)=>a.id.localeCompare(b.id)));
  }
  assert.deepEqual((await collection('private').find({}).toArray()).sort((a,b)=>a._id.localeCompare(b._id)),accounts.sort((a,b)=>a._id.localeCompare(b._id)));
  const {_id,...settings}=await collection('settings').findOne({_id:'salon'});
  assert.deepEqual(settings,envelope.state.settings);
  const envPath=fileURLToPath(new URL('../.env',import.meta.url));
  let env=await readFile(envPath,'utf8');
  for(const [key,value] of Object.entries({DATA_MODE:'mongodb',MONGODB_URI:uri,MONGODB_DATABASE:database})) {
    const pattern=new RegExp('^'+key+'=.*$','m');
    env=pattern.test(env)?env.replace(pattern,()=>key+'='+value):env.trimEnd()+'\n'+key+'='+value+'\n';
  }
  await writeFile(envPath,env);
  console.log(JSON.stringify({migrated:true,database,services:envelope.state.services.length,appointments:envelope.state.appointments.length,customers:envelope.state.customers.length,accounts:accounts.length,sourcePreserved:true}));
} catch(error) {
  // Never print a driver error containing connection details or authentication payloads.
  console.error(error.name?.startsWith('Mongo')?'Falha no Atlas. Migração não concluída; configuração anterior preservada.':error.message);
  process.exitCode=1;
} finally {if(client)await client.close();}
