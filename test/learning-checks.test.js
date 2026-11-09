const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const checks=require('../src/content/checks.json');
const {validateBank}=require('../src/learning');
const {recordCompletesCloudTask,normalizeCloudTasks}=require('../src/utils');
test('independent bank has 18 distinct reviewed units',()=>{validateBank(checks);assert.equal(checks.length,18);for(const module of ['reading','reasoning','math-reading'])assert.equal(checks.filter(u=>u.module===module).length,6);});
test('learning task filters accept only matching phase, level and skill',()=>{
 const [task]=normalizeCloudTasks([{module:'reading',mode:{type:'reading',learningPhase:'check',learningLevel:2,learningSkill:'信息定位'}}]);
 const record={type:'reading',status:'completed',learningPhase:'check',learningLevel:2,learningSkills:['信息定位']};
 assert.equal(recordCompletesCloudTask(record,task),true);
 for(const patch of [{learningPhase:'train'},{learningLevel:1},{learningSkills:['句意连接']},{status:'unfinished'}])assert.equal(recordCompletesCloudTask({...record,...patch},task),false);
 assert.equal(recordCompletesCloudTask(record,{mode:{type:'reading'}}),true);
});
test('checks withhold correctness and solutions until completion, block assistance and repeat exposure',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learning-checks-')),port=40500+process.pid%400,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code'},stdio:'ignore'});
 t.after(async()=>{await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
 async function call(url,body,headers={}){const res=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};}
 const created=await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'checkuser'}}),headers={'x-user-id':'checkuser',authorization:'Bearer '+created.body.sessionToken};
 const catalog=(await call('/api/learning/catalog',null,headers)).body;
 assert.equal(catalog.checks.length,18);assert.equal(catalog.plan.skills.length>0,true);assert.ok(!JSON.stringify(catalog).includes('answers'));
 let current,id;
 const action=async(kind,answer,eventId='event-'+Math.random())=>{
 const result=await call('/api/learning/'+id+'/action',{kind,answer,index:current.index,eventId},headers);if(result.body.session)current=result.body.session;return result;};
 for(const [i,unit] of checks.entries()){
 id='check-session-'+i;current=(await call('/api/learning/start',{unitId:unit.id,id,phase:'train'},headers)).body.session;
 assert.equal(current.phase,'check');assert.equal(current.fresh,true);assert.equal(current.demonstration,'');
 if(i===0){
  assert.equal((await action('hint')).status,400);assert.equal((await action('demo')).status,400);assert.equal((await action('reveal')).status,400);
  const correctText=unit.steps[0].options[Number(unit.steps[0].answers[0])],wrong=current.step.options.findIndex(text=>text!==correctText);
  const eventId='lost-response';await action('answer',String(wrong),eventId);
  const after=current.index;const repeated=await call('/api/learning/'+id+'/action',{kind:'answer',answer:String(wrong),index:0,eventId},headers);assert.equal(repeated.body.session.index,after);
  const partial=(await call('/api/learning/catalog',null,headers)).body.sessions[0];
  for(const key of ['correct','independent','explanation','answers'])assert.ok(!JSON.stringify(partial).includes('"'+key+'"'),key);
  const exported=(await call('/api/learning/export',null,headers)).body.sessions[0];assert.equal(exported.unit,undefined);assert.equal(exported.results[0].correct,undefined);
  const pub=(await call('/api/users/checkuser/public')).body.records[0];assert.equal(pub.errors,0);assert.equal(pub.accuracy,0);
 }
 while(current.step){
  const step=unit.steps[current.index];
  const answer=step.options?String(current.step.options.indexOf(step.options[Number(step.answers[0])])):step.answers[0];
  await action('answer',answer);
 }
 assert.equal(current.status,'completed');assert.ok(current.results.every(r=>typeof r.correct==='boolean'&&r.explanation));
 if(i===0)assert.equal(current.results[0].independent,false);else assert.ok(current.results.every(r=>r.independent));
 assert.equal((await call('/api/learning/start',{unitId:unit.id,id:'repeat-session-'+i},headers)).status,409);
 }
 const final=(await call('/api/learning/catalog',null,headers)).body;assert.equal(final.sessions.length,18);assert.ok(final.checks.every(u=>u.seen));
 const unit=require('../src/content/learning.json')[0];
 const first=(await call('/api/learning/start',{unitId:unit.id,id:'training-first',phase:'review'},headers)).body.session;assert.equal(first.phase,'review');assert.equal(first.fresh,true);
 const repeated=(await call('/api/learning/start',{unitId:unit.id,id:'training-repeat'},headers)).body.session;assert.equal(repeated.phase,'train');assert.equal(repeated.fresh,false);
});
