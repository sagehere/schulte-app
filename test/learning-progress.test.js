const test=require('node:test'),assert=require('node:assert/strict');
const {buildLearningPlan}=require('../src/learning-progress');
const bank=[...require('../src/content/learning.json'),...require('../src/content/checks.json')];
function session(id,day,{ok=true,phase='train',unitId=id,level=1,skill='信息定位',fresh=true}={}){
 return {id,phase,fresh,status:'completed',startedAt:day+'T02:00:00Z',endedAt:day+'T02:01:00Z',unit:{id:unitId,module:'reading',level,steps:[{skill}]},results:[{skill,independent:ok}]};
}
const row=plan=>plan.skills.find(r=>r.module==='reading'&&r.skill==='信息定位');
test('progress requires eight unseen materials, two configured dates and independent check evidence',()=>{
 const sessions=Array.from({length:8},(_,i)=>session('unit'+i,i<4?'2026-11-01':'2026-11-02',{phase:i===7?'check':'train'}));
 let plan=buildLearningPlan(sessions,bank,new Date('2026-11-03T02:00:00Z'));assert.equal(row(plan).levels[0].state,'ready');assert.equal(row(plan).recommendedLevel,2);
 assert.notEqual(row(buildLearningPlan(sessions.map(s=>s.phase==='check'?{...s,results:[{skill:'信息定位',independent:false}]}:s),bank)).levels[0].state,'ready');
 const repeated=[...sessions.slice(0,2),...Array.from({length:8},(_,i)=>session('repeat'+i,'2026-11-03',{unitId:'unit0',fresh:false}))];
 assert.equal(row(buildLearningPlan(repeated,bank)).levels[0].samples,2);
 const sameDay=sessions.map(s=>({...s,startedAt:'2026-11-01T02:00:00Z',endedAt:'2026-11-01T02:01:00Z'}));
 assert.notEqual(row(buildLearningPlan(sameDay,bank)).levels[0].state,'ready');
 assert.notEqual(row(buildLearningPlan(sessions.map(s=>({...s,phase:'train'})),bank)).levels[0].state,'ready');
});
test('unfinished checks, duplicate steps and legacy repeats cannot inflate evidence',()=>{
 const a=session('first','2026-11-01',{unitId:'same'});delete a.fresh;
 a.results.push({skill:'信息定位',independent:true});
 const b=session('second','2026-11-02',{unitId:'same'});delete b.fresh;
 const c={...session('partial','2026-11-03',{phase:'check'}),status:'unfinished'};
 const result=row(buildLearningPlan([a,b,c],bank)).levels[0];assert.equal(result.samples,1);assert.equal(result.checks,0);
 const original=session('z-first','2026-11-01',{unitId:'timestamp-tie'}),repeat=session('a-later','2026-11-01',{unitId:'timestamp-tie',fresh:false});
 assert.equal(row(buildLearningPlan([original,repeat],bank)).levels[0].samples,1);
});
test('review intervals are due-date based and same-day retries cannot erase a failed review',()=>{
 const failed=session('failed','2026-11-01',{ok:false});
 let plan=buildLearningPlan([failed],bank,new Date('2026-11-02T02:00:00Z'));assert.equal(row(plan).dueDate,'2026-11-02');assert.equal(row(plan).due,true);
 assert.equal(plan.reviews.find(r=>r.module==='reading').seen,false);
 const retry=session('retry','2026-11-01',{phase:'review'});
 assert.equal(row(buildLearningPlan([failed,retry],bank)).dueDate,'2026-11-02');
 const review1=session('r1','2026-11-02',{phase:'review'});
 assert.equal(row(buildLearningPlan([failed,review1],bank)).dueDate,'2026-11-05');
 const review2=session('r2','2026-11-05',{phase:'review'});
 assert.equal(row(buildLearningPlan([failed,review1,review2],bank)).dueDate,'2026-11-12');
 const sameDayFailure=session('same-day-fail','2026-11-02',{phase:'review',ok:false});
 const nextDay=session('next-day','2026-11-03',{phase:'review'});
 assert.equal(row(buildLearningPlan([failed,review1,sameDayFailure,nextDay],bank)).dueDate,'2026-11-06');
 const lapse=session('lapse','2026-11-12',{phase:'review',ok:false});
 assert.equal(row(buildLearningPlan([failed,review1,review2,lapse],bank)).dueDate,'2026-11-13');
});
test('calendar evidence and due dates follow administrator timezone',()=>{
 const s=session('night','2026-11-01',{ok:false});s.startedAt='2026-11-01T16:01:00Z';s.endedAt='2026-11-01T16:02:00Z';
 assert.equal(row(buildLearningPlan([s],bank,new Date('2026-11-02T15:00:00Z'),'Asia/Shanghai')).dueDate,'2026-11-03');
 assert.equal(row(buildLearningPlan([s],bank,new Date('2026-11-02T15:00:00Z'),'America/New_York')).dueDate,'2026-11-02');
});
test('recommendations keep higher levels out until there is sufficient evidence',()=>{
 const seen=bank.filter(u=>u.kind!=='check'&&u.module==='reading'&&u.level===1).map((u,i)=>session('seen'+i,'2026-11-01',{unitId:u.id,ok:false}));
 const plan=buildLearningPlan(seen,bank,new Date('2026-11-02T02:00:00Z'));
 assert.ok(plan.reviews.filter(r=>r.module==='reading').every(r=>r.level===1));
});

test('repeated difficulty at the connection level recommends foundational support',()=>{
 const basics=Array.from({length:8},(_,i)=>session('base'+i,i<4?'2026-11-01':'2026-11-02',{phase:i===7?'check':'train'}));
 const hard=Array.from({length:3},(_,i)=>session('hard'+i,'2026-11-03',{level:2,ok:false}));
 const plan=buildLearningPlan([...basics,...hard],bank,new Date('2026-11-04T02:00:00Z'));
 assert.equal(row(plan).levels[0].state,'ready');assert.equal(row(plan).levels[1].state,'strengthen');assert.equal(row(plan).recommendedLevel,1);
});
