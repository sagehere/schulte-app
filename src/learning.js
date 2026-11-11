const express = require('express');
const crypto = require('crypto');
const ai = require('./learning-ai');
const {ageProfile,suitable}=require('./learning-age');
const {localDateKey}=require('./utils');
const db = require('./db');
const trainingUnits = require('./content/learning.json');
const checkUnits = require('./content/checks.json');
const { buildLearningPlan, sessionPhase } = require('./learning-progress');
const units = [...trainingUnits, ...checkUnits];
const MODULES = Object.fromEntries(Object.entries(require('./modules')).filter(([id]) => ['reading','reasoning','math-reading'].includes(id)));
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s/g, '').replace(/－/g, '-').replace(/＋/g, '+').replace(/×/g, '*').replace(/÷/g, '/');
function validateBank(bank) {
  const ids = new Set();
  for (const u of bank) {
    if (!MODULES[u.module] || ids.has(u.id) || !u.version || ![1,2,3].includes(u.level) || !u.lines.length || !u.steps.length) throw Error('题库单元无效');
    ids.add(u.id);
    for (const q of u.steps) {
      if (!q.skill || !q.prompt || !q.explanation || q.hints.length !== 3 || !q.answers.length) throw Error('题库步骤无效');
      if (q.options && q.answers.some(a => !Number.isInteger(Number(a)) || !q.options[Number(a)])) throw Error('选项答案无效');
    }
  }
}
validateBank(units);
function currentStep(s) { return s.unit.steps[s.results.length]; }
function view(s) {
  const q = currentStep(s), checking = sessionPhase(s)==='check' && s.status!=='completed';
  return {
    id:s.id, status:s.status, module:s.unit.module, unitId:s.unit.id, version:s.unit.version,
    phase:sessionPhase(s), level:s.unit.level, fresh:s.fresh, focusSkill:s.focusSkill||'',
    source:s.unit.source||'fixed', ageProfile:s.unit.ageProfile||null, title:s.unit.title, lines:s.unit.lines, demonstration:checking?'':s.unit.demonstration,
    index:s.results.length, total:s.unit.steps.length,
    results:checking?s.results.map(r=>({skill:r.skill,submitted:true})):s.results,
    step:q ? {skill:q.skill,prompt:q.prompt,options:q.options} : null,
    hints:checking?[]:s.hints, elapsedMs:s.elapsedMs,
    feedback:checking?'独立检查结束后统一显示结果与讲解。':s.feedback||'', startedAt:s.startedAt
  };
}
function summary(s) {
  return {
    id:s.id,type:s.unit.module,status:s.status,date:s.startedAt,startedAt:s.startedAt,endedAt:s.endedAt||'',
    title:s.unit.title,timeMs:s.elapsedMs||0,practiceMs:s.elapsedMs||0,
    errors:sessionPhase(s)==='check'&&s.status!=='completed'?0:s.results.reduce((n,r)=>n+r.wrong,0),
    // During a check even the public summary must not reveal correctness.
    accuracy:sessionPhase(s)==='check'&&s.status!=='completed'?0:s.results.length?Math.round(s.results.filter(r=>r.independent).length/s.results.length*100):0,
    learningPhase:sessionPhase(s), learningLevel:s.unit.level, learningSkills:[...new Set(s.unit.steps.map(q=>q.skill))]
  };
}
function shuffleCheck(unit) {
  const snapshot=JSON.parse(JSON.stringify(unit));
  for(const q of snapshot.steps){
    if(!q.options)continue;
    const choices=q.options.map((text,index)=>({text,index}));
    for(let i=choices.length-1;i>0;i--){const j=crypto.randomInt(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
    const correct=new Set(q.answers.map(Number));
    q.options=choices.map(c=>c.text);q.answers=choices.flatMap((c,i)=>correct.has(c.index)?[String(i)]:[]);
  }
  return snapshot;
}
module.exports = (requireSession, hasAdminAccess) => {
  const router = express.Router(), pendingGenerations=new Map(), generationTimes=new Map();
  const timezone=()=>db.getSetting('timezone')||'Asia/Shanghai';
  const profileFor=owner=>ageProfile(db.getUser(owner)?.birthDate,new Date(),timezone());
  function available(owner){
    const profile=profileFor(owner),sessions=db.learningSessions(owner);
    const generated=[...new Map(sessions.filter(s=>s.unit.source==='ai').map(s=>[s.unit.id,s.unit])).values()];
    return [...units,...generated].filter(u=>suitable(u,profile));
  }
  function collision(id){const stmt=db.getDb().prepare('SELECT id FROM learning_sessions WHERE id=?');stmt.bind([id]);const exists=stmt.step();stmt.free();return exists||db.getRecordOwner(id);}
  function saveSession(owner,id,unit,phase,focusSkill,all){
    const session={id,unit:phase==='check'?shuffleCheck(unit):JSON.parse(JSON.stringify(unit)),phase,focusSkill,fresh:!all.some(s=>s.unit.id===unit.id||ai.fingerprintFor(s.unit)===ai.fingerprintFor(unit)),
      status:'unfinished',startedAt:new Date().toISOString(),results:[],hints:[],wrong:0,answers:[],events:[],elapsedMs:0};
    db.saveLearningSession(owner,session);db.putRecord(owner,summary(session));db.flushDbSync();return session;
  }

  router.use(async (req,res,next) => {
    res.setHeader('cache-control','no-store');
    const identifier=String(req.headers['x-user-id']||'');
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(hasAdminAccess(req)&&identifier&&db.getUser(identifier)){req.owner=identifier;return next();}
    const access=await requireSession(identifier,token);
    if(access.error)return res.status(403).json({ok:false,error:'请先在首页登录用户，再进入理解训练'});
    req.owner=identifier;next();
  });
  router.get('/catalog',(req,res)=>{
    const sessions=db.learningSessions(req.owner),profile=profileFor(req.owner),pool=available(req.owner);
    const describe=u=>({id:u.id,module:u.module,title:u.title,level:u.level,kind:u.kind||'train',source:u.source||'fixed',skills:[...new Set(u.steps.map(q=>q.skill))],
      seen:sessions.some(s=>s.unit.id===u.id),completed:sessions.filter(s=>s.unit.id===u.id&&s.status==='completed').length});
    const timezone=db.getSetting('timezone')||'Asia/Shanghai';
    res.json({ok:true,modules:MODULES,profile,ai:ai.status(),skills:ai.SKILLS,units:pool.filter(u=>u.kind!=='check').map(describe),checks:pool.filter(u=>u.kind==='check').map(describe),sessions:sessions.map(view),
      plan:buildLearningPlan(sessions,pool,new Date(),timezone)});
  });
  router.post('/generate',async(req,res)=>{
    const body=req.body||{},id=typeof body.id==='string'?body.id:'',module=body.module,phase=body.phase||'train',level=[1,2,3,'1','2','3'].includes(body.level??1)?Number(body.level??1):NaN,focusSkill=body.focusSkill||'';
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id)||typeof module!=='string'||!Object.hasOwn(MODULES,module)||!['train','check','review'].includes(phase)||![1,2,3].includes(level)||typeof focusSkill!=='string'||focusSkill&&!ai.SKILLS[module].includes(focusSkill))return res.status(400).json({ok:false,error:'生成参数无效'});
    const existing=db.learningSessions(req.owner).find(s=>s.id===id);if(existing)return res.json({ok:true,session:view(existing)});
    if(collision(id))return res.status(409).json({ok:false,error:'练习标识冲突，请重试'});
    const pending=pendingGenerations.get(req.owner);
    if(pending){if(pending.id!==id)return res.status(429).json({ok:false,error:'已有材料正在生成，请等待'});try{return res.json({ok:true,session:view(await pending.promise)});}catch(e){return res.status(e.status||502).json({ok:false,error:e.message});}}
    const identity=db.getUser(req.owner),profile=profileFor(req.owner);
    if(profile.age===null||profile.age<6)return res.status(422).json({ok:false,error:profile.age===null?'请先在首页用户中心补充有效生日，再生成适龄材料':'当前AI训练面向6岁及以上用户，请由家长陪同阅读'});
    let configuration;try{configuration=ai.config();}catch{return res.status(503).json({ok:false,error:'AI配置无效，请联系管理员'});}
    if(!configuration)return res.status(503).json({ok:false,error:'尚未配置AI服务，请管理员设置接口地址、模型与密钥'});
    const today=localDateKey(new Date(),timezone()),all=db.learningSessions(req.owner);
    if(all.filter(s=>s.unit.source==='ai'&&localDateKey(new Date(s.startedAt),timezone())===today).length>=configuration.dailyLimit)return res.status(429).json({ok:false,error:'今天的AI材料额度已用完，请明天继续'});
    const now=Date.now(),recent=(generationTimes.get(req.owner)||[]).filter(t=>now-t<60000);
    if(recent.length>=3)return res.status(429).json({ok:false,error:'生成请求过于频繁，请稍后再试'});recent.push(now);generationTimes.set(req.owner,recent);
    const promise=(async()=>{
      const unit=await ai.generate({module,phase,level,focusSkill,profile},{configuration});
      // The account may be renamed/deleted or its birthday changed while the API is running.
      if(db.getUser(req.owner)?.createdAt!==identity.createdAt||profileFor(req.owner).band!==profile.band){const e=Error('用户资料已变化，请重新载入');e.status=409;throw e;}
      if(collision(id)){const e=Error('练习标识冲突，请重试');e.status=409;throw e;}
      const current=db.learningSessions(req.owner);
      if(phase==='check'&&current.some(s=>s.unit.id===unit.id||ai.fingerprintFor(s.unit)===unit.fingerprint)){const e=Error('生成了已见材料，请重新生成新检查');e.status=409;throw e;}
      return saveSession(req.owner,id,unit,phase,focusSkill,current);
    })();
    pendingGenerations.set(req.owner,{id,promise});
    try{res.json({ok:true,session:view(await promise)});}catch(e){res.status(e.status||502).json({ok:false,error:e.message});}finally{pendingGenerations.delete(req.owner);}
  });
  router.post('/start',(req,res)=>{
    const body=req.body||{},id=typeof body.id==='string'?body.id:'';
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id))return res.status(400).json({ok:false,error:'练习标识无效'});
    const all=db.learningSessions(req.owner),existing=all.find(s=>s.id===id);
    if(existing)return res.json({ok:true,session:view(existing)});
    if(collision(id))return res.status(409).json({ok:false,error:'练习标识冲突，请重试'});
    const unit=available(req.owner).find(u=>u.id===body.unitId);
    if(!unit)return res.status(422).json({ok:false,error:profileFor(req.owner).age===null?'请先在首页用户中心补充有效生日':'这份材料不适合当前年龄，请选择适龄材料或使用AI生成'});
    if(unit.kind==='check'&&all.some(s=>s.unit.id===unit.id))return res.status(409).json({ok:false,error:'这份检查材料已经使用，请继续原检查或回看结果，另选新材料'});
    const phase=unit.kind==='check'?'check':body.phase==='review'?'review':'train';
    const focusSkill=unit.steps.some(q=>q.skill===body.focusSkill)?body.focusSkill:'';
    res.json({ok:true,session:view(saveSession(req.owner,id,unit,phase,focusSkill,all))});
  });
  router.post('/:id/action',(req,res)=>{
    const s=db.learningSessions(req.owner).find(s=>s.id===req.params.id);
    if(!s)return res.status(404).json({ok:false,error:'练习不存在'});
    const {eventId,index,kind,answer} = req.body||{};
    if(typeof eventId!=='string'||eventId.length>100||!eventId)return res.status(400).json({ok:false,error:'缺少操作标识'});
    if(s.events.includes(eventId))return res.json({ok:true,session:view(s)});
    if(s.status==='completed'||index!==s.results.length)return res.status(409).json({ok:false,error:'步骤已改变，请重新载入'});
    const checking=sessionPhase(s)==='check',q=currentStep(s);
    if(!(checking?['answer','skip']:['answer','hint','reveal','demo']).includes(kind))return res.status(400).json({ok:false,error:checking?'独立检查期间不提供提示或讲解':'未知操作'});
    if(kind==='hint'||kind==='demo'){
      if(s.hints.length<3)s.hints.push(kind==='demo'?s.unit.demonstration:q.hints[s.hints.length]);s.feedback='';
    }else{
      if(kind==='answer'&&(typeof answer!=='string'||answer.length>200))return res.status(400).json({ok:false,error:'答案过长或格式无效'});
      if(kind==='answer'&&q.options&&!q.options.some((_,i)=>String(i)===answer))return res.status(400).json({ok:false,error:'请选择有效选项'});
      const correct=kind==='answer'&&q.answers.some(a=>clean(a)===clean(answer));
      if(kind==='answer'||kind==='skip')s.answers.push({answer:answer||'',correct,skipped:kind==='skip',at:new Date().toISOString()});
      if(!checking&&!correct&&kind!=='reveal'){
        s.wrong++;s.feedback='再检查一下：'+q.hints[0];if(!s.hints.length)s.hints.push(q.hints[0]);
      }else{
        s.results.push({skill:q.skill,independent:correct&&s.wrong===0&&s.hints.length===0,correct,
          wrong:checking?(correct?0:1):s.wrong,hints:s.hints.length,answers:s.answers,explanation:q.explanation});
        s.feedback=checking?'答案已保存。':q.explanation;s.hints=[];s.wrong=0;s.answers=[];
        if(s.results.length===s.unit.steps.length){s.status='completed';s.endedAt=new Date().toISOString();}
      }
    }
    s.events.push(eventId);
    s.elapsedMs=Math.max(s.elapsedMs,Math.min(Date.now()-Date.parse(s.startedAt),Math.max(0,Number(req.body.elapsedMs)||0)));
    db.saveLearningSession(req.owner,s);db.putRecord(req.owner,summary(s));db.flushDbSync();
    res.json({ok:true,session:view(s)});
  });
  router.get('/export',(req,res)=>{
    res.setHeader('content-disposition','attachment; filename="learning-records.json"');
    const sessions=db.learningSessions(req.owner);
    res.json({version:3,observations:db.learningObservations(req.owner),exportedAt:new Date().toISOString(),sessions:sessions.map(s=>sessionPhase(s)==='check'&&s.status!=='completed'?view(s):s)});
  });
  router.use('/parents', require('./parent-routes')({units,view,available}));
  return router;
};
module.exports.validateBank=validateBank;
