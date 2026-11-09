const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const bank=require('../src/content/learning.json');
const {validateBank}=require('../src/learning');
const {applyCloudTrainingCompletionToTasks}=require('../src/utils');

test('learning bank preserves original units and adds a missing-condition bridge',()=>{
 validateBank(bank);assert.equal(bank.length,19);
 for(const module of ['reading','reasoning','math-reading'])assert.equal(bank.filter(u=>u.module===module).length,module==='math-reading'?7:6);
 assert.throws(()=>validateBank([bank[0],bank[0]]));
});
test('private learning, retries, hints, continuation, completed summaries and exports',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learning-'));
 const port=39000+process.pid%1000,base=`http://127.0.0.1:${port}`;
 let child;
 async function launch(){child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code',ADMIN_PASSWORD:'admin'},stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return;}catch{} await new Promise(r=>setTimeout(r,30));}throw Error('server unavailable');}
 t.after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});});await launch();
 async function call(url,body,headers={}){const res=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};}
 const created=await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'reader',birthDate:'2016-01-01'}});
 const token=created.body.sessionToken,headers={'x-user-id':'reader',authorization:'Bearer '+token};
 assert.equal((await call('/api/users/reader')).body.user.birthDate,undefined);
 assert.equal((await call('/api/users/reader',null,headers)).body.user.birthDate,'2016-01-01');
 assert.equal((await call('/api/learning/catalog')).status,403);
 const catalog=(await call('/api/learning/catalog',null,headers)).body;
 assert.equal(catalog.units.length,bank.length);assert.ok(!JSON.stringify(catalog).includes('answers'));
 const start=async (u,id)=>call('/api/learning/start',{unitId:u.id,id},headers);
 let id='session-main',s=(await start(bank[0],id)).body.session;
 assert.equal(s.index,0);assert.equal((await start(bank[1],id)).body.session.unitId,bank[0].id);
 async function action(kind,answer,eventId='event-'+Math.random(),index=s.index){const result=await call('/api/learning/'+id+'/action',{kind,answer,eventId,index,elapsedMs:1000},headers);if(result.body.session)s=result.body.session;return result;}
 await action('answer','0','wrong-one');assert.equal(s.index,0);assert.equal(s.hints.length,1);
 await action('answer','0','wrong-one');assert.equal(s.hints.length,1);
 await action('answer',bank[0].steps[0].answers[0]);assert.equal(s.index,1);assert.equal(s.results[0].independent,false);
 assert.equal((await action('answer','0','stale',0)).status,409);
 // Persistence is available even after an ungraceful shutdown.
 await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGKILL');});await launch();
 s=(await call('/api/learning/catalog',null,headers)).body.sessions[0];assert.equal(s.index,1);
 const other=await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'other'}});
 const otherHeaders={'x-user-id':'other',authorization:'Bearer '+other.body.sessionToken};
 assert.equal((await call('/api/learning/catalog',null,otherHeaders)).body.sessions.length,0);
 assert.equal((await call('/api/learning/start',{unitId:bank[0].id,id},otherHeaders)).status,409);
 await call('/api/users/other/records/start',{sessionToken:other.body.sessionToken,record:{id:'legacy-collision',type:'schulte',size:5}},otherHeaders);
 assert.equal((await start(bank[0],'legacy-collision')).status,409);
 assert.equal((await call('/api/learning/'+id+'/action',{kind:'hint',index:1,eventId:'cross'},otherHeaders)).status,404);
 await action('demo');await action('reveal');assert.equal(s.results[1].independent,false);
 await action('answer',bank[0].steps[2].answers[0]);assert.equal(s.status,'completed');assert.equal(s.results[2].independent,true);
 // All authored answer paths complete and preserve their record type.
 for(const [i,u] of bank.entries()){
 id='complete-unit-'+i;s=(await start(u,id)).body.session;
 for(const step of u.steps)await action('answer',step.answers[0]);
 assert.equal(s.status,'completed',u.id);assert.ok(s.results.every(r=>r.independent));
 }
 const pub=(await call('/api/users/reader/public')).body;
 assert.equal(pub.records.filter(r=>r.status==='completed').length,bank.length+1);
 assert.ok(!JSON.stringify(pub).includes('explanation'));assert.ok(!JSON.stringify(pub).includes('results'));
 const progress=applyCloudTrainingCompletionToTasks([{module:'reading',mode:{type:'reading'},targetCount:1}],pub.records);
 assert.equal(progress[0].completed,true);
 const forged=await call('/api/users/reader/records',{sessionToken:token,record:{id,type:'math-reading',status:'completed'}},headers);
 assert.equal(forged.status,400);
 const exported=(await call('/api/learning/export',null,headers)).body;assert.equal(exported.sessions.length,bank.length+1);assert.ok(exported.sessions[0].results[0].answers.length);
 assert.equal((await fetch(base+'/learning')).status,200);assert.equal((await fetch(base+'/assets/learning.js')).status,200);
});
