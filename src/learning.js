const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const units = require('./content/learning.json');
const MODULES = Object.fromEntries(Object.entries(require('./modules')).filter(([id]) => ['reading','reasoning','math-reading'].includes(id)));
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s/g, '').replace(/－/g, '-').replace(/＋/g, '+').replace(/×/g, '*').replace(/÷/g, '/');
function validateBank(bank) {
  const ids = new Set();
  for (const u of bank) {
    if (!MODULES[u.module] || ids.has(u.id) || !u.version || !u.lines.length || !u.steps.length) throw Error('题库单元无效');
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
  const q = currentStep(s);
  return { id:s.id, status:s.status, module:s.unit.module, unitId:s.unit.id, version:s.unit.version,
    title:s.unit.title, lines:s.unit.lines, demonstration:s.unit.demonstration,
    index:s.results.length, total:s.unit.steps.length, results:s.results,
    step:q ? {skill:q.skill,prompt:q.prompt,options:q.options} : null,
    hints:s.hints, elapsedMs:s.elapsedMs, feedback:s.feedback || '', startedAt:s.startedAt };
}
function summary(s) {
  return { id:s.id,type:s.unit.module,status:s.status,date:s.startedAt,startedAt:s.startedAt,endedAt:s.endedAt||'',
    title:s.unit.title,timeMs:s.elapsedMs || 0,practiceMs:s.elapsedMs || 0,
    errors:s.results.reduce((n,r)=>n+r.wrong,0),accuracy:s.results.length ? Math.round(s.results.filter(r=>r.independent).length/s.results.length*100) : 0 };
}
module.exports = (requireSession, hasAdminAccess) => {
  const router = express.Router();
  router.use(async (req,res,next) => {
    const identifier = String(req.headers['x-user-id'] || '');
    const token = (req.headers.authorization || '').replace(/^Bearer /,'');
    if (hasAdminAccess(req) && identifier && db.getUser(identifier)) { req.owner=identifier; return next(); }
    const access = await requireSession(identifier,token);
    if (access.error) return res.status(403).json({ok:false,error:'请先在首页登录用户，再进入理解训练'});
    req.owner=identifier; next();
  });
  router.get('/catalog', (req,res) => {
    const sessions = db.learningSessions(req.owner);
    res.json({ok:true,modules:MODULES,units:units.map(u=>({id:u.id,module:u.module,title:u.title,level:u.level,
      seen:sessions.some(s=>s.unit.id===u.id),completed:sessions.filter(s=>s.unit.id===u.id&&s.status==='completed').length})),
      sessions:sessions.map(view)});
  });
  router.post('/start', (req,res) => {
    const unit=units.find(u=>u.id===req.body.unitId);
    const id=String(req.body.id||'');
    if (!unit || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) return res.status(400).json({ok:false,error:'单元或练习标识无效'});
    const all = db.learningSessions(req.owner), existing=all.find(s=>s.id===id);
    if (existing) return res.json({ok:true,session:view(existing)});
    // IDs are globally unique; never overwrite another user's session.
    const stmt=db.getDb().prepare('SELECT id FROM learning_sessions WHERE id=?');stmt.bind([id]);const exists=stmt.step();stmt.free();
    if (exists || db.getRecordOwner(id)) return res.status(409).json({ok:false,error:'练习标识冲突，请重试'});
    const session={id,unit:JSON.parse(JSON.stringify(unit)),status:'unfinished',startedAt:new Date().toISOString(),results:[],hints:[],wrong:0,answers:[],events:[],elapsedMs:0};
    db.saveLearningSession(req.owner,session);db.putRecord(req.owner,summary(session));
    db.flushDbSync();
    res.json({ok:true,session:view(session)});
  });
  router.post('/:id/action', (req,res) => {
    const s=db.learningSessions(req.owner).find(s=>s.id===req.params.id);
    if (!s) return res.status(404).json({ok:false,error:'练习不存在'});
    const {eventId,index,kind,answer}=req.body;
    if (typeof eventId!=='string'||eventId.length>100||!eventId) return res.status(400).json({ok:false,error:'缺少操作标识'});
    if (s.events.includes(eventId)) return res.json({ok:true,session:view(s)});
    if (s.status==='completed'||index!==s.results.length) return res.status(409).json({ok:false,error:'步骤已改变，请重新载入'});
    const q=currentStep(s);
    if (!['answer','hint','reveal','demo'].includes(kind)) return res.status(400).json({ok:false,error:'未知操作'});
    if (kind==='hint' || kind==='demo') {
      if(s.hints.length<3) s.hints.push(kind==='demo' ? s.unit.demonstration : q.hints[s.hints.length]);
      s.feedback='';
    } else {
      if (kind==='answer' && (typeof answer!=='string'||answer.length>200)) return res.status(400).json({ok:false,error:'答案过长或格式无效'});
      const correct=kind==='answer' && q.answers.some(a=>clean(a)===clean(answer));
      if(kind==='answer')s.answers.push({answer,correct,at:new Date().toISOString()});
      if (!correct && kind!=='reveal') {s.wrong++;s.feedback='再检查一下：'+q.hints[0]; if(!s.hints.length)s.hints.push(q.hints[0]);}
      else {
        s.results.push({skill:q.skill,independent:correct&&s.wrong===0&&s.hints.length===0,correct,wrong:s.wrong,hints:s.hints.length,answers:s.answers,explanation:q.explanation});
        s.feedback=q.explanation;s.hints=[];s.wrong=0;s.answers=[];
        if(s.results.length===s.unit.steps.length){s.status='completed';s.endedAt=new Date().toISOString();}
      }
    }
    s.events.push(eventId);
    // Client reports active time only; bound it by wall time, never use it for ranking.
    s.elapsedMs=Math.max(s.elapsedMs,Math.min(Date.now()-Date.parse(s.startedAt),Math.max(0,Number(req.body.elapsedMs)||0)));
    db.saveLearningSession(req.owner,s);db.putRecord(req.owner,summary(s));db.flushDbSync();
    res.json({ok:true,session:view(s)});
  });
  router.get('/export', (req,res)=> {
    res.setHeader('content-disposition','attachment; filename="learning-records.json"');
    res.json({version:1,exportedAt:new Date().toISOString(),sessions:db.learningSessions(req.owner)});
  });
  return router;
};
module.exports.validateBank=validateBank;
