const {localDateKey}=require('./utils');
const {dayAfter,sessionPhase,buildLearningPlan}=require('./learning-progress');
const MODULES=['reading','reasoning','math-reading'];
const OBSERVATION_TAGS=['读漏条件','比较方向','计算失误','需要朗读','能口头解释','情绪疲劳','迁移待观察','其他'];
const CONTEXTS=['网页训练','纸面作业','生活应用'];
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function reportRange(query={},now=new Date(),timeZone='Asia/Shanghai'){
 const today=localDateKey(now,timeZone),to=query.to||today;
 if(!validDate(to))throw Error('请选择有效结束日期');
 const from=query.from||dayAfter(to,-6),module=query.module||'';
 if(!validDate(from)||!validDate(to)||from>to||to>today||Date.parse(to)-Date.parse(from)>365*86400000||module&&!MODULES.includes(module))throw Error('请选择有效日期范围（最多366天，不超过今天）和训练模块');
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 return {from,to,previousFrom:dayAfter(from,-days),previousTo:dayAfter(from,-1),today,timeZone,module,days};
}
function answerText(question,value){
 if(value===undefined||value===null||value==='')return '未作答';
 if(question.options&&/^\d+$/.test(String(value)))return question.options[Number(value)]??String(value);
 return String(value);
}
function buildReport(sessions,observations,units,range,now=new Date()){
 const selected=sessions.filter(s=>!range.module||s.unit.module===range.module);
 const dateOf=(s,end=false)=>localDateKey(new Date(end?s.endedAt||s.startedAt:s.startedAt),range.timeZone);
 const inside=day=>day>=range.from&&day<=range.to;
 const cohort=selected.filter(s=>inside(dateOf(s)));
 const cohortDone=s=>s.status==='completed'&&dateOf(s,true)<=range.to;
 const completed=selected.filter(s=>s.status==='completed'&&inside(dateOf(s,true)));
 const first=new Map();
 for(const s of [...selected].sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)||a.id.localeCompare(b.id)))if(!first.has(s.unit.id))first.set(s.unit.id,s.id);
 const evidenceRows=new Map(),details=[],steps=[];
 let totalSteps=0,independent=0;
 for(const s of selected.filter(s=>s.status==='completed')){
  const day=dateOf(s,true),current=inside(day),previous=day>=range.previousFrom&&day<=range.previousTo;
  if(!current&&!previous)continue;
  const fresh=s.fresh===undefined?first.get(s.unit.id)===s.id:s.fresh;
  const groups=new Map();
  s.results.forEach((result,index)=>{
   const q=s.unit.steps[index];if(!q)return;
   const phase=sessionPhase(s),key=JSON.stringify([s.unit.module,result.skill,s.unit.level,phase]);
   const group=groups.get(key)||[];group.push(result);groups.set(key,group);
   if(!current)return;
   totalSteps++;if(result.independent)independent++;
   const row={date:day,completedAt:s.endedAt||s.startedAt,sessionId:s.id,unitId:s.unit.id,title:s.unit.title,module:s.unit.module,phase,level:s.unit.level,stepIndex:index,skill:result.skill,
    question:q.prompt,firstAnswer:answerText(q,result.answers?.[0]?.answer),independent:!!result.independent,hints:result.hints||0,wrong:result.wrong||0,
    outcome:result.independent?'首次独立答对':phase==='check'?'检查未答对':result.correct?'帮助后完成':'查看讲解',
    expected:q.answers.map(a=>answerText(q,a)).join(' / '),explanation:result.explanation||q.explanation,seen:!fresh};
   steps.push(row);if(!result.independent)details.push(row);
  });
  if(fresh)for(const [key,values] of groups){
   let row=evidenceRows.get(key);
   if(!row){const [module,skill,level,phase]=JSON.parse(key);row={module,skill,level,phase,current:{n:0,correct:0,dates:new Set()},previous:{n:0,correct:0,dates:new Set()},seen:new Set()};evidenceRows.set(key,row);}
   // One material contributes at most once per skill, level and phase.
   if(row.seen.has(s.unit.id))continue;row.seen.add(s.unit.id);
   const period=current?row.current:row.previous;period.n++;period.dates.add(day);if(values.every(r=>r.independent))period.correct++;
  }
 }
 const skills=[...evidenceRows.values()].map(row=>{
  const period=p=>({n:p.n,correct:p.correct,days:p.dates.size,rate:p.n?p.correct/p.n:null});
  const current=period(row.current),previous=period(row.previous);
  const comparable=current.n>=3&&previous.n>=3&&current.days>=2&&previous.days>=2;
  return {module:row.module,skill:row.skill,level:row.level,phase:row.phase,current,previous,comparable,delta:comparable?current.rate-previous.rate:null};
 }).sort((a,b)=>a.module.localeCompare(b.module)||a.level-b.level||a.skill.localeCompare(b.skill)||a.phase.localeCompare(b.phase));
 const modules=MODULES.filter(m=>!range.module||m===range.module).map(module=>{
  const started=cohort.filter(s=>s.unit.module===module),done=started.filter(cohortDone);
  return {module,started:started.length,cohortCompleted:done.length,completionRate:started.length?done.length/started.length:null,
   completedInPeriod:completed.filter(s=>s.unit.module===module).length};
 });
 const notes=observations.map(o=>({...o,module:o.module||sessions.find(s=>s.id===o.sessionId)?.unit.module||''})).filter(o=>inside(o.date)&&(!range.module||!o.module||o.module===range.module)).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
 const plan=buildLearningPlan(sessions,units,now,range.timeZone);
 return {range,summary:{started:cohort.length,cohortCompleted:cohort.filter(cohortDone).length,completedInPeriod:completed.length,
   completedDurationMs:completed.reduce((n,s)=>n+(s.elapsedMs||0),0),steps:totalSteps,independent,independentRate:totalSteps?independent/totalSteps:null},
  modules,skills,evidence:details.sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt)||a.stepIndex-b.stepIndex).slice(0,20),evidenceCount:details.length,
  observations:notes,recommendations:plan.recommendations.filter(r=>!range.module||r.module===range.module),steps};
}
function csvCell(value){
 if(typeof value==='number'&&Number.isFinite(value))return String(value);
 let text=String(value??'');if(/^[\s\uFEFF]*[=+\-@\t\r\n]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function toCsv(columns,rows){return '\uFEFF'+[columns.map(c=>csvCell(c[1])).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c[0]])).join(','))].join('\r\n')+'\r\n';}
module.exports={OBSERVATION_TAGS,CONTEXTS,validDate,reportRange,answerText,buildReport,csvCell,toCsv};
