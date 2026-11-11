const test=require('node:test'),assert=require('node:assert/strict');
const {ageProfile,suitable}=require('../src/learning-age');
const {arithmetic,normalizeUnit,generate,config}=require('../src/learning-ai');
const profile=ageProfile('2016-11-10',new Date('2026-11-11T03:00:00Z'));
const {raw}=require('../scripts/ai-test-fixture.cjs');
const options={module:'reading',level:1,phase:'train',profile,focusSkill:''};
test('age profiles use configured calendar birthdays and reject invalid or missing dates',()=>{
 assert.equal(ageProfile('2016-11-11',new Date('2026-11-10T16:01:00Z')).age,10);
 assert.equal(ageProfile('2016-11-11',new Date('2026-11-10T15:59:00Z')).age,9);
 for(const date of ['',null,'2026-02-30','2026-99-99','2030-01-01'])assert.equal(ageProfile(date,new Date('2026-11-11')).age,null);
 const young=ageProfile('2019-01-01',new Date('2026-11-11'));
 assert.equal(suitable({level:1},young),true);assert.equal(suitable({level:2},young),false);
 assert.equal(suitable({level:3},profile),false);
 assert.equal(suitable({source:'ai',ageProfile:{band:'9-10'}},profile),true);
 assert.equal(suitable({source:'ai',ageProfile:{band:'6-8'}},profile),false);
});
test('generated materials have bounded age-matched structures and immutable material fingerprints',()=>{
 const unit=normalizeUnit(raw(),options);assert.equal(unit.source,'ai');assert.equal(unit.ageProfile.band,'9-10');assert.ok(unit.id.startsWith('ai-'));
 assert.equal(normalizeUnit({...raw(),title:'另一个标题'},options).id,unit.id,'retitling the same passage cannot create new evidence');
 assert.throws(()=>normalizeUnit({...raw(),lines:['太短']},options));
 const invalid=raw();invalid.steps[0].options=['相同','相同','不同'];assert.throws(()=>normalizeUnit(invalid,options));
 const invalid2=raw();invalid2.steps[0].answers=['9'];assert.throws(()=>normalizeUnit(invalid2,options));
 assert.throws(()=>normalizeUnit({...raw(),title:'<script>'},options));
});
test('math is parsed without eval and generated answer, result and arithmetic must agree',()=>{
 assert.equal(arithmetic('(18-6)÷2+0.5').value,6.5);
 for(const s of ['process.exit()','1/0','1;2','1..2','2**3','(2+3',''])assert.throws(()=>arithmetic(s));
 const good=raw('math-reading'),o={...options,module:'math-reading'};assert.ok(normalizeUnit(good,o).steps[2].math);
 for(const value of [99,'12']){const bad=raw('math-reading');bad.steps[2].math.result=value;assert.throws(()=>normalizeUnit(bad,o));}
 const bad=raw('math-reading');bad.steps[2].options[0]='14张';assert.throws(()=>normalizeUnit(bad,o));
});
test('compatible API generation and independent review send no identity or birth date and protect secrets',async()=>{
 const requests=[],c={url:'https://example.org/v1/chat/completions',key:'secret-do-not-return',model:'test-model',tokens:6000};
 const fetcher=async(url,init)=>{const body=JSON.parse(init.body);requests.push(body);assert.equal(init.headers.authorization,'Bearer '+c.key);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(requests.length===1?raw():{approved:true})}}]}));};
 const unit=await generate(options,{configuration:c,fetcher});assert.equal(unit.model,'test-model');assert.equal(requests.length,2);
 const sent=JSON.stringify(requests);assert.ok(sent.includes('9-10'));assert.ok(!sent.includes('2016-11-10'));assert.ok(!sent.includes(c.key));assert.ok(!JSON.stringify(unit).includes(c.key));
 assert.equal(config({LEARNING_AI_BASE_URL:'https://example.org/v1',LEARNING_AI_API_KEY:'k',LEARNING_AI_MODEL:'m'}).url,c.url);
 assert.throws(()=>config({LEARNING_AI_BASE_URL:'https://user:pass@example.org/v1',LEARNING_AI_API_KEY:'k',LEARNING_AI_MODEL:'m'}));
});
test('AI errors, review rejection, truncated output and timeout never return a usable material',async()=>{
 const c={url:'https://example.org/v1/chat/completions',key:'secret',model:'m',tokens:6000};
 await assert.rejects(()=>generate(options,{configuration:null}),/尚未配置/);
 await assert.rejects(()=>generate(options,{configuration:c,fetcher:async()=>new Response('secret-upstream-error',{status:401})}),e=>e.status===502&&!e.message.includes('secret'));
 let calls=0;await assert.rejects(()=>generate(options,{configuration:c,fetcher:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(++calls===1?raw():{approved:false})}}]}))}),/未通过/);
 await assert.rejects(()=>generate(options,{configuration:c,fetcher:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}))}),/未通过/);
 await assert.rejects(()=>generate(options,{configuration:c,timeoutMs:20,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))}),e=>e.status===504);
});
