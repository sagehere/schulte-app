(() => {
  const $=id=>document.getElementById(id);
  let user;try{user=JSON.parse(localStorage.getItem('schulte.cloudUser.v1')||'null');}catch{}
  let catalog, session, busy=false, selected='', pending=null, activeMs=0, tick=performance.now();
  setInterval(()=>{const now=performance.now();if(session&&!document.hidden)activeMs+=now-tick;tick=now;},1000);
  document.addEventListener('visibilitychange',()=>{tick=performance.now();});
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const button=(text,run)=>{const n=node('button',text);n.type='button';n.onclick=()=>run();return n;};
  async function api(path,body){
    const response=await fetch('/api/learning'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user-id':user?.identifier||'',authorization:'Bearer '+(user?.sessionToken||'')},body:body?JSON.stringify(body):undefined});
    const value=await response.json();if(!response.ok)throw Error(value.error||'请求失败');return value;
  }
  function say(text){$('notice').textContent=text;}
  function showSession(s){activeMs=session?.id===s.id?Math.max(activeMs,s.elapsedMs||0):(s.elapsedMs||0);session=s;$('catalog').hidden=true;$('practice').hidden=false;render();}
  async function start(unit){
    try{const key='learning.start.'+user.identifier+'.'+unit.id;let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
      const result=await api('/start',{unitId:unit.id,id});localStorage.removeItem(key);activeMs=0;showSession(result.session);say('进度会随每次提交保存。');
    }catch(e){say(e.message+'；可再次点击重试。');}
  }
  function render(){
    $('title').textContent=session.title;$('progress').textContent=`已完成 ${session.index}/${session.total} 步`;
    $('passage').replaceChildren(...session.lines.map(t=>node('p',t)));$('demo').hidden=!session.step;
    $('feedback').textContent=session.feedback;$('hints').textContent=session.hints.join('\n');
    const q=session.step;$('question').textContent=q?q.prompt:'本次学习已完成';$('options').replaceChildren();
    $('answerForm').hidden=!q||!!q.options;$('help').hidden=!q;
    if(q?.options)q.options.forEach((text,i)=>$('options').append(button(text,()=>action('answer',String(i)))));
    if(!q){const independent=session.results.filter(r=>r.independent).length;$('feedback').textContent=`完成 ${session.total} 步，其中首次独立答对 ${independent} 步。\n`+session.results.map(r=>r.skill+'：'+(r.independent?'独立完成':r.correct?'帮助后完成':'看过讲解')+'\n'+r.explanation).join('\n');}
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
  async function load(){
    try{catalog=await api('/catalog');selected ||= new URLSearchParams(location.search).get('module')||'reading';
      $('identity').textContent='当前用户：'+user.identifier;
      $('modules').replaceChildren(...Object.entries(catalog.modules).map(([id,label])=>{const b=button(label,()=>{selected=id;list();});b.dataset.module=id;return b;}));list();say('');
    }catch(e){say(e.message);}
  }
  function list(){
    $('catalog').hidden=false;$('practice').hidden=true;session=null;pending=null;
    document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===selected));
    $('units').replaceChildren(...catalog.units.filter(u=>u.module===selected).map(u=>{const card=node('article','');card.className='card';card.append(node('h3',u.title),node('p',`${u.level===1?'基础':'连接'} · ${u.seen?'练习过':'新材料'}`));const unfinished=catalog.sessions.find(s=>s.unitId===u.id&&s.status==='unfinished');card.append(button(unfinished?'继续上次练习':'开始练习',()=>unfinished?showSession(unfinished):start(u)));return card;}));
    $('history').replaceChildren(...catalog.sessions.slice().reverse().slice(0,20).map(s=>{const n=node('article','');n.append(node('strong',s.title+' · '+(s.status==='completed'?'已完成':'进行中')),node('p',s.results.map(r=>r.skill+'：'+(r.independent?'首次独立答对':'获得帮助')).join('；')||'已登记开始'));n.append(button('查看 / 继续',()=>showSession(s)));return n;}));
  }
  $('answerForm').onsubmit=e=>{e.preventDefault();action('answer',$('answer').value);};
  $('hint').onclick=()=>action('hint');$('reveal').onclick=()=>action('reveal');$('back').onclick=()=>load();
  $('demo').onclick=()=>action('demo');
  $('export').onclick=async()=>{try{const data=await api('/export');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='learning-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){say(e.message);}};
  if(!user?.sessionToken)say('请先返回首页，在用户中心登录，再进入理解训练。');else load();
})();
