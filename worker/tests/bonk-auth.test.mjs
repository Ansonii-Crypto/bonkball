import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const origin='https://bonk-critic.com';
function environment(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const prepare=sql=>({bind(...args){const statement=db.prepare(sql);return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}}},async all(){return {results:db.prepare(sql).all()}}});
 return {db,ALLOWED_ORIGIN:origin,PRIMARY_BONK_ID:'100',API_RATE_LIMITER:{async limit(){return {success:true}}},LOGIN_RATE_LIMITER:{async limit(){return {success:true}}},DB:{prepare,async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}}};
}
function request(env,path,body=null,{user,admin,headers={},method}={}){
 return worker.fetch(new Request('https://api.test'+path,{method:method||(body?'POST':'GET'),headers:{Origin:origin,'Content-Type':'application/json',...(user?{'X-Account-Session':user}:{}),...(admin?{Authorization:'Bearer '+admin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
}
async function withProvider(callback){
 const original=globalThis.fetch;let next={r:'success',id:100,username:'Verified',token:'bonk-secret'};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://bonk2.io/scripts/login_legacy.php');assert.equal(options.redirect,'manual');
  assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded; charset=UTF-8');
  assert.equal(options.headers.Origin,'https://bonk.io');
  assert.equal(options.headers.Referer,'https://bonk.io/');
  assert.equal(options.headers.Authorization,undefined);
  assert.equal(options.headers.Cookie,undefined);
  assert.equal(options.headers['X-Account-Session'],undefined);
  const body=new URLSearchParams(options.body);assert.equal(body.get('remember'),'false');
  return Response.json(next);
 };
 try{await callback(value=>{next=value})}finally{globalThis.fetch=original}
}
async function signIn(env,options={}){
 const response=await request(env,'/api/bonk/login',{username:'typed-name',password:'test-only',...options});
 const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));
 assert.equal(body.user.username,'Verified');assert.equal(JSON.stringify(body).includes('bonk-secret'),false);
 return body.account_session_token;
}
async function seedCode(env,id,code='123456'){
 const salt='test-salt',key=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveBits']);
 const digest=Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256)).toString('hex');
 env.db.prepare('INSERT INTO admin_credentials(account_id,salt,code_hash) VALUES(?,?,?)').run(id,salt,digest);
}
async function unlock(env,user,id='primary-zimble'){
 const response=await request(env,'/api/login',{account_id:id,code:'123456'},{user});
 const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body.session_token;
}

test('server trusts only Bonk HTTPS response; rejects wrong passwords, missing IDs and forged browser roles',async()=>withProvider(async set=>{
 const env=environment();
 set({r:'fail',e:'password'});assert.equal((await request(env,'/api/bonk/login',{username:'demo',password:'wrong'})).status,401);
 assert.equal(env.db.prepare('SELECT COUNT(*) n FROM user_sessions').get().n,0);
 set({r:'success',token:'secret',username:'Verified'});assert.equal((await request(env,'/api/bonk/login',{username:'demo',password:'test-only',id:100})).status,502);
 set({r:'success',id:200,username:'Verified',token:'bonk-secret'});
 const user=await signIn(env,{id:100,account_id:'primary-zimble',is_primary:true});
 const state=await (await request(env,'/api/session',null,{user})).json();
 assert.equal(state.user.id,'200');assert.equal(state.admin_account,null);assert.equal(state.authenticated,false);
 assert.equal((await request(env,'/api/login',{account_id:'primary-zimble',code:'123456'},{user})).status,403);
 assert.equal((await request(env,'/api/accounts',null,{user})).status,403);
 assert.equal((await request(env,'/api/players',{name:'fake'},{user})).status,401);
 env.db.close();
}));

test('provider failures are not misreported as proof of an incorrect password',async()=>withProvider(async set=>{
 const env=environment();
 try{
  for(const data of [null,[],{}, {message:'provider unavailable'}, {r:'success',id:100,username:'Verified'}, {r:'success',token:'   ',id:100,username:'Verified'}]){
   set(data);const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});
   assert.equal(response.status,502);assert.doesNotMatch((await response.json()).error,/username and password/);
  }
  set({r:'error',message:'private provider details'});
  const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});
  assert.equal(response.status,502);const body=await response.json();
  assert.equal(body.error,'Bonk sign-in is temporarily unavailable. Please try again shortly.');
  assert.equal(JSON.stringify(body).includes('private provider details'),false);
  assert.equal(env.db.prepare('SELECT COUNT(*) n FROM user_sessions').get().n,0);
 }finally{env.db.close()}
}));

test('admin elevation requires the correct Bonk identity and code, and expires independently',async()=>withProvider(async()=>{
 const env=environment();await seedCode(env,'primary-zimble');const user=await signIn(env);
 let state=await (await request(env,'/api/session',null,{user})).json();
 assert.equal(state.authenticated,false);assert.equal(state.admin_account.id,'primary-zimble');
 assert.equal((await request(env,'/api/login',{account_id:'primary-zimble',code:'123456'})).status,401);
 assert.equal((await request(env,'/api/login',{account_id:'primary-zimble',code:'000000'},{user})).status,401);
 const admin=await unlock(env,user);
 assert.equal((await (await request(env,'/api/session',null,{user,admin})).json()).authenticated,true);
 assert.equal((await request(env,'/api/accounts',null,{admin})).status,403);
 env.db.prepare('UPDATE admin_sessions SET expires_at=?').run(Date.now()-1);
 state=await (await request(env,'/api/session',null,{user,admin})).json();assert.equal(state.authenticated,false);assert.equal(state.user.id,'100');
 env.db.close();
}));

