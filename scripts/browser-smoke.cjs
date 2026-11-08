// Optional acceptance runner: set PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE_PATH.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learning-acceptance-'));
 const base='http://127.0.0.1:39888';
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,PORT:'39888',DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'acceptance',ADMIN_PASSWORD:'acceptance-admin'},stdio:'ignore'});
 let browser;
 const request=async(url,body,headers={})=>{const res=await fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},body:body?JSON.stringify(body):undefined});assert.ok(res.ok,`${url}: ${res.status}`);return res.json();};
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,40));}
  const a=await request('/api/users',{authCode:'acceptance',password:'123456',user:{identifier:'reader'}});
  await request('/api/users',{authCode:'acceptance',password:'123456',user:{identifier:'other'}});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu','--single-process']});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/health');
  await page.evaluate(user=>localStorage.setItem('schulte.cloudUser.v1',JSON.stringify(user)),{identifier:'reader',sessionToken:a.sessionToken});
  await page.goto(base+'/');await page.getByRole('link',{name:'读懂一段话',exact:true}).click();
  await page.getByRole('button',{name:'开始练习',exact:true}).first().click();
  // Server commits the answer but the client loses its response; retry the same event.
  let lost=true;await page.route('**/api/learning/*/action',async route=>{if(lost){lost=false;await route.fetch();await route.abort();}else await route.continue();});
  await page.getByRole('button',{name:'同桌',exact:true}).click();await page.locator('#notice').filter({hasText:'请重试'}).waitFor();
  await page.getByRole('button',{name:'同桌',exact:true}).click();await page.locator('#progress').filter({hasText:'1/3'}).waitFor();await page.unroute('**/api/learning/*/action');
  await page.reload();await page.getByRole('button',{name:'继续上次练习'}).first().click();await page.locator('#progress').filter({hasText:'1/3'}).waitFor();
  await page.getByRole('button',{name:'小宇',exact:true}).click();await page.getByRole('button',{name:'小宇和同桌共用一把伞，他把伞向同桌那边移。',exact:true}).click();await page.getByRole('heading',{name:'本次学习已完成'}).waitFor();
  assert.match(await page.locator('#feedback').innerText(),/首次独立答对 3 步/);
  await page.getByRole('button',{name:'保存并返回列表'}).click();await page.getByRole('button',{name:'寻找原因',exact:true}).click();await page.getByRole('button',{name:'开始练习',exact:true}).first().click();await page.getByRole('button',{name:'给我一点提示'}).click();await page.locator('#hints').filter({hasText:'回到材料'}).waitFor();
  await page.getByRole('button',{name:'书',exact:true}).click();await page.getByRole('button',{name:'碰书→书掉→积木倒',exact:true}).click();await page.getByRole('button',{name:'小乐碰到了桌边的书。',exact:true}).click();await page.getByRole('heading',{name:'本次学习已完成'}).waitFor();assert.match(await page.locator('#feedback').innerText(),/首次独立答对 2 步/);
  await page.getByRole('button',{name:'保存并返回列表'}).click();await page.getByRole('button',{name:'读懂数学题',exact:true}).click();await page.getByRole('button',{name:'开始练习',exact:true}).first().click();await page.getByRole('button',{name:'小明的贴纸数',exact:true}).click();await page.getByRole('button',{name:'小明＋6＝18',exact:true}).click();await page.getByLabel('我的算式或答案').fill('18-6');await page.getByRole('button',{name:'提交答案'}).click();await page.getByRole('heading',{name:'请计算并写出结果和单位。',exact:true}).waitFor();await page.getByLabel('我的算式或答案').fill('12张');await page.getByRole('button',{name:'提交答案'}).click();await page.getByRole('heading',{name:'本次学习已完成'}).waitFor();
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
  await page.getByRole('button',{name:'保存并返回列表'}).click();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出学习记录'}).click()]);const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.sessions.length,3);
  // Administrator weekly schedule + homepage progress.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
  const weeklyTasks=Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day=>[day,[{id:'reading-task',module:'reading',mode:{type:'reading'},targetCount:1}]]));
  const saved=await fetch(base+'/api/admin/users/reader/weekly-tasks',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer acceptance-admin'},body:JSON.stringify({weeklyTasks})});assert.ok(saved.ok);
  await page.goto(base+'/');await page.locator('#titleTaskStrip').filter({hasText:'今日任务已全部完成'}).waitFor();
  // Legacy training must end before account logout, with cancellation supported.
  for (const mode of ['stroop','idiom','poem','memory','decode','mindfulness','schulte']) await page.locator('.training-button[data-training="'+mode+'"]').click();
  await page.locator('#board .cell').first().click();page.once('dialog',d=>d.dismiss());await page.locator('#userCenterButton').click();await page.locator('#logoutUserButton').click();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('schulte.cloudUser.v1')).identifier==='reader'));
  page.once('dialog',d=>d.accept());await page.locator('#logoutUserButton').click();assert.equal(await page.evaluate(()=>localStorage.getItem('schulte.cloudUser.v1')),null);
  await page.locator('#loadIdentifierInput').fill('other');await page.locator('#loginPasswordInput').fill('123456');await page.locator('#loginUserButton').click();await page.locator('#userCenterNotice').filter({hasText:'密码登录成功'}).waitFor();
  await page.locator('#closeUserCenterButton').click();assert.equal(await page.locator('#countText').innerText(),'--');
  const reader=await request('/api/users/reader/public');assert.ok(reader.records.some(r=>r.interruptionReason==='switched_user'));
  await page.getByRole('link',{name:'读懂一段话',exact:true}).click();await page.locator('#identity').filter({hasText:'other'}).waitFor();assert.equal(await page.locator('#history article').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({threeModules:'passed',resume:'passed',lostResponseRetry:'passed',export:'passed',weeklyProgress:'passed',accountSwitch:'passed',widths:[320,390,768],pageErrors:errors}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
