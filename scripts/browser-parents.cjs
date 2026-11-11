const fixtureBirthDate=require('./age-fixture.cjs')(12);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'parents-ui-')),base='http://127.0.0.1:39890';
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:'39890',DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code',ADMIN_PASSWORD:'parent-admin'},stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
  async function call(url,body,headers={}){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});assert.ok(r.ok);return r.json();}
  const a=await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'family',birthDate:fixtureBirthDate}}),b=await call('/api/users',{authCode:'code',password:'123456',user:{identifier:'otherchild',birthDate:fixtureBirthDate}});
  const headers={'x-user-id':'family',authorization:'Bearer '+a.sessionToken},unit=require('../src/content/learning.json')[0];
  let s=(await call('/api/learning/start',{unitId:unit.id,id:'parent-ui-session'},headers)).session;
  await call('/api/learning/'+s.id+'/action',{index:0,kind:'answer',answer:'0',eventId:'wrong'},headers);
  for(const [i,q] of unit.steps.entries())s=(await call('/api/learning/'+s.id+'/action',{index:i,kind:'answer',answer:q.answers[0],eventId:'right'+i,elapsedMs:60000},headers)).session;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu','--single-process']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/health');await page.evaluate(token=>localStorage.setItem('schulte.cloudUser.v1',JSON.stringify({identifier:'family',sessionToken:token})),a.sessionToken);
  await page.goto(base+'/learning');await page.getByRole('link',{name:'家长报告与观察'}).click();await page.locator('#report').waitFor();await page.locator('#evidence').getByRole('button',{name:'为这次作答记录观察'}).first().click();
  assert.match(await page.locator('#association').innerText(),/第1步/);await page.getByLabel('需要朗读',{exact:true}).check();await page.locator('#note').fill('先朗读后能说明人物关系，纸面迁移还需观察。');await page.getByRole('button',{name:'保存观察',exact:true}).click();await page.locator('#observations article').filter({hasText:'先朗读后'}).waitFor();
  await page.locator('#observations').getByRole('button',{name:'编辑观察'}).click();await page.locator('#note').fill('=SUM(1,2)\n已能自己解释。');await page.getByRole('button',{name:'保存观察',exact:true}).click();await page.locator('#observations article').filter({hasText:'已能自己解释'}).waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出观察 CSV'}).click()]);const csv=fs.readFileSync(await download.path(),'utf8');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=SUM(1,2)"));
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'parent overflow '+width);}
  if(process.env.UI_SCREENSHOT)await page.screenshot({path:process.env.UI_SCREENSHOT,fullPage:true});
  await page.reload();await page.locator('#observations article').filter({hasText:'已能自己解释'}).waitFor();
  await page.locator('#access summary').click();await page.locator('#owner').fill('otherchild');await page.getByRole('button',{name:'载入该用户'}).click();await page.locator('#parentNotice').filter({hasText:'确认首页已登录'}).waitFor();assert.equal(await page.locator('#report').isVisible(),false);
  await page.locator('#owner').fill('family');await page.locator('#adminPassword').fill('parent-admin');await page.getByRole('button',{name:'载入该用户'}).click();await page.locator('#observations article').filter({hasText:'已能自己解释'}).waitFor();assert.equal(await page.locator('#adminPassword').inputValue(),'');
  page.once('dialog',d=>d.accept());await page.locator('#observations').getByRole('button',{name:'删除观察'}).click();await page.locator('#parentNotice').filter({hasText:'观察已删除'}).waitFor();assert.equal(await page.locator('#observations article').count(),0);
  await page.goto(base+'/learning?phase=check&module=reading&level=1');await page.locator('#units button').first().click();await page.locator('#practice').waitFor();
  const feedbackHref=await page.locator('#feedbackLink').getAttribute('href');assert.match(feedbackHref,/step=0/);
  const [feedbackPage]=await Promise.all([page.waitForEvent('popup'),page.locator('#feedbackLink').click()]);
  feedbackPage.on('pageerror',e=>errors.push(e.message));await feedbackPage.locator('#association').filter({hasText:'版本'}).waitFor();assert.match(await feedbackPage.locator('#association').innerText(),/第1步/);assert.equal(await feedbackPage.locator('#observationModule').isDisabled(),true);
  await feedbackPage.getByLabel('题意不清',{exact:true}).check();await feedbackPage.locator('#note').fill('题目句子没有读明白，请复核表达。');await feedbackPage.getByRole('button',{name:'保存观察',exact:true}).click();await feedbackPage.locator('#observations article').filter({hasText:'请复核表达'}).waitFor();
  await feedbackPage.locator('#familyTrial summary').click();assert.equal(await feedbackPage.locator('#trialDays li').count(),14);
  await feedbackPage.locator('#trialStart').fill('2028-02-27');await feedbackPage.locator('#trialStart').dispatchEvent('change');assert.match(await feedbackPage.locator('#trialDays li').last().innerText(),/2028-03-11/);
  await feedbackPage.locator('#trialRange').click();assert.match(await feedbackPage.locator('#trialNotice').innerText(),/尚未开始/);
  const trialToday=await feedbackPage.locator('#to').inputValue();await feedbackPage.locator('#trialStart').fill(trialToday);await feedbackPage.locator('#trialStart').dispatchEvent('change');await feedbackPage.locator('#trialRange').click();await feedbackPage.locator('#rangeTitle').filter({hasText:trialToday+' 至 '+trialToday}).waitFor();
  const [bundleDownload]=await Promise.all([feedbackPage.waitForEvent('download'),feedbackPage.getByRole('button',{name:'导出试用数据包'}).click()]);const bundle=JSON.parse(fs.readFileSync(await bundleDownload.path(),'utf8'));assert.match(bundleDownload.suggestedFilename(),/schulte-trial-.*\.json/);assert.equal(bundle.kind,'family-trial');assert.ok(bundle.feedback.some(o=>o.tags.includes('题意不清')&&o.material.version));assert.equal(bundle.sessions.find(s=>s.phase==='check').unit,undefined);
  for(const width of [320,390,768]){await feedbackPage.setViewportSize({width,height:844});assert.equal(await feedbackPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'trial overflow '+width);}
  const startDay=new Date(trialToday+'T12:00:00Z');startDay.setUTCDate(startDay.getUTCDate()-2);const savedStart=startDay.toISOString().slice(0,10);await feedbackPage.locator('#trialStart').fill(savedStart);await feedbackPage.locator('#trialStart').dispatchEvent('change');
  await feedbackPage.reload();await feedbackPage.locator('#report').waitFor();assert.equal(await feedbackPage.locator('#trialStart').inputValue(),savedStart);
  await feedbackPage.locator('#access summary').click();await feedbackPage.locator('#owner').fill('otherchild');await feedbackPage.locator('#adminPassword').fill('parent-admin');await feedbackPage.getByRole('button',{name:'载入该用户'}).click();await feedbackPage.locator('#rangeTitle').filter({hasText:'otherchild'}).waitFor();assert.equal(await feedbackPage.locator('#trialStart').inputValue(),trialToday);assert.match(await feedbackPage.locator('#parentNotice').innerText(),/反馈关联失败/);
  await feedbackPage.locator('#owner').fill('family');await feedbackPage.locator('#adminPassword').fill('parent-admin');await feedbackPage.getByRole('button',{name:'载入该用户'}).click();await feedbackPage.locator('#association').filter({hasText:'版本'}).waitFor();assert.equal(await feedbackPage.locator('#trialStart').inputValue(),savedStart);await feedbackPage.close();
  await page.goto(base+'/learning?module=reading&level=3');await page.locator('#levelFilter').selectOption('3');assert.equal(await page.locator('#units article').count(),10);
  const anon=await browser.newPage();await anon.goto(base+'/health');await anon.evaluate(()=>localStorage.clear());await anon.goto(base+'/parents');await anon.locator('#parentNotice').filter({hasText:'先在首页登录'}).waitFor();assert.equal(await anon.locator('#report').isVisible(),false);await anon.close();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({parentReport:'passed',observationCreateEditDelete:'passed',csvDownload:'passed',linkedFeedback:'passed',trialCalendar:'passed',trialBundle:'passed',authorization:'passed',transferUnits:10,widths:[320,390,768],pageErrors:errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