test('secondary admins can view accounts but cannot create, invite, reset, link or delete',async()=>withProvider(async set=>{
 const env=environment();env.db.exec("INSERT INTO admin_accounts VALUES('secondary','Secondary',0);INSERT INTO admin_bonk_links VALUES('secondary','200')");await seedCode(env,'secondary');
 set({r:'success',id:200,username:'Verified',token:'bonk-secret'});const user=await signIn(env),admin=await unlock(env,user,'secondary');
 assert.equal((await request(env,'/api/accounts',null,{user,admin})).status,200);
 for(const [path,body,method] of [
  ['/api/accounts',{name:'Other',bonk_id:'300'}],['/api/accounts/invite',{account_id:'secondary'}],
  ['/api/accounts/reset-code',{account_id:'secondary'}],['/api/accounts/link',{account_id:'secondary',bonk_id:'300'}],
  ['/api/accounts/secondary',{},'DELETE']
 ])assert.equal((await request(env,path,body,{user,admin,method})).status,403,path);
 env.db.close();
}));

test('invitations are account-bound, single-use, and never exposed to other admins',async()=>withProvider(async set=>{
 const env=environment();await seedCode(env,'primary-zimble');const primary=await signIn(env),admin=await unlock(env,primary);
 const creation=await request(env,'/api/accounts',{name:'New admin',bonk_id:'300'},{user:primary,admin});assert.equal(creation.status,201);
 const invite=await creation.json(),account=env.db.prepare("SELECT id FROM admin_accounts WHERE name='New admin'").get();
 assert.equal((await request(env,'/api/login',{account_id:account.id,code:invite.invitation,new_code:'123456',confirm_code:'123456'},{user:primary})).status,403);
 set({r:'success',id:300,username:'Verified',token:'bonk-secret'});const user=await signIn(env);
 assert.equal((await request(env,'/api/login',{account_id:account.id,code:invite.invitation,new_code:'123456',confirm_code:'123456'},{user})).status,200);
 assert.equal((await request(env,'/api/login',{account_id:account.id,code:invite.invitation},{user})).status,401);
 const secondaryAdmin=await unlock(env,user,account.id),list=await (await request(env,'/api/accounts',null,{user,admin:secondaryAdmin})).json();
 assert.ok(list.accounts.every(account=>!('invitation' in account)));
 env.db.close();
}));

test('logout, re-login, and switching identities invalidate the old elevated session',async()=>withProvider(async set=>{
 const env=environment();await seedCode(env,'primary-zimble');const user=await signIn(env),admin=await unlock(env,user);
 const anotherSession=await signIn(env);assert.equal((await request(env,'/api/accounts',null,{user:anotherSession,admin})).status,403);
 assert.equal((await request(env,'/api/bonk/logout',{}, {user})).status,200);
 assert.equal((await (await request(env,'/api/session',null,{user,admin})).json()).user,null);
 const nextAdmin=await unlock(env,anotherSession);set({r:'success',id:200,username:'Verified',token:'bonk-secret'});
 const switched=await request(env,'/api/bonk/login',{username:'other',password:'test-only'},{user:anotherSession});assert.equal(switched.status,200);
 const newToken=(await switched.json()).account_session_token;
 assert.equal((await request(env,'/api/accounts',null,{user:newToken,admin:nextAdmin})).status,403);
 assert.equal((await (await request(env,'/api/session',null,{user:anotherSession})).json()).user,null);
 env.db.close();
}));

test('origin checks and account login throttling fail before provider authentication',async()=>withProvider(async()=>{
 const env=environment();
 assert.equal((await request(env,'/api/bonk/login',{username:'demo',password:'test-only'},{headers:{Origin:'https://evil.test'}})).status,403);
 for(let i=0;i<10;i++)assert.equal((await request(env,'/api/bonk/login',{username:'demo',password:'test-only'})).status,200);
 assert.equal((await request(env,'/api/bonk/login',{username:'demo',password:'test-only'})).status,429);
 env.db.close();
}));


