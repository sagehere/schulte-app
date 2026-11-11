const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {raw}=require('../scripts/ai-test-fixture.cjs');
test('private age-adaptive AI sessions are idempotent, quota bounded, recoverable and redacted',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'age-ai-'));let upstreamCalls=0,mode='good',prompts=[];
 const upstream=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const data=JSON.parse(body);prompts.push(data);upstreamCalls++;assert.equal(req.headers.authorization,'Bearer mock-private-key');
  if(mode==='error'){res.writeHead(401);return res.end('mock-private-key');}
  const review=data.messages[0].content.includes('独立审题者'),module=data.messages[0].content.includes('模块math-reading')?'math-reading':'reading';
  const unit=raw(module);if(mode==='bad')unit.steps[0].answers=['9'];
  await new Promise(r=>setTimeout(r,25));res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(review?{approved:true}:unit)}}]}));
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const port=44500+process.pid%300,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['src/index.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code',ADMIN_PASSWORD:'admin',LEARNING_AI_API_KEY:'mock-private-key',LEARNING_AI_MODEL:'mock-model',LEARNING_AI_BASE_URL:`http://127.0.0.1:${upstream.address().port}/v1`,LEARNING_AI_DAILY_LIMIT:'2'},stdio:'ignore'});
 t.after(async()=>{await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);child.kill();});await new Promise(r=>upstream.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
 async function call(url,body,headers){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
 async function user(identifier,birthDate){const c=await call('/api/users',{authCode:'code',password:'123456',user:{identifier,birthDate}});assert.equal(c.status,200);return {'x-user-id':identifier,authorization:'Bearer '+c.body.sessionToken};}
 const a=await user('aiReader',require('../scripts/age-fixture.cjs')(10)),b=await user('aiYoung',require('../scripts/age-fixture.cjs')(7)),unknown=await user('aiUnknown',''),other=await user('aiOther',require('../scripts/age-fixture.cjs')(10));
 const request={id:'ai-session-check',module:'reading',phase:'check',level:1,age:99};
 assert.equal((await call('/api/learning/generate',request)).status,403);
 for(const invalid of [{...request,module:'toString',focusSkill:'x'},{...request,module:'__proto__'},{...request,level:{toString:'oops'}},{...request,id:{toString:'oops'}}])assert.equal((await call('/api/learning/generate',invalid,a)).status,400);
 assert.equal((await call('/api/learning/generate',request,unknown)).status,422);assert.equal(upstreamCalls,0);
 const young=(await call('/api/learning/catalog',null,b)).body;assert.equal(young.profile.age,7);assert.ok(young.units.every(u=>u.level===1));assert.equal(JSON.stringify(young).includes('mock-private-key'),false);
 const higher=require('../src/content/learning.json').find(u=>u.level===3);assert.equal((await call('/api/learning/start',{id:'age-bypass-level',unitId:higher.id,age:12},b)).status,422);
 const [first,retry]=await Promise.all([call('/api/learning/generate',request,a),call('/api/learning/generate',request,a)]);assert.equal(first.status,200);assert.deepEqual(first.body,retry.body);assert.equal(upstreamCalls,2);
 let session=first.body.session;assert.equal(session.ageProfile.age,10);assert.equal(session.source,'ai');assert.equal(session.demonstration,'');assert.ok(!JSON.stringify(session).includes('answers'));assert.equal(session.total,3);
 assert.equal((await call('/api/learning/generate',request,a)).body.session.id,session.id);assert.equal(upstreamCalls,2);
 assert.equal((await call('/api/learning/generate',request,other)).status,409);assert.equal(upstreamCalls,2);
 const catalog=(await call('/api/learning/catalog',null,a)).body;assert.ok(catalog.checks.some(u=>u.id===session.unitId));assert.equal(catalog.sessions[0].id,session.id);
 const exported=(await call('/api/learning/parents/export?kind=bundle',null,a)).body;assert.equal(exported.sessions[0].unit,undefined);
 for(let index=0;index<3;index++)session=(await call('/api/learning/'+session.id+'/action',{index,kind:'skip',eventId:'ai-skip-'+index},a)).body.session;
 assert.equal(session.status,'completed');assert.ok(session.results[0].explanation);
 const full=(await call('/api/learning/export',null,a)).body.sessions[0];assert.equal(full.unit.ageProfile.band,'9-10');assert.ok(full.unit.steps[0].answers);
 const duplicate=await call('/api/learning/generate',{...request,id:'ai-duplicate-check'},a);assert.equal(duplicate.status,409);
 const math=await call('/api/learning/generate',{...request,id:'ai-math-session',module:'math-reading',phase:'train'},a);assert.equal(math.status,200);
 assert.equal((await call('/api/learning/generate',{...request,id:'ai-quota-session'},a)).status,429);
 assert.ok(!JSON.stringify(prompts).includes(require('../scripts/age-fixture.cjs')(10)));assert.ok(!JSON.stringify(prompts).includes('aiReader'));assert.ok(JSON.stringify(prompts).includes('9-10'));
 mode='bad';assert.equal((await call('/api/learning/generate',{...request,id:'ai-invalid-data'},other)).status,502);assert.equal((await call('/api/learning/catalog',null,other)).body.sessions.length,0);
 mode='error';const error=await call('/api/learning/generate',{...request,id:'ai-upstream-error'},other);assert.equal(error.status,502);assert.ok(!JSON.stringify(error).includes('mock-private-key'));
});
