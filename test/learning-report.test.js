const test=require('node:test'),assert=require('node:assert/strict');
const {reportRange,buildReport,toCsv}=require('../src/learning-report');
const bank=[...require('../src/content/learning.json'),...require('../src/content/checks.json')];
function session(id,date,{unitId=id,phase='train',level=1,ok=true,fresh=true,started=date}={}){
 const unit={...bank[0],id:unitId,level};return {id,phase,fresh,status:'completed',startedAt:started+'T03:00:00Z',endedAt:date+'T03:10:00Z',elapsedMs:600000,unit,results:unit.steps.map(q=>({skill:q.skill,independent:ok,correct:ok,hints:ok?0:1,wrong:ok?0:1,answers:[{answer:q.answers[0],correct:ok}],explanation:q.explanation}))};
}
const range=()=>reportRange({from:'2026-11-03',to:'2026-11-09'},new Date('2026-11-09T04:00:00Z'));
test('reports compare only unseen materials at the same skill, level and phase',()=>{
 const sessions=[session('p1','2026-10-28',{ok:false}),session('p2','2026-10-29',{ok:false}),session('p3','2026-10-30'),session('c1','2026-11-04'),session('c2','2026-11-05'),session('c3','2026-11-06'),session('repeat','2026-11-07',{unitId:'p1',fresh:false}),session('review','2026-11-08',{phase:'review'}),session('transfer','2026-11-08',{level:3})];
 const r=buildReport(sessions,[],bank,range(),new Date('2026-11-09T04:00:00Z'));
 const row=r.skills.find(s=>s.skill==='信息定位'&&s.phase==='train'&&s.level===1);
 assert.equal(row.current.n,3);assert.equal(row.previous.n,3);assert.equal(row.comparable,true);assert.ok(Math.abs(row.delta-2/3)<0.0001);
 assert.equal(r.skills.find(s=>s.level===3).comparable,false);assert.equal(r.skills.find(s=>s.phase==='review').current.n,1);
});
test('cohort completion is distinct from cross-period completions and unfinished checks stay private',()=>{
 const old=session('cross','2026-11-04',{started:'2026-11-01'}),current=session('now','2026-11-05');
 const unfinished={...session('partial','2026-11-05',{phase:'check'}),status:'unfinished',endedAt:'',results:[{skill:'秘密步骤',independent:false,explanation:'不能提前泄露'}]};
 const later=session('later','2026-11-10',{started:'2026-11-06'});
 const r=buildReport([old,current,unfinished,later],[],bank,range(),new Date('2026-11-20T03:00:00Z'));
 assert.equal(r.summary.started,3);assert.equal(r.summary.cohortCompleted,1);assert.equal(r.summary.completedInPeriod,2);assert.equal(r.summary.steps,6);assert.ok(!JSON.stringify(r).includes('不能提前泄露'));
});
test('report dates and observation filters use configured calendar dates',()=>{
 assert.throws(()=>reportRange({from:'2026-02-30'},new Date('2026-11-09T04:00:00Z')));
 assert.throws(()=>reportRange({to:'2026-12-01'},new Date('2026-11-09T04:00:00Z')));
 assert.throws(()=>reportRange({from:'2020-01-01'},new Date('2026-11-09T04:00:00Z')));
 const r=buildReport([], [{date:'2026-11-04',module:'reading',updatedAt:'x'},{date:'2026-11-04',module:'math-reading',updatedAt:'x'}],bank,{...range(),module:'reading'});assert.equal(r.observations.length,1);
 const utc='2026-11-08T17:00:00Z';assert.equal(reportRange({},new Date(utc),'Asia/Shanghai').to,'2026-11-09');
});
test('CSV preserves Unicode, quotes and newlines while neutralizing spreadsheet formulas',()=>{
 const csv=toCsv([['text','说明'],['number','数量']],[{text:'=HYPERLINK("x")',number:-3},{text:'  +SUM(1,2)',number:2},{text:'中文,"两行"\n记录',number:0}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(csv.includes('"\'  +SUM'));assert.ok(csv.includes('中文,""两行""\n记录'));assert.ok(csv.includes(',-3\r\n'));
});

test('AI ages and sources never pool into the same comparison row',()=>{
 const a=session('ai9','2026-11-04'),b=session('ai11','2026-11-05'),fixed=session('fixed','2026-11-06');
 a.unit={...a.unit,source:'ai',ageProfile:{band:'9-10'}};b.unit={...b.unit,source:'ai',ageProfile:{band:'11-12'}};
 const rows=buildReport([a,b,fixed],[],bank,range()).skills.filter(r=>r.skill==='信息定位');
 assert.equal(rows.length,3);assert.deepEqual(new Set(rows.map(r=>r.ageBand)),new Set(['9-10','11-12','fixed']));assert.ok(rows.every(r=>r.current.n===1&&!r.comparable));
});