test('provider header compatibility does not allow Bonk or other sites to call our login API',async()=>{
 const env=environment(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Untrusted request reached provider')};
 try{
  for(const Origin of ['https://bonk.io','https://evil.test']){
   const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'},{headers:{Origin}});
   assert.equal(response.status,403);assert.equal((await response.json()).error,'Untrusted request origin.');
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;env.db.close()}
});

test('Bonk redirects fail closed without following or forwarding credentials',async()=>{
 const env=environment(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://bonk2.io/scripts/login_legacy.php');assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://example.com/other'}})};
 try{const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});assert.equal(response.status,502);assert.equal((await response.json()).error,'Bonk sign-in is temporarily unavailable. Please try again shortly.');assert.equal(calls,1);assert.equal(env.db.prepare('SELECT COUNT(*) n FROM user_sessions').get().n,0)}finally{globalThis.fetch=original;env.db.close()}
});


test('active avatar comes only from the verified login response and persists across session refresh',async()=>withProvider(async set=>{
 const env=environment();
 set({r:'success',id:100,username:'Verified',token:'bonk-secret',activeAvatarNumber:3,avatar1:'other-skin',avatar3:'active-skin'});
 const user=await signIn(env,{avatar_code:'browser-forgery',activeAvatarNumber:1});
 let state=await (await request(env,'/api/session',null,{user})).json();assert.equal(state.user.avatar_code,'active-skin');
 assert.equal(env.db.prepare('SELECT skin_code FROM bonk_account_avatars').get().skin_code,'active-skin');
 set({r:'success',id:100,username:'Verified',token:'bonk-secret',activeAvatarNumber:0,avatar1:'first-slot'});
 const next=await signIn(env);state=await (await request(env,'/api/session',null,{user:next})).json();assert.equal(state.user.avatar_code,'first-slot');
 set({r:'success',id:100,username:'Verified',token:'bonk-secret',activeAvatarNumber:99,avatar1:'not-selected'});
 const fallback=await signIn(env);state=await (await request(env,'/api/session',null,{user:fallback})).json();assert.equal(state.user.avatar_code,null);
 env.db.close();
}));

test('public author profiles show only public identity even without assessments',async()=>withProvider(async()=>{
 const env=environment();
 try{
  await signIn(env);
  const response=await request(env,'/api/public-profile?username=verified');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{profile:{username:'Verified',avatar_code:null},player_id:null});
  assert.equal((await request(env,'/api/public-profile?username=missing')).status,404);
 }finally{env.db.close()}
}));

test('login preserves password whitespace, Unicode and form-sensitive characters',async()=>{
 const env=environment(),original=globalThis.fetch;
 const password='  p+&=%?#é??  ';
 globalThis.fetch=async(_url,options)=>{
  const body=new URLSearchParams(String(options.body));
  assert.equal(body.get('username'),'Alt + Name');
  assert.equal(body.get('password'),password);
  return Response.json({r:'success',id:200,username:'Alt + Name',token:'test-provider-token'});
 };
 try{
  const response=await request(env,'/api/bonk/login',{username:' Alt + Name ',password});
  assert.equal(response.status,200);
  assert.equal((await response.json()).user.username,'Alt + Name');
 }finally{globalThis.fetch=original;env.db.close()}
});

test('login errors are concise and never expose provider diagnostics or account existence',async()=>withProvider(async set=>{
 const env=environment();
 try{
  for(const reason of ['username','password']){
   set({r:'fail',e:reason,message:'private details',token:'private-token',username:'private-user'});
   const response=await request(env,'/api/bonk/login',{username:'demo',password:'private-password'});
   assert.equal(response.status,401);
   assert.deepEqual(await response.json(),{error:'Unable to sign in. Check your Bonk username and password.'});
  }
  for(const data of [{r:'error'},{r:'fail',e:'private details'},{r:'fail',e:{password:'private-password'}},{r:'unexpected-provider-code'}]){
   set(data);const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});
   assert.equal(response.status,502);
   assert.deepEqual(await response.json(),{error:'Bonk sign-in is temporarily unavailable. Please try again shortly.'});
  }
  assert.equal(env.db.prepare('SELECT COUNT(*) n FROM user_sessions').get().n,0);
 }finally{env.db.close()}
}));

test('connection, empty and malformed responses use a friendly outage message; rate limits ask users to wait',async()=>{
 const env=environment(),original=globalThis.fetch;
 try{
  const failures=[()=>{throw Error('private network details')},()=>new Response(null,{status:204}),()=>new Response('private upstream text',{status:503}),()=>new Response('not JSON',{status:200})];
  for(const failure of failures){
   globalThis.fetch=async()=>failure();
   const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});
   assert.equal(response.status,502);
   assert.deepEqual(await response.json(),{error:'Bonk sign-in is temporarily unavailable. Please try again shortly.'});
  }
  globalThis.fetch=async()=>new Response(null,{status:429});
  const response=await request(env,'/api/bonk/login',{username:'demo',password:'test-only'});
  assert.equal(response.status,429);
  assert.deepEqual(await response.json(),{error:'Too many sign-in attempts. Please wait a moment and try again.'});
 }finally{globalThis.fetch=original;env.db.close()}
});

test('invalid credential encoding prompts re-entry without sending modified credentials',async()=>{
 const env=environment(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Modified credentials must not reach provider')};
 try{
  const response=await request(env,'/api/bonk/login',{username:'demo',password:'bad\uD800'});
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'Please re-enter your Bonk username and password.'});
  assert.equal(calls,0);
  assert.equal(env.db.prepare('SELECT COUNT(*) n FROM user_sessions').get().n,0);
 }finally{globalThis.fetch=original;env.db.close()}
});
