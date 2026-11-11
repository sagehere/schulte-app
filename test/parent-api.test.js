const fixtureBirthDate=require('../scripts/age-fixture.cjs')(12);
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const bank=require('../src/content/learning.json'),check=require('../src/content/checks.json')[0];
test('private parent reports, observation revisions, CSV, account rename and deletion',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'parent-api-')),port=42000+process.pid%500,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code',ADMIN_PASSWORD:'admin'},stdio:'ignore'});
 t.after(async()=>{await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
 async function call(url,body,headers={},method=body?'POST':'GET'){
  const response=await fetch(base+url,{method,headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{value=raw;}return {status:response.status,body:value,headers:response.headers};
 }
 const a=(await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'parentA',birthDate:fixtureBirthDate}})).body;
 const b=(await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'parentB',birthDate:fixtureBirthDate}})).body;
 let headers={'x-user-id':'parentA',authorization:'Bearer '+a.sessionToken};const other={'x-user-id':'parentB',authorization:'Bearer '+b.sessionToken};
 assert.equal((await call('/api/learning/parents/report')).status,403);
 assert.equal((await call('/api/learning/parents/report',null,{'x-user-id':'parentB',authorization:'Bearer '+a.sessionToken})).status,403);
 let s=(await call('/api/learning/start',{id:'parent-session',unitId:bank[0].id},headers)).body.session;
 for(const q of bank[0].steps)s=(await call('/api/learning/'+s.id+'/action',{index:s.index,kind:'answer',answer:q.answers[0],eventId:'event-'+s.index},headers)).body.session;
 await call('/api/learning/start',{id:'parent-check-open',unitId:check.id},headers);
 const report=(await call('/api/learning/parents/report',null,headers)).body;assert.equal(report.summary.started,2);assert.equal(report.summary.completedInPeriod,1);const today=report.range.today;
 const note={revision:0,mutationId:'note-create',date:today,context:'纸面作业',module:'reading',tags:['需要朗读'],note:'=HYPERLINK("https://example.org")\n第二行',sessionId:'parent-session',stepIndex:0};
 const saved=await call('/api/learning/parents/observations/observation-one',note,headers,'PUT');assert.equal(saved.status,200);assert.equal(saved.body.observation.revision,1);
 assert.equal((await call('/api/learning/parents/observations/observation-one',note,headers,'PUT')).body.observation.revision,1);
 assert.equal((await call('/api/learning/parents/observations/observation-one',{...note,mutationId:'stale'},headers,'PUT')).status,409);
 assert.equal((await call('/api/learning/parents/observations/observation-one',note,other,'PUT')).status,404);
 assert.equal((await call('/api/learning/parents/report',null,other)).body.observations.length,0);
 assert.equal((await call('/api/learning/parents/observations/invalid-note-one',{...note,sessionId:'not-owned',mutationId:'bad'},other,'PUT')).status,400);
 assert.equal((await call('/api/learning/parents/observations/invalid-note-two',{...note,date:'2026-02-30'},headers,'PUT')).status,400);
 assert.equal((await call('/api/learning/parents/report?to=not-a-date',null,headers)).status,400);
 const obsCsv=await call('/api/learning/parents/export?kind=observations',null,headers);assert.match(obsCsv.headers.get('content-type'),/text\/csv/);assert.ok(obsCsv.body.includes("'=HYPERLINK"));
 const stepsCsv=(await call('/api/learning/parents/export?kind=steps',null,headers)).body;assert.ok(stepsCsv.includes('parent-session'));assert.ok(!stepsCsv.includes('parent-check-open'));
 const exportJson=(await call('/api/learning/export',null,headers)).body;assert.equal(exportJson.version,3);assert.equal(exportJson.observations.length,1);assert.equal(exportJson.sessions.find(s=>s.id==='parent-check-open').unit,undefined);
 await t.test('feedback context binds owned visible steps to immutable material versions',async()=>{
  const url='/api/learning/parents/feedback-context?sessionId=parent-check-open';
  assert.equal((await call(url,null,other)).status,404);
  assert.equal((await call(url+'&stepIndex=1',null,headers)).status,400);
  assert.equal((await call(url+'&stepIndex=',null,headers)).status,400);
  assert.equal((await call(url+'&stepIndex=-1',null,headers)).status,400);
  const c=(await call(url+'&stepIndex=0',null,headers)).body.context;
  assert.equal(c.unitId,check.id);assert.equal(c.version,check.version);assert.equal(c.prompt,check.steps[0].prompt);
  assert.equal(c.answers,undefined);assert.equal(c.explanation,undefined);assert.equal(c.hints,undefined);
  assert.equal((await call('/api/learning/parents/observations/future-feedback',{...note,sessionId:'parent-check-open',stepIndex:1,mutationId:'future'},headers,'PUT')).status,400);
  await call('/api/learning/parent-check-open/action',{index:0,kind:'skip',eventId:'trial-skip'},headers);
  assert.equal((await call(url+'&stepIndex=0',null,headers)).status,200);
 });
 await t.test('trial bundle preserves feedback and completed snapshots but redacts partial checks',async()=>{
  const feedback={...note,sessionId:'parent-check-open',tags:['题意不清','操作困难'],note:'本步题意有疑问，待复核',mutationId:'feedback'};
  assert.equal((await call('/api/learning/parents/observations/trial-feedback',feedback,headers,'PUT')).status,200);
  const response=await call('/api/learning/parents/export?kind=bundle',null,headers),bundle=response.body;
  assert.match(response.headers.get('content-disposition'),/schulte-trial-.*\.json/);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(bundle.version,1);assert.equal(bundle.kind,'family-trial');assert.equal(bundle.owner,'parentA');assert.equal(bundle.sessions.length,2);
  assert.deepEqual(bundle.sessions.find(s=>s.id==='parent-session').unit,bank[0]);
  const partial=bundle.sessions.find(s=>s.id==='parent-check-open');assert.equal(partial.unit,undefined);assert.equal(partial.index,1);assert.deepEqual(partial.results,[{skill:check.steps[0].skill,submitted:true}]);
  assert.equal(partial.events,undefined);assert.equal(partial.answers,undefined);assert.equal(partial.wrong,undefined);assert.equal(partial.demonstration,'');assert.deepEqual(partial.hints,[]);
  const material=bundle.feedback.find(o=>o.id==='trial-feedback').material;assert.equal(material.version,check.version);assert.equal(material.prompt,check.steps[0].prompt);assert.equal(material.answers,undefined);
  assert.ok(!bundle.report.steps.some(s=>s.sessionId==='parent-check-open'));
  const isolated=(await call('/api/learning/parents/export?kind=bundle',null,other)).body;assert.equal(isolated.sessions.length,0);assert.equal(isolated.feedback.length,0);
  assert.equal((await call('/api/learning/parents/observations/trial-feedback',{revision:1},headers,'DELETE')).status,200);
 });
 await t.test('trial bundle respects date and module filters and includes linked out-of-period context',async()=>{
  const old=report.range.previousTo;
  await call('/api/learning/parents/observations/old-feedback',{...note,date:old,mutationId:'old-feedback'},headers,'PUT');
  const bundle=(await call(`/api/learning/parents/export?kind=bundle&from=${old}&to=${old}`,null,headers)).body;
  assert.equal(bundle.report.summary.started,0);assert.equal(bundle.feedback.length,1);assert.deepEqual(bundle.sessions.map(s=>s.id),['parent-session']);
  const filtered=(await call('/api/learning/parents/export?kind=bundle&module=math-reading',null,headers)).body;assert.equal(filtered.sessions.length,0);assert.equal(filtered.feedback.length,0);
  assert.equal((await call('/api/learning/parents/export?kind=bundle&to=invalid',null,headers)).status,400);
  await call('/api/learning/parents/observations/old-feedback',{revision:1},headers,'DELETE');
 });
 const publicData=JSON.stringify((await call('/api/users/parentA/public')).body);assert.ok(!publicData.includes('HYPERLINK'));
 assert.equal((await call('/api/learning/parents/report',null,{'x-user-id':'parentA',authorization:'Bearer admin'})).body.observations.length,1);
 const edited=await call('/api/learning/parents/observations/observation-one',{...note,revision:1,mutationId:'note-edit',note:'改为能自己解释了'},headers,'PUT');assert.equal(edited.body.observation.revision,2);assert.equal((await call('/api/learning/parents/report',null,headers)).body.summary.independent,report.summary.independent);
 await t.test('completed check exports release its shuffled snapshot for reproducible review',async()=>{
  for(let index=1;index<check.steps.length;index++)await call('/api/learning/parent-check-open/action',{index,kind:'skip',eventId:'finish-'+index},headers);
  const bundle=(await call('/api/learning/parents/export?kind=bundle',null,headers)).body;
  const completed=bundle.sessions.find(s=>s.id==='parent-check-open');assert.equal(completed.status,'completed');assert.equal(completed.unit.version,check.version);assert.ok(completed.unit.steps.every(q=>q.answers.length&&q.explanation));
 });
 await call('/api/users/parentA',{sessionToken:a.sessionToken,user:{identifier:'parentRenamed',birthDate:fixtureBirthDate}},headers,'PUT');headers={...headers,'x-user-id':'parentRenamed'};
 assert.equal((await call('/api/learning/parents/report',null,headers)).body.observations[0].note,'改为能自己解释了');
 assert.equal((await call('/api/learning/parents/observations/observation-one',{revision:1},headers,'DELETE')).status,409);
 assert.equal((await call('/api/learning/parents/observations/observation-one',{revision:2},headers,'DELETE')).status,200);
 assert.equal((await call('/api/learning/parents/report',null,headers)).body.observations.length,0);
 await call('/api/learning/parents/observations/observation-two',{...note,mutationId:'new-note'},headers,'PUT');
 assert.equal((await call('/api/users/parentRenamed',{sessionToken:a.sessionToken,password:'123456'},headers,'DELETE')).status,200);
 const recreated=(await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'parentRenamed',birthDate:fixtureBirthDate}})).body;
 const clean=(await call('/api/learning/parents/report',null,{'x-user-id':'parentRenamed',authorization:'Bearer '+recreated.sessionToken})).body;assert.equal(clean.observations.length,0);assert.equal(clean.summary.started,0);
 assert.equal((await fetch(base+'/parents')).status,200);assert.equal((await fetch(base+'/assets/parents.js')).status,200);
});
