import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;

function environment() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const prepare = sql => ({
    bind(...args) {
      const statement = db.prepare(sql);
      return {
        async first() { return statement.get(...args) || null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; }
      };
    },
    async all() { return { results: db.prepare(sql).all() }; }
  });
  return { db, API_RATE_LIMITER:{async limit(){return {success:true}}}, LOGIN_RATE_LIMITER:{async limit(){return {success:true}}}, DB: { prepare, async batch(statements) {
    db.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } }, ALLOWED_ORIGIN: 'https://bonk-critic.com', ADMIN_CODE: '654321' };
}

test('invitation setup immediately saves personal code and consumes invitation', async () => {
  const env = environment();
  env.db.exec("INSERT INTO admin_accounts VALUES('test','Test',0); INSERT INTO admin_credentials(account_id,invitation_hash) VALUES('test','placeholder');");
  env.db.prepare('INSERT INTO admin_invitations VALUES(?,?,?)').run('test','test-invite',Date.now()+600000);
  const login = async body => worker.fetch(new Request('https://api.test/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:'test',...body})}),env);
  assert.deepEqual(await (await login({code:'test-invite'})).json(), {setup_required:true});
  const response = await login({code:'test-invite',new_code:'123456',confirm_code:'123456'});
  assert.equal(response.status,200);
  assert.equal((await response.json()).ok,true);
  assert.ok(env.db.prepare("SELECT code_hash FROM admin_credentials WHERE account_id='test'").get().code_hash);
  assert.equal(env.db.prepare("SELECT * FROM admin_invitations WHERE account_id='test'").get(),undefined);
  assert.equal((await login({code:'123456'})).status,200);
  assert.equal((await login({code:'test-invite'})).status,401);
  env.db.close();
});

for (const state of ['missing','expired','wrong']) test(`setup rejects ${state} invitation and default code`,async()=>{
  const env=environment();
  env.db.exec("INSERT INTO admin_accounts VALUES('test','Test',0)");
  if(state!=='missing')env.db.prepare('INSERT INTO admin_invitations VALUES(?,?,?)').run('test','valid-token',Date.now()+(state==='expired'?-1000:600000));
  for(const code of [env.ADMIN_CODE,state==='wrong'?'wrong-token':'valid-token']){
    const response=await worker.fetch(new Request('https://api.test/api/login',{method:'POST',body:JSON.stringify({account_id:'test',code,new_code:'123456',confirm_code:'123456'})}),env);
    assert.equal(response.status,401);
  }
  assert.equal(env.db.prepare('SELECT COUNT(*) AS count FROM admin_credentials').get().count,0);
  env.db.close();
});

test('limits reject before database access and include retry and CORS headers',async()=>{
  for(const binding of ['API_RATE_LIMITER','LOGIN_RATE_LIMITER']){
    const env={ALLOWED_ORIGIN:'https://bonk-critic.com',API_RATE_LIMITER:{async limit(){return {success:true}}},LOGIN_RATE_LIMITER:{async limit(){return {success:true}}},DB:{prepare(){throw Error('Database should not be reached')}}};
    env[binding]={async limit({key}){assert.ok(key.endsWith('203.0.113.1'));return {success:false}}};
    const response=await worker.fetch(new Request('https://api.test/api/login',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'CF-Connecting-IP':'203.0.113.1'}}),env);
    assert.equal(response.status,429);
    assert.equal(response.headers.get('Retry-After'),'60');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
  }
});

test('missing limiter bindings fail closed',async()=>{
  const response=await worker.fetch(new Request('https://api.test/api/players'),{});
  assert.equal(response.status,503);
});

test('shared drafts stay private, enforce ownership and revisions, and publish once',async()=>{
  const env=environment();
  for(const id of ['author','viewer']){
    env.db.prepare('INSERT INTO admin_accounts VALUES(?,?,0)').run(id,id);
    env.db.prepare('INSERT INTO admin_credentials(account_id,code_hash) VALUES(?,?)').run(id,'test-only');
    const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+'-token'))).toString('hex');
    env.db.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(digest,Date.now()+600000,id);
  }
  const request=(path,method='GET',body=null,user='author')=>worker.fetch(new Request('https://api.test'+path,{method,headers:user?{Authorization:'Bearer '+user+'-token'}:{},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.equal((await request('/api/player-drafts','GET',null,null)).status,401);
  const created=await request('/api/player-drafts','POST',{data:{name:'Draft player',control:'123'}});
  assert.equal(created.status,201);
  const {id,revision}=await created.json();
  const list=await (await request('/api/player-drafts','GET',null,'viewer')).json();
  assert.equal(list.drafts.length,1);
  assert.equal(list.drafts[0].owner_name,'author');
  assert.equal((await (await request('/api/players')).json()).players.length,0);
  assert.equal((await request('/api/player-drafts/'+id,'PUT',{data:{name:'Overwrite'},revision},'viewer')).status,403);
  assert.equal((await request('/api/player-drafts/'+id+'/push','POST',{revision},'viewer')).status,403);
  assert.equal((await request('/api/player-drafts/'+id+'/push','POST',{revision})).status,400);
  const data={name:'Draft player',overall_tier:'A',assessed_at:'2026-10-16',control:123,execution:200,defending:200,reaction_time:200,chemistry:200,game_sense:200,class_name:'Renegade'};
  assert.equal((await request('/api/player-drafts/'+id,'PUT',{data,revision})).status,200);
  assert.equal((await request('/api/player-drafts/'+id,'PUT',{data:{name:'Stale'},revision})).status,409);
  assert.equal((await request('/api/player-drafts/'+id+'/push','POST',{revision})).status,409);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM players').get().n,0);
  assert.equal((await request('/api/player-drafts/'+id+'/push','POST',{revision:2})).status,201);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM player_drafts').get().n,0);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM players').get().n,1);
  assert.equal(env.db.prepare('SELECT total FROM assessments').get().total,1123);
  assert.equal((await request('/api/player-drafts/'+id+'/push','POST',{revision:2})).status,404);
  env.db.close();
});
