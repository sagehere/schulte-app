// Optional end-to-end learning-cycle acceptance with a private temporary database.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const bank=require('../src/content/learning.json'),checks=require('../src/content/checks.json');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learning-cycle-'));process.env.DB_PATH=path.join(dir,'db');
 const db=require('../src/db'),{makePasswordRecord}=require('../src/utils');
 await db.initDb();db.createUser('cycleuser',{...await makePasswordRecord('123456')});
 const old=new Date(Date.now()-2*86400000).toISOString(),unit=bank[0];
 const seeded={id:'seeded-practice',phase:'train',fresh:true,status:'completed',startedAt:old,endedAt:old,elapsedMs:1000,unit,results:unit.steps.map((q,i)=>({skill:q.skill,independent:i!==0,correct:i!==0,wrong:i===0?1:0,hints:0,answers:[],explanation:q.explanation})),events:[],hints:[]};
 db.saveLearningSession('cycleuser',seeded);db.flushDbSync();
 const base='http://127.0.0.1:39889';
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:'39889',ADMIN_PASSWORD:'cycle-admin'},stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,40));}
  const login=await(await fetch(base+'/api/users/cycleuser/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'123456'})})).json();
  const headers={'x-user-id':'cycleuser',authorization:'Bearer '+login.sessionToken};
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu','--single-process']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/health');await page.evaluate(token=>localStorage.setItem('schulte.cloudUser.v1',JSON.stringify({identifier:'cycleuser',sessionToken:token})),login.sessionToken);
  await page.goto(base+'/learning?module=reading');await page.locator('[data-phase="review"]').click();await page.locator('#units').filter({hasText:'换一份材料'}).waitFor();
  const plan=await(await fetch(base+'/api/learning/catalog',{headers})).json();const review=plan.plan.reviews.find(r=>r.module==='reading');assert.notEqual(review.unitId,unit.id);const reviewUnit=bank.find(u=>u.id===review.unitId);
  await page.locator('#units').getByRole('button',{name:'开始复习'}).first().click();
  for(const [i,q] of reviewUnit.steps.entries()){
    await page.getByRole('button',{name:q.options[Number(q.answers[0])],exact:true}).click();
    await page.locator('#progress').filter({hasText:`${i+1}/${reviewUnit.steps.length}`}).waitFor();
  }
  await page.getByRole('heading',{name:'本次学习已完成'}).waitFor();await page.getByRole('button',{name:'保存并返回列表'}).click();await page.locator('#units').filter({hasText:'暂无到期复习'}).waitFor();
  const weeklyTasks=Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day=>[day,[{id:'checktask',module:'reading',mode:{type:'reading',learningPhase:'check',learningLevel:1,learningSkill:'信息定位'},targetCount:1}]]));
  const response=await fetch(base+'/api/admin/users/cycleuser/weekly-tasks',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer cycle-admin'},body:JSON.stringify({weeklyTasks})});assert.ok(response.ok);
  await page.goto(base+'/');await page.locator('#titleTaskStrip').filter({hasText:'0/1'}).waitFor();await page.locator('#titleTaskStrip button').click();
  await page.locator('[data-phase="check"].active').waitFor();assert.equal(await page.locator('#levelFilter').inputValue(),'1');assert.equal(await page.locator('#skillFilter').inputValue(),'信息定位');
  await page.locator('#units').getByRole('button',{name:'开始检查'}).first().click();
  const check=checks[0],correctText=check.steps[0].options[Number(check.steps[0].answers[0])];
  const wrong=await page.locator('#options button').allTextContents();await page.getByRole('button',{name:wrong.find(t=>t!==correctText),exact:true}).click();await page.locator('#progress').filter({hasText:'1/3'}).waitFor();
  assert.equal(await page.locator('#hint').isVisible(),false);assert.equal(await page.locator('#demo').isVisible(),false);assert.match(await page.locator('#feedback').innerText(),/结束后统一/);
  await page.reload();await page.locator('#units').getByRole('button',{name:'继续上次练习'}).first().click();await page.locator('#progress').filter({hasText:'1/3'}).waitFor();
  for(let i=1;i<check.steps.length;i++){
    const q=check.steps[i];await page.getByRole('button',{name:q.options[Number(q.answers[0])],exact:true}).click();await page.locator('#progress').filter({hasText:`${i+1}/3`}).waitFor();
  }
  await page.getByRole('heading',{name:'本次学习已完成'}).waitFor();assert.match(await page.locator('#feedback').innerText(),/首次独立答对 2 步/);
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.getByRole('button',{name:'保存并返回列表'}).click();await page.locator('#units').getByRole('button',{name:'回看检查结果'}).first().waitFor();
  if(process.env.UI_SCREENSHOT)await page.screenshot({path:process.env.UI_SCREENSHOT,fullPage:true});
  const final=await(await fetch(base+'/api/learning/catalog',{headers})).json();assert.equal(final.sessions.filter(s=>s.phase==='check').length,1);assert.equal(final.sessions.filter(s=>s.phase==='review').length,1);
  await page.goto(base+'/');await page.locator('#titleTaskStrip').filter({hasText:'今日任务已全部完成'}).waitFor();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({dueReview:'different material completed',check:'no feedback until complete, resumed, cannot repeat',weeklyTask:'phase, level, skill matched',widths:[320,390,768],pageErrors:errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
