(() => {
 const $=id=>document.getElementById(id),modules={reading:'段落理解',reasoning:'因果推理','math-reading':'数学读题'},phases={train:'学习练习',check:'独立检查',review:'复习'},levels={1:'基础',2:'连接',3:'迁移'};
 let cloud;try{cloud=JSON.parse(localStorage.getItem('schulte.cloudUser.v1')||'null');}catch{}
 let data,owner=new URLSearchParams(location.search).get('user')||cloud?.identifier||'',admin='',editing=null,association={sessionId:'',stepIndex:null},pending=null,busy=false;
 $('owner').value=owner;
 const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const button=(text,run)=>{const b=node('button',text);b.type='button';b.onclick=run;return b;};
 const say=text=>$('parentNotice').textContent=text;
 const ratio=r=>r===null?'暂无记录':Math.round(r*100)+'%';
 const params=()=>new URLSearchParams({from:$('from').value,to:$('to').value,module:$('module').value});
 const shiftDay=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const validDay=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&shiftDay(date,0)===date;
 const trialKey=()=> 'schulte.trial.start.'+owner;
 const trialDays=[
  ['段落理解：新材料独立检查', [['reading','check']]],
  ['数学读题：新材料独立检查', [['math-reading','check']]],
  ['因果推理：新材料独立检查', [['reasoning','check']]],
  ['段落理解与数学读题：各选一个基础练习', [['reading','train'],['math-reading','train']]],
  ['因果推理与段落理解：各选一个基础练习', [['reasoning','train'],['reading','train']]],
  ['数学读题与因果推理：各选一个基础练习', [['math-reading','train'],['reasoning','train']]],
  ['纸面迁移：换一小段课文或一道新作业题，先独立说说题意', []],
  ['复习：优先到期技能，无到期时可自主选择材料', [['reading','review'],['math-reading','review']]],
  ['因果推理与段落理解：各换一份新材料练习', [['reasoning','train'],['reading','train']]],
  ['数学读题：另一份同层次新材料独立检查', [['math-reading','check']]],
  ['段落理解：另一份同层次新材料独立检查', [['reading','check']]],
  ['因果推理：另一份同层次新材料独立检查', [['reasoning','check']]],
  ['纸面迁移：再换一道新题，记录首次理解和所需帮助', []],
  ['家长复盘：查看期间报告，检查疑问题目，导出真实记录', []]
 ];
 function renderTrial(initial=false){
  if(initial){let saved;try{saved=localStorage.getItem(trialKey());}catch{}$('trialStart').value=validDay(saved||'')?saved:data.range.today;}
  const start=$('trialStart').value;if(!validDay(start)){$('trialNotice').textContent='请选择有效起始日。';return;}
  $('trialNotice').textContent='参考日程：'+start+' 至 '+shiftDay(start,13)+'；起始日保存在当前浏览器，仅作安排参考。';
  $('trialDays').replaceChildren(...trialDays.map(([text,links],i)=>{
   const day=shiftDay(start,i),li=node('li','');li.append(node('strong',`第${i+1}天 · ${day}${day===data.range.today?' · 今天':''}`),node('p',text));
   for(const [module,phase] of links){const a=node('a',modules[module]+' · '+phases[phase]);a.href='/learning?'+new URLSearchParams({module,phase,...(phase==='review'?{}:{level:'1'})});li.append(a,document.createTextNode(' '));}
   if(i===6||i===12){const b=button('记录纸面观察',()=>{resetObservation();$('observationDate').value=day;$('context').value='纸面作业';$('observationForm').scrollIntoView({behavior:'smooth'});});b.disabled=day>data.range.today;li.append(b);}
   return li;
  }));
 }
 async function linkedFeedback(){
  const query=new URLSearchParams(location.search);if(!query.has('session'))return;
  try{
   const p=new URLSearchParams({sessionId:query.get('session')});if(query.has('step'))p.set('stepIndex',query.get('step'));
   const c=(await(await request('/feedback-context?'+p)).json()).context;resetObservation();association={sessionId:c.sessionId,stepIndex:c.stepIndex};
   $('context').value='网页训练';$('observationDate').value=data.range.today;$('observationModule').value=c.module;$('observationModule').disabled=true;
   $('association').textContent=`关联：${c.title} · 版本 ${c.version}${c.stepIndex===null?'':' · 第'+(c.stepIndex+1)+'步：'+c.prompt}`;
   $('observationForm').scrollIntoView({behavior:'smooth'});say('已关联具体材料；请选择问题标签并描述当时看到的内容。独立检查的答案在结束后显示。');
  }catch(e){say('题目反馈关联失败：'+e.message);}
 }
 async function request(path,method='GET',body){
  const res=await fetch('/api/learning/parents'+path,{method,headers:{'content-type':'application/json','x-user-id':owner,authorization:'Bearer '+(admin||cloud?.sessionToken||'')},body:body?JSON.stringify(body):undefined});
  if(!res.ok){let value;try{value=await res.json();}catch{}throw Error(value?.error||'请求失败');}return res;
 }
 async function load(initial=false){
  try{
   const suffix=initial?'':'?'+params();data=await(await request('/report'+suffix)).json();
   $('from').value=data.range.from;$('to').value=data.range.to;$('observationDate').max=data.range.today;
   $('report').hidden=false;$('rangeTitle').textContent=owner+' · '+data.range.from+' 至 '+data.range.to;
   render();renderTrial(initial);if(!editing)$('observationDate').value=data.range.to;say('报告已载入。');if(initial)await linkedFeedback();
  }catch(e){$('report').hidden=true;say(e.message+'；请确认首页已登录，或填写管理员访问方式。');$('access').open=true;}
 }
 function render(){
  const s=data.summary;const metrics=[['本期开始',s.started],['本期开始且期末已完成',s.cohortCompleted],['本期完成单元',s.completedInPeriod],['首次独立答对',`${s.independent}/${s.steps}`],['完成单元累计用时',(s.completedDurationMs<60000?Math.round(s.completedDurationMs/1000)+' 秒':Math.round(s.completedDurationMs/60000)+' 分钟')]];
  $('summary').replaceChildren(...metrics.map(([label,value])=>{const c=node('article','');c.className='card';c.append(node('p',label),Object.assign(node('p',String(value)),{className:'metric'}));return c;}));
  $('modulesReport').replaceChildren(...data.modules.map(r=>{const tr=node('tr','');[modules[r.module],r.started,r.cohortCompleted,ratio(r.completionRate),r.completedInPeriod].forEach(v=>tr.append(node('td',String(v))));return tr;}));
  $('skillsReport').replaceChildren(...data.skills.map(r=>{const tr=node('tr','');[modules[r.module]+' / '+r.skill,levels[r.level]+' / '+phases[r.phase]+(r.source==='ai'?' / AI · '+r.ageBand+'岁':' / 备用题库'),`${r.current.correct}/${r.current.n}（${ratio(r.current.rate)}）`,`${r.previous.correct}/${r.previous.n}（${ratio(r.previous.rate)}）`,r.comparable?`${r.delta>0?'+':''}${Math.round(r.delta*100)} 个百分点`:'样本不足'].forEach(v=>tr.append(node('td',v)));return tr;}));
  if(!data.skills.length){const tr=node('tr','');const td=node('td','本期暂无新材料表现，先积累少量、分日完成的练习记录。');td.colSpan=5;tr.append(td);$('skillsReport').append(tr);}
  $('parentSuggestions').replaceChildren(...data.recommendations.map(r=>{const c=node('article','');c.className='card';c.append(node('strong',modules[r.module]+' · '+r.focusSkill),node('p',phases[r.phase]+' / '+levels[r.level]+'：'+r.title),node('p',r.reason));return c;}));
  $('evidenceHint').textContent=`显示最近${data.evidence.length}条需复核作答，共${data.evidenceCount}条；完整作答可通过CSV查看。`;
  $('evidence').replaceChildren(...data.evidence.map(r=>{const c=node('article','');c.className='wrap';c.append(node('strong',r.title+' · '+r.skill+' · '+r.outcome),node('p',r.question),node('p','首次答案：'+r.firstAnswer),node('p','参考：'+r.expected),node('p',r.explanation),button('为这次作答记录观察',()=>{resetObservation();association={sessionId:r.sessionId,stepIndex:r.stepIndex};$('context').value='网页训练';$('observationModule').value=r.module;$('observationModule').disabled=true;$('association').textContent='关联：'+r.title+'，第'+(r.stepIndex+1)+'步';$('observationForm').scrollIntoView({behavior:'smooth'});}));return c;}));
  const oldContext=$('context').value;$('context').replaceChildren(...data.contexts.map(v=>new Option(v,v)));if(data.contexts.includes(oldContext))$('context').value=oldContext;
  const selected=[...document.querySelectorAll('#tags input:checked')].map(e=>e.value);
  $('tags').replaceChildren(...data.tags.map(value=>{const label=node('label','');const input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=selected.includes(value);label.append(input,document.createTextNode(value));return label;}));
  $('observations').replaceChildren(...data.observations.map(o=>{const c=node('article','');c.className='wrap';c.append(node('strong',o.date+' · '+(modules[o.module]||'未指定模块')+' · '+o.context),node('p',o.tags.join(' / ')),Object.assign(node('p',o.note),{className:'observation-note'}),button('编辑观察',()=>edit(o)),button('删除观察',()=>remove(o)));return c;}));
 }
 function resetObservation(){editing=null;association={sessionId:'',stepIndex:null};pending=null;$('note').value='';$('observationModule').disabled=false;$('observationModule').value=$('module').value;$('observationId').value='';$('association').textContent='未关联具体作答';$('observationDate').value=data?.range.to||'';document.querySelectorAll('#tags input').forEach(e=>e.checked=false);}
 function edit(o){editing=o;association={sessionId:o.sessionId,stepIndex:o.stepIndex};pending=null;$('observationId').value=o.id;$('observationDate').value=o.date;$('context').value=o.context;$('observationModule').value=o.module||'';$('observationModule').disabled=!!o.sessionId;$('note').value=o.note;$('association').textContent=o.sessionId?'关联练习：'+o.sessionId+(o.stepIndex===null?'':'，第'+(o.stepIndex+1)+'步'):'未关联具体作答';document.querySelectorAll('#tags input').forEach(e=>e.checked=o.tags.includes(e.value));$('observationForm').scrollIntoView({behavior:'smooth'});}
 async function save(event){
  event.preventDefault();if(busy)return;
  const payload={revision:editing?.revision||0,date:$('observationDate').value,context:$('context').value,module:$('observationModule').value,tags:[...document.querySelectorAll('#tags input:checked')].map(e=>e.value),note:$('note').value,...association};
  const signature=JSON.stringify(payload);
  if(pending&&pending.signature!==signature){say('上次保存未确认，请先重试原内容；或重新载入记录后编辑。');return;}
  if(!pending)pending={id:editing?.id||crypto.randomUUID(),signature,body:{...payload,mutationId:crypto.randomUUID()}};
  busy=true;
  try{await request('/observations/'+pending.id,'PUT',pending.body);resetObservation();await load();say('观察已保存，原始作答与判分保持独立。');}catch(e){say(e.message+'；网络失败可用原内容重试。');}finally{busy=false;}
 }
 async function remove(o){if(busy||!confirm('确定删除这条家长观察吗？'))return;busy=true;try{await request('/observations/'+o.id,'DELETE',{revision:o.revision});if(editing?.id===o.id)resetObservation();await load();say('观察已删除。');}catch(e){say(e.message);}finally{busy=false;}}
 $('filters').onsubmit=e=>{e.preventDefault();if(!busy)load();};$('observationForm').onsubmit=save;$('cancelObservation').onclick=()=>{if(!busy)resetObservation();};
 $('accessForm').onsubmit=e=>{e.preventDefault();if(busy)return;owner=$('owner').value.trim();admin=$('adminPassword').value;$('adminPassword').value='';resetObservation();load(true);};
 $('trialStart').onchange=()=>{if(validDay($('trialStart').value)){try{localStorage.setItem(trialKey(),$('trialStart').value);}catch{}}renderTrial();};
 $('trialRange').onclick=()=>{const start=$('trialStart').value;if(!validDay(start)||start>data.range.today){$('trialNotice').textContent='试用尚未开始，请在起始日后查看记录。';return;}$('from').value=start;$('to').value=shiftDay(start,13)>data.range.today?data.range.today:shiftDay(start,13);$('module').value='';load();};
 document.querySelectorAll('[data-export]').forEach(b=>b.onclick=async()=>{try{const response=await request('/export?'+params()+'&kind='+b.dataset.export),blob=await response.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'schulte-export';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){say(e.message);}});
 if(owner&&cloud?.sessionToken)load(true);else{$('access').open=true;say('先在首页登录当前用户，或填写识别码与管理员密码。');}
})();
