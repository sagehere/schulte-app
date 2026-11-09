const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('client keeps user sessions out of admin login and preserves explicit admin credentials',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const start=source.indexOf('      async function apiJson('),end=source.indexOf('      function userPayloadFromForm(',start);
 assert.ok(start>=0&&end>start);
 const requests=[],fetch=async(url,options)=>{requests.push({url,...options});return {ok:true,text:async()=>'{"ok":true}'};};
 const apiJson=new Function('fetch','cloudUser',source.slice(start,end)+';return apiJson;')(fetch,{sessionToken:'user-session'});
 await apiJson('/api/users/reader');
 await apiJson('/api/admin/verify',{method:'POST',body:JSON.stringify({password:'existing-admin'})});
 await apiJson('/api/admin/users',{headers:{Authorization:'Bearer existing-admin'}});
 assert.equal(requests[0].headers.Authorization,'Bearer user-session');
 assert.equal(requests[1].headers.Authorization,undefined);
 assert.deepEqual(JSON.parse(requests[1].body),{password:'existing-admin'});
 assert.equal(requests[2].headers.Authorization,'Bearer existing-admin');
});

async function server(t,password,offset=0){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'admin-auth-')),port=43000+process.pid%500+offset,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['src/index.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DB_PATH:path.join(dir,'db'),USER_CREATE_CODE:'code',ADMIN_PASSWORD:password},stdio:'ignore'});
 t.after(async()=>{await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();});fs.rmSync(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('server exited');try{if((await fetch(base+'/health')).ok)return base;}catch{}await new Promise(r=>setTimeout(r,30));}throw Error('server did not start');
}

test('admin verification uses the submitted password even with a logged-in user bearer',async(t)=>{
 const base=await server(t,'existing-admin');
 const response=await fetch(base+'/api/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authCode:'code',password:'123456',user:{identifier:'adminRegression'}})});
 assert.equal(response.status,200);const {sessionToken}=await response.json();assert.ok(sessionToken);
 const verify=(password,token)=>fetch(base+'/api/admin/verify',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({password})});
 assert.equal((await verify('existing-admin')).status,200);
 assert.equal((await verify('existing-admin',sessionToken)).status,200,'cached page may still attach an ordinary session');
 assert.equal((await verify('wrong',sessionToken)).status,403);
 assert.equal((await verify('wrong','existing-admin')).status,403,'valid header cannot make an incorrect login password pass');
 assert.equal((await verify(undefined)).status,400);
 assert.equal((await verify({value:'existing-admin'})).status,400);
 const users=token=>fetch(base+'/api/admin/users',{headers:{authorization:'Bearer '+token}});
 assert.equal((await users(sessionToken)).status,403,'successful verification does not grant the user session admin rights');
 assert.equal((await users('existing-admin')).status,200);
});

test('unset admin password never allows login',async(t)=>{
 const base=await server(t,'',1);
 const response=await fetch(base+'/api/admin/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'existing-admin'})});
 assert.equal(response.status,403);
});
