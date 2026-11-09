const express=require('express');
const db=require('./db');
const {localDateKey}=require('./utils');
const {OBSERVATION_TAGS,CONTEXTS,validDate,reportRange,buildReport,toCsv}=require('./learning-report');
module.exports=({units,view})=>{
 const router=express.Router();
 const timezone=()=>db.getSetting('timezone')||'Asia/Shanghai';
 function report(req){const range=reportRange(req.query,new Date(),timezone());return buildReport(db.learningSessions(req.owner),db.learningObservations(req.owner),units,range);}
 function context(session,stepIndex=null){
  const q=stepIndex===null?null:session.unit.steps[stepIndex];
  return {sessionId:session.id,unitId:session.unit.id,version:session.unit.version,title:session.unit.title,module:session.unit.module,phase:session.phase||'train',level:session.unit.level,stepIndex,...(q?{skill:q.skill,prompt:q.prompt,options:q.options}:{})};
 }
 const visibleStep=(session,index)=>Number.isInteger(index)&&index>=0&&index<session.unit.steps.length&&(session.status==='completed'||index<=session.results.length);
 router.get('/feedback-context',(req,res)=>{
  const session=db.learningSessions(req.owner).find(s=>s.id===req.query.sessionId);
  if(!session)return res.status(404).json({ok:false,error:'关联练习不存在或不属于当前用户'});
  const value=req.query.stepIndex,index=value===undefined?null:/^\d+$/.test(String(value))?Number(value):NaN;
  if(index!==null&&!visibleStep(session,index))return res.status(400).json({ok:false,error:'只能关联已经显示过的步骤'});
  res.json({ok:true,context:context(session,index)});
 });
 router.get('/report',(req,res)=>{try{const result=report(req);delete result.steps;res.set('cache-control','no-store').json({ok:true,...result,tags:OBSERVATION_TAGS,contexts:CONTEXTS});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 router.put('/observations/:id',(req,res)=>{
  const {id}=req.params,body=req.body||{};
  if(!/^[A-Za-z0-9-]{8,80}$/.test(id)||typeof body.mutationId!=='string'||!body.mutationId||body.mutationId.length>100)return res.status(400).json({ok:false,error:'观察记录标识无效'});
  const owner=db.observationOwner(id);if(owner&&owner!==req.owner)return res.status(404).json({ok:false,error:'观察记录不存在'});
  const existing=db.learningObservations(req.owner).find(o=>o.id===id);
  if(existing?.lastMutation===body.mutationId)return res.json({ok:true,observation:existing});
  if((existing?.revision||0)!==body.revision)return res.status(409).json({ok:false,error:'记录已被更新，请重新载入后编辑'});
  if(!validDate(body.date)||body.date>localDateKey(new Date(),timezone())||!CONTEXTS.includes(body.context)||!Array.isArray(body.tags)||body.tags.length>8||body.tags.some(t=>!OBSERVATION_TAGS.includes(t))||typeof body.note!=='string'||!body.note.trim()||body.note.length>2000)return res.status(400).json({ok:false,error:'请填写有效日期、场景、观察标签及1至2000字的说明'});
  const session=body.sessionId?db.learningSessions(req.owner).find(s=>s.id===body.sessionId):null;
  if(body.module&&!['reading','reasoning','math-reading'].includes(body.module))return res.status(400).json({ok:false,error:'观察模块无效'});
  if(body.sessionId&&!session)return res.status(400).json({ok:false,error:'关联练习不存在'});
  if(body.stepIndex!==null&&body.stepIndex!==undefined&&(!session||!visibleStep(session,body.stepIndex)))return res.status(400).json({ok:false,error:'只能关联已经显示过的步骤'});
  const now=new Date().toISOString(),observation={id,date:body.date,context:body.context,module:session?.unit.module||body.module||'',tags:[...new Set(body.tags)],note:body.note.trim(),sessionId:session?.id||'',stepIndex:body.stepIndex??null,createdAt:existing?.createdAt||now,updatedAt:now,revision:(existing?.revision||0)+1,lastMutation:body.mutationId};
  db.saveObservation(req.owner,observation);db.flushDbSync();res.json({ok:true,observation});
 });
 router.delete('/observations/:id',(req,res)=>{
  const existing=db.learningObservations(req.owner).find(o=>o.id===req.params.id);
  if(!existing)return res.json({ok:true});
  if(existing.revision!==req.body?.revision)return res.status(409).json({ok:false,error:'记录已被更新，请重新载入后删除'});
  db.deleteObservation(req.owner,existing.id);db.flushDbSync();res.json({ok:true});
 });
 router.get('/export',(req,res)=>{
  try{
   const result=report(req),kind=req.query.kind||'steps';let columns,rows;
   if(kind==='bundle'){
    const all=db.learningSessions(req.owner),range=result.range,inside=value=>{const day=localDateKey(new Date(value),range.timeZone);return day>=range.from&&day<=range.to;};
    const associated=new Set(result.observations.map(o=>o.sessionId).filter(Boolean));
    const sessions=all.filter(s=>(!range.module||s.unit.module===range.module)&&(inside(s.startedAt)||s.endedAt&&inside(s.endedAt)||associated.has(s.id)));
    const feedback=result.observations.map(o=>{const s=all.find(s=>s.id===o.sessionId);return {...o,material:s?context(s,o.stepIndex===null||o.stepIndex===undefined||!visibleStep(s,o.stepIndex)?null:o.stepIndex):null};});
    const bundle={version:1,kind:'family-trial',exportedAt:new Date().toISOString(),owner:req.owner,range,
     scope:'包含期间开始或完成的会话、期间观察关联的会话；快照为导出时状态。未完成独立检查隐藏答案和正确性。',
     report:result,feedback,sessions:sessions.map(s=>(s.phase||s.unit.kind)==='check'&&s.status!=='completed'?view(s):s)};
    return res.set('cache-control','no-store').set('content-disposition',`attachment; filename="schulte-trial-${range.from}-${range.to}.json"`).json(bundle);
   }else if(kind==='steps'){
    columns=[['date','完成日期'],['module','模块'],['phase','方式'],['level','层次'],['title','材料'],['sessionId','会话ID'],['stepIndex','步骤索引'],['skill','技能'],['question','问题'],['firstAnswer','首次答案'],['outcome','结果'],['hints','提示次数'],['wrong','错误次数'],['expected','参考答案'],['explanation','讲解'],['seen','是否已见材料']];rows=result.steps;
   }else if(kind==='observations'){
    columns=[['date','观察日期'],['module','模块'],['context','场景'],['tags','家长标签'],['note','观察说明'],['sessionId','关联会话'],['stepIndex','步骤索引'],['revision','版本']];rows=result.observations.map(o=>({...o,tags:o.tags.join('；')}));
   }else if(kind==='skills'){
    columns=[['module','模块'],['skill','技能'],['level','层次'],['phase','方式'],['n','本期新材料数'],['correct','本期独立正确数'],['previousN','上期新材料数'],['previousCorrect','上期独立正确数'],['delta','可比较时变化百分点']];rows=result.skills.map(r=>({...r,n:r.current.n,correct:r.current.correct,previousN:r.previous.n,previousCorrect:r.previous.correct,delta:r.delta===null?'样本不足':Math.round(r.delta*100)}));
   }else return res.status(400).json({ok:false,error:'不支持的导出类型'});
   res.set('cache-control','no-store').set('content-type','text/csv; charset=utf-8').set('content-disposition',`attachment; filename="schulte-${kind}-${result.range.from}-${result.range.to}.csv"`).send(toCsv(columns,rows));
  }catch(e){res.status(400).json({ok:false,error:e.message});}
 });
 return router;
};
