(() => {
  const $=id=>document.getElementById(id), phaseLabel={train:'学习练习',check:'独立检查',review:'复习'};
  let user;try{user=JSON.parse(localStorage.getItem('schulte.cloudUser.v1')||'null');}catch{}
  const params=new URLSearchParams(location.search);
  let manualReview=false,catalog,session,busy=false,selected=params.get('module')||'reading',phase=params.get('phase')||'train',pending=null,activeMs=0,tick=performance.now();
  if(!phaseLabel[phase])phase='train';
  setInterval(()=>{const now=performance.now();if(session&&session.status!=='completed'&&!document.hidden)activeMs+=now-tick;tick=now;},1000);
  document.addEventListener('visibilitychange',()=>{tick=performance.now();});
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const button=(text,run)=>{const n=node('button',text);n.type='button';n.onclick=()=>run();return n;};
  const allUnits=()=>[...catalog.units,...(catalog.checks||[])];
  async function api(path,body){
    const response=await fetch('/api/learning'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user-id':user?.identifier||'',authorization:'Bearer '+(user?.sessionToken||'')},body:body?JSON.stringify(body):undefined});
    const value=await response.json();if(!response.ok)throw Error(value.error||'请求失败');return value;
  }
  function say(text){$('notice').textContent=text;}
  function showSession(s){activeMs=session?.id===s.id?Math.max(activeMs,s.elapsedMs||0):(s.elapsedMs||0);session=s;tick=performance.now();$('catalog').hidden=true;$('practice').hidden=false;render();}
  async function start(unit,requestedPhase=phase,focusSkill=$('skillFilter').value){
    if(busy)return;
    busy=true;
    try{
      const open=catalog.sessions.find(s=>s.unitId===unit.id&&s.status==='unfinished'&&(s.phase||'train')===requestedPhase);
      if(open){showSession(open);return;}
      const key='learning.start.'+user.identifier+'.'+unit.id+'.'+requestedPhase;
      let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
      const result=await api('/start',{unitId:unit.id,id,phase:requestedPhase,focusSkill});
      localStorage.removeItem(key);activeMs=0;showSession(result.session);
      say(result.session.phase==='check'?'独立完成后统一看讲解，原文可以随时回看。':'进度会随每次提交保存。');
    }catch(e){say(e.message+'；可再次点击重试。');}finally{busy=false;}
  }
  function render(){
    const checking=session.phase==='check',q=session.step;
    $('title').textContent=session.title+' · '+phaseLabel[session.phase||'train'];$('progress').textContent=`已完成 ${session.index}/${session.total} 步`;
    $('passage').replaceChildren(...session.lines.map(t=>node('p',t)));$('demo').hidden=!q||checking;
    $('feedback').textContent=session.feedback;$('hints').textContent=session.hints.join('\n');
    $('question').textContent=q?q.prompt:'本次学习已完成';$('options').replaceChildren();
    $('answerForm').hidden=!q||!!q.options;$('help').hidden=!q||checking;$('skipCheck').hidden=!q||!checking;
    if(q?.options)q.options.forEach((text,i)=>$('options').append(button(text,()=>action('answer',String(i)))));
    if(!q){
      const independent=session.results.filter(r=>r.independent).length;
      $('feedback').textContent=`完成 ${session.total} 步，其中首次独立答对 ${independent} 步。\n`+session.results.map(r=>r.skill+'：'+(r.independent?'独立完成':checking?'本步未答对':r.correct?'帮助后完成':'看过讲解')+'\n'+r.explanation).join('\n');
    }
    $('answer').value='';
  }
  async function action(kind,answer){
    if(busy||!session?.step)return;
    const signature=JSON.stringify([session.id,session.index,kind,answer]);
    if(pending&&pending.signature!==signature){say('上一操作尚未确认，请重试刚才的操作，或返回列表重新载入。');return;}
    if(!pending)pending={signature,body:{index:session.index,kind,answer,eventId:crypto.randomUUID(),elapsedMs:activeMs}};
    busy=true;document.querySelectorAll('#practice button').forEach(b=>b.disabled=true);
    try{const result=await api('/'+session.id+'/action',pending.body);pending=null;showSession(result.session);say('已保存');}
    catch(e){say(e.message+'；请重试刚才的操作。');}
    finally{busy=false;document.querySelectorAll('#practice button').forEach(b=>b.disabled=false);}
  }
  function updateSkills(){
    const previous=$('skillFilter').value||params.get('skill')||'';
    const skills=[...new Set(allUnits().filter(u=>u.module===selected).flatMap(u=>u.skills||[]))];
    $('skillFilter').replaceChildren(new Option('全部技能',''),...skills.map(s=>new Option(s,s)));
    if(skills.includes(previous))$('skillFilter').value=previous;
  }
  async function load(){
    try{
      catalog=await api('/catalog');if(!catalog.modules[selected])selected='reading';
      $('identity').textContent='当前用户：'+user.identifier;
      $('modules').replaceChildren(...Object.entries(catalog.modules).map(([id,label])=>{const b=button(label,()=>{if(busy)return;selected=id;updateSkills();list();});b.dataset.module=id;return b;}));
      updateSkills();list();say('');
    }catch(e){say(e.message);}
  }
  function progress(){
    const stateLabel={ready:'可尝试进阶',strengthen:'需要更多支持',collecting:'继续观察'};
    $('skills').replaceChildren(...(catalog.plan?.skills||[]).filter(r=>r.module===selected).map(row=>{
      const card=node('article','');card.className='card';card.append(node('strong',row.skill));
      for(const level of row.levels){
        const rate=level.rate===null?'暂无新题记录':`${level.correct}/${level.samples}（${Math.round(level.rate*100)}%）`;
        card.append(node('p',`${level.level===1?'基础':'连接'}：${rate} · ${level.days}个日期 · 独立检查${level.checks}题${level.checkRate===null?'':'（'+Math.round(level.checkRate*100)+'%）'} · ${level.level===2&&level.state==='ready'?'保持并练习迁移':stateLabel[level.state]}`));
      }
      card.append(node('p',row.dueDate?`下次复习：${row.dueDate}${row.due?'（已到期）':''}`:'完成练习后安排复习'));return card;
    }));
  }
  function list(){
    $('catalog').hidden=false;$('practice').hidden=true;session=null;pending=null;
    document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===selected));
    document.querySelectorAll('[data-phase]').forEach(b=>b.classList.toggle('active',b.dataset.phase===phase));
    $('manualReview').hidden=phase!=='review';$('manualReview').textContent=manualReview?'查看到期复习':'自主选择复习材料';
    $('unitListTitle').textContent=phase==='check'?'选择一份独立检查':phase==='review'?'到期复习':'选择一个小练习';
    $('modeHint').textContent=phase==='check'?'每份检查材料只使用一次，提交全部步骤后统一查看讲解。遇到不会的步骤可以先提交。':phase==='review'?'按到期技能复习，优先换一份材料；重复材料会标明已见，不增加新题证据。':'先学方法，再在新材料中试一试。基础与连接层次可自由选择。';
    const rec=catalog.plan?.recommendations.find(r=>r.module===selected),box=$('recommendation');box.replaceChildren();
    if(rec){box.append(node('strong','下一步建议：'+rec.title),node('p',phaseLabel[rec.phase]+' · '+(rec.level===1?'基础':'连接')+' · '+rec.focusSkill),node('p',rec.reason+(rec.seen?'（已见材料，用于巩固。）':'')),button('按建议开始',()=>{const unfinished=catalog.sessions.find(s=>s.unitId===rec.unitId&&s.status==='unfinished'&&(s.phase||'train')===rec.phase);unfinished?showSession(unfinished):start(allUnits().find(u=>u.id===rec.unitId),rec.phase,rec.focusSkill);}));}
    box.hidden=!rec;progress();
    const level=$('levelFilter').value,skill=$('skillFilter').value;
    const matches=u=>u.module===selected&&(!level||u.level===Number(level))&&(!skill||u.skills.includes(skill));
    let cards;
    if(phase==='review'&&!manualReview){
      cards=(catalog.plan?.reviews||[]).filter(r=>r.module===selected&&(!skill||r.skill===skill)&&(!level||r.level===Number(level))).map(review=>{
        const card=node('article','');card.className='card';card.append(node('h3',review.skill),node('p',`到期：${review.dueDate} · ${review.seen?'已见材料巩固':'换一份材料'}`),node('p',review.title),button('开始复习',()=>start(allUnits().find(u=>u.id===review.unitId),'review',review.skill)));return card;
      });
    }else cards=(phase==='check'?catalog.checks:catalog.units).filter(matches).map(u=>{
      const card=node('article','');card.className='card';card.append(node('h3',u.title),node('p',`${u.level===1?'基础':'连接'} · ${u.seen?'练习过':'新材料'}`));
      const unfinished=catalog.sessions.find(s=>s.unitId===u.id&&s.status==='unfinished'&&(s.phase||'train')===phase);
      const completed=catalog.sessions.find(s=>s.unitId===u.id&&s.status==='completed');
      card.append(button(unfinished?'继续上次练习':phase==='check'&&completed?'回看检查结果':phase==='check'?'开始检查':phase==='review'?'开始复习':'开始练习',()=>unfinished?showSession(unfinished):phase==='check'&&completed?showSession(completed):start(u)));return card;
    });
    $('units').replaceChildren(...(cards.length?cards:[node('p',phase==='review'?'当前筛选下暂无到期复习。':'当前筛选下没有材料。')]));
    $('history').replaceChildren(...catalog.sessions.slice().sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)).slice(0,20).map(s=>{
      const n=node('article','');n.append(node('strong',s.title+' · '+phaseLabel[s.phase||'train']+' · '+(s.status==='completed'?'已完成':'进行中')),
        node('p',s.phase==='check'&&s.status!=='completed'?`已提交${s.index}步，结束后查看结果。`:s.results.map(r=>r.skill+'：'+(r.independent?'首次独立答对':s.phase==='check'?'本步未答对':'获得帮助')).join('；')||'已登记开始'));
      n.append(button('查看 / 继续',()=>showSession(s)));return n;
    }));
  }
  $('levelFilter').value=['1','2'].includes(params.get('level'))?params.get('level'):'';
  $('manualReview').onclick=()=>{manualReview=!manualReview;list();};
  $('levelFilter').onchange=list;$('skillFilter').onchange=list;
  document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{if(!busy){phase=b.dataset.phase;list();}});
  $('answerForm').onsubmit=e=>{e.preventDefault();action('answer',$('answer').value);};
  $('hint').onclick=()=>action('hint');$('reveal').onclick=()=>action('reveal');$('back').onclick=()=>{if(!busy)load();};
  $('demo').onclick=()=>action('demo');$('skipCheck').onclick=()=>action('skip');
  $('export').onclick=async()=>{try{const data=await api('/export');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='learning-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){say(e.message);}};
  if(!user?.sessionToken)say('请先返回首页，在用户中心登录，再进入理解训练。');else load();
})();
