const { localDateKey } = require('./utils');
const POLICY = Object.freeze({ minSamples: 8, minDays: 2, minCheckSamples: 1, threshold: 0.8, reviewDays: [1, 3, 7] });
const dayAfter = (day, delta) => { const date = new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+delta);return date.toISOString().slice(0,10); };
const sessionPhase = s => s.phase || 'train';
const skillKey = (module, skill) => `${module}:${skill}`;
function buildLearningPlan(sessions, units, now = new Date(), timeZone = 'Asia/Shanghai') {
  const today = localDateKey(now,timeZone), skills = new Map(), first = new Map(), exposures = new Set();
  const ordered = [...sessions].sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt)||a.id.localeCompare(b.id));
  for (const s of ordered) { if(!first.has(s.unit.id))first.set(s.unit.id,s.id);exposures.add(s.unit.id); }
  for (const unit of units) for (const q of unit.steps) {
    const key=skillKey(unit.module,q.skill);
    if(!skills.has(key))skills.set(key,{key,module:unit.module,skill:q.skill,samples:[],reviews:[],dueDate:null,streak:0,lastDay:null});
  }
  const completed = ordered.filter(s=>s.status==='completed').sort((a,b)=>Date.parse(a.endedAt||a.startedAt)-Date.parse(b.endedAt||b.startedAt));
  for (const s of completed) {
    const date=localDateKey(new Date(s.endedAt||s.startedAt),timeZone), grouped=new Map();
    s.results.forEach((result,index)=>{
      const key=skillKey(s.unit.module,result.skill), row=skills.get(key);
      if(!row)return;
      const values=grouped.get(key)||[];values.push(result);grouped.set(key,values);
    });
    for(const [key,values] of grouped){
      const row=skills.get(key), independent=values.every(r=>r.independent);
      if(s.fresh === undefined ? first.get(s.unit.id)===s.id : s.fresh)row.samples.push({unitId:s.unit.id,date,level:s.unit.level,independent,phase:sessionPhase(s)});
      // Same-day retries must not erase a due review or count as spaced practice.
      if(row.lastDay===date){if(!independent){row.streak=0;row.dueDate=dayAfter(date,1);}continue;}
      const dueReview=sessionPhase(s)==='review' && row.dueDate && date>=row.dueDate;
      if(dueReview)row.streak=independent?Math.min(row.streak+1,2):0;
      else if(!independent)row.streak=0;
      if(!row.dueDate || dueReview || !independent)row.dueDate=dayAfter(date,independent&&dueReview?POLICY.reviewDays[row.streak]:independent?3:1);
      row.lastDay=date;row.reviews.push({date,independent,phase:sessionPhase(s)});
    }
  }
  const rows=[...skills.values()].map(row=>{
    const levels=[1,2].map(level=>{
      const samples=row.samples.filter(s=>s.level===level).slice(-POLICY.minSamples), n=samples.length;
      const days=new Set(samples.map(s=>s.date)).size, correct=samples.filter(s=>s.independent).length;
      const checkSamples=samples.filter(s=>s.phase==='check'),checks=checkSamples.length,checkRate=checks?checkSamples.filter(s=>s.independent).length/checks:null,rate=n?correct/n:null;
      const ready=n>=POLICY.minSamples&&days>=POLICY.minDays&&checks>=POLICY.minCheckSamples&&checkRate>=POLICY.threshold&&rate>=POLICY.threshold;
      return {level,samples:n,days,checks,checkRate,correct,rate,state:ready?'ready':n>=3&&rate<POLICY.threshold?'strengthen':'collecting'};
    });
    const recommendedLevel=levels[0].state==='ready'&&levels[1].state!=='strengthen'?2:1;
    return {key:row.key,module:row.module,skill:row.skill,levels,recommendedLevel,dueDate:row.dueDate,due:!!row.dueDate&&row.dueDate<=today,
      reviewCount:row.reviews.filter(r=>r.phase==='review').length};
  });
  function choose(row,phase){
    const pool=units.filter(u=>u.module===row.module && (phase==='check'?u.kind==='check':u.kind!=='check') && u.steps.some(q=>q.skill===row.skill) && u.level<=row.recommendedLevel);
    const fresh=pool.filter(u=>!exposures.has(u.id));
    const ranked=(fresh.length?fresh:phase==='check'?[]:pool).sort((a,b)=>Math.abs(a.level-row.recommendedLevel)-Math.abs(b.level-row.recommendedLevel)||a.id.localeCompare(b.id));
    const unit=ranked[0];return unit?{unitId:unit.id,title:unit.title,module:unit.module,level:unit.level,phase,focusSkill:row.skill,seen:exposures.has(unit.id)}:null;
  }
  const reviews=rows.filter(row=>row.due).map(row=>({...choose(row,'review'),skill:row.skill,dueDate:row.dueDate})).filter(r=>r.unitId);
  const recommendations=Object.keys(require('./modules')).filter(m=>units.some(u=>u.module===m)).map(module=>{
    const due=reviews.find(r=>r.module===module);if(due)return {...due,reason:'先复习到期技能，再学习新内容。'};
    const candidates=rows.filter(r=>r.module===module);
    const weak=candidates.find(r=>r.levels.some(level=>level.state==='strengthen'));
    const trainingCount=new Set(completed.filter(s=>s.unit.module===module&&sessionPhase(s)==='train').map(s=>s.unit.id)).size;
    if(!weak&&trainingCount>=3){for(const row of candidates){const pick=choose(row,'check');if(pick)return {...pick,reason:'换一份未见材料，独立检查理解方法。'};}}
    const row=weak||candidates.find(r=>r.levels[0].state!=='ready')||candidates[0];
    const pick=row&&choose(row,'train');return pick?{...pick,reason:weak?'先练习需要更多支持的技能。':'从适合当前证据的层次开始。'}:null;
  }).filter(Boolean);
  return {today,timeZone,policy:POLICY,skills:rows,reviews,recommendations};
}
module.exports={POLICY,dayAfter,sessionPhase,skillKey,buildLearningPlan};
