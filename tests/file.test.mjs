import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {FileRepository} from '../server/fileRepository.mjs';
import {createAdmin,verifyAdmin} from '../server/adminAccounts.mjs';

test('banco em arquivo preserva reservas e admins ao reiniciar e rejeita conflitos simultâneos',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'jeh-file-test-'));
  const config={localDatabase:path.join(dir,'database.json')};
  let repo=await new FileRepository(config).connect();
  try{
    await createAdmin(repo,{username:'gestora',name:'Teste admin',password:'senha-teste-completa'},'admin');
    const booking={name:'Cliente teste',phone:'11988887777',serviceIds:['s1','s3'],date:'2099-10-20',time:'10:00'};
    const results=await Promise.allSettled([repo.execute('createAppointment',[booking],'a'),repo.execute('createAppointment',[booking],'b')]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    const first=(await repo.snapshot()).appointments[0];
    assert.equal(first.duration,150);
    await repo.close();
    repo=await new FileRepository(config).connect();
    assert.equal((await repo.snapshot()).appointments[0].id,first.id);
    assert.equal(await verifyAdmin(repo,'gestora','senha-teste-completa'),true);
    await repo.execute('updateAppointment',[first.id,{time:'13:00'}]);
    assert.equal((await repo.snapshot()).appointments[0].duration,150);
    await repo.execute('cancelAppointment',[first.id]);
    await repo.execute('createBlockedTime',[{reason:'Pausa',startDate:booking.date,endDate:booking.date,startTime:'10:00',endTime:'11:00',allDay:false}]);
    await assert.rejects(repo.execute('createAppointment',[booking]),/disponível/);
  }finally{await repo.close();await unlink(config.localDatabase);await rmdir(dir);}
});
