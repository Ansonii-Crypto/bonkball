import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const origin='https://bonk-critic.com',hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
async function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const prepare=sql=>({bind(...args){const statement=db.prepare(sql);return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}}},async all(){return {results:db.prepare(sql).all()}}});
 const env={db,ALLOWED_ORIGIN:origin,API_RATE_LIMITER:{async limit(){return {success:true}}},LOGIN_RATE_LIMITER:{async limit(){return {success:true}}},DB:{prepare,async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}}};
 const users={};
 for(const [id,name] of [['1','Author'],['2','Other'],['3','Moderator']]){
  const token=crypto.randomUUID()+crypto.randomUUID();users[id]=token;
  db.prepare('INSERT INTO bonk_users VALUES(?,?,?)').run(id,name,new Date().toISOString());
  db.prepare('INSERT INTO user_sessions VALUES(?,?,?)').run(await hash(token),id,Date.now()+600000);
 }
 for(const id of ['p','q'])db.prepare('INSERT INTO players(id,name,assessed_at,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,id,'2026-10-28','2026-10-28','2026-10-28');
 db.exec("INSERT INTO assessments(id,player_id,assessed_at,overall_tier,control,execution,defending,reaction_time,chemistry,game_sense,total) VALUES(1,'p','2026-10-28','F',0,0,0,0,0,0,0),(2,'q','2026-10-28','F',0,0,0,0,0,0,0)");
 const admin=crypto.randomUUID()+crypto.randomUUID();
 db.exec("INSERT INTO admin_accounts VALUES('mod','Moderator',0);INSERT INTO admin_bonk_links VALUES('mod','3');INSERT INTO admin_credentials(account_id,code_hash) VALUES('mod','test-only')");
 db.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(await hash(admin),Date.now()+600000,'mod');
 db.prepare('INSERT INTO admin_session_identity VALUES(?,?)').run(await hash(admin),await hash(users['3']));
 function request(path,{user,body,method,admin:adminToken,headers={}}={}){
  return worker.fetch(new Request('https://api.test'+path,{method:method||(body?'POST':'GET'),headers:{Origin:origin,'Content-Type':'application/json',...(user?{'X-Account-Session':users[user]}:{}),...(adminToken?{Authorization:'Bearer '+adminToken}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
 }
 return {db,users,admin,request,env};
}
test('threads are public to read, require Bonk to post, and derive authors on the server',async()=>{
 const {db,request}=await setup();
 assert.equal((await request('/api/players/p/comments',{body:{body:'Anonymous'}})).status,401);
 const posted=await request('/api/players/p/comments',{user:'1',body:{body:'  Hello <script>alert(1)</script>  ',author_bonk_id:'2',author_name:'Fake'}});assert.equal(posted.status,201);
 const publicPage=await (await request('/api/players/p/comments')).json();assert.equal(publicPage.can_post,false);assert.equal(publicPage.comments[0].author_name,'Author');assert.equal(publicPage.comments[0].body,'Hello <script>alert(1)</script>');assert.equal(publicPage.comments[0].can_delete,false);assert.equal('author_bonk_id' in publicPage.comments[0],false);
 const ownPage=await (await request('/api/players/p/comments',{user:'1'})).json();assert.equal(ownPage.comments[0].can_delete,true);assert.equal(ownPage.viewer.username,'Author');
 db.close();
});
test('profile and assessment comments stay separate and targets are validated',async()=>{
 const {db,request}=await setup();
 for(const [path,text] of [['/api/players/p/comments','Profile'],['/api/players/p/assessments/1/comments','Assessment']])assert.equal((await request(path,{user:'1',body:{body:text}})).status,201);
 assert.equal((await (await request('/api/players/p/comments')).json()).comments[0].body,'Profile');
 assert.equal((await (await request('/api/players/p/assessments/1/comments')).json()).comments[0].body,'Assessment');
 for(const path of ['/api/players/missing/comments','/api/players/p/assessments/2/comments','/api/players/p/assessments/99/comments'])assert.equal((await request(path,{user:'1',body:{body:'Wrong target'}})).status,404);
 for(const body of ['', '  ', 'a'.repeat(2001),123])assert.equal((await request('/api/players/p/comments',{user:'1',body:{body}})).status,400);
 db.close();
});
test('only authors or an unlocked administrator may delete comments',async()=>{
 const {db,request,admin}=await setup();
 const first=await (await request('/api/players/p/comments',{user:'1',body:{body:'First'}})).json(),path='/api/comments/'+first.id;
 assert.equal((await request(path,{method:'DELETE'})).status,401);
 assert.equal((await request(path,{method:'DELETE',user:'2',body:{is_admin:true}})).status,403);
 assert.equal((await request(path,{method:'DELETE',user:'3'})).status,403);
 assert.equal((await request(path,{method:'DELETE',user:'2',admin})).status,403);
 assert.equal((await request(path,{method:'DELETE',user:'3',admin})).status,200);
 const second=await (await request('/api/players/p/comments',{user:'1',body:{body:'Second'}})).json();
 assert.equal((await request('/api/comments/'+second.id,{method:'DELETE',user:'1'})).status,200);
 db.close();
});
test('posting is rate limited even when the author deletes their comments',async()=>{
 const {db,request}=await setup();
 for(let i=0;i<5;i++){const response=await request('/api/players/p/comments',{user:'1',body:{body:'Comment'}});assert.equal(response.status,201);const {id}=await response.json();assert.equal((await request('/api/comments/'+id,{user:'1',method:'DELETE'})).status,200)}
 assert.equal((await request('/api/players/p/comments',{user:'1',body:{body:'Too many'}})).status,429);
 assert.equal((await request('/api/players/p/comments',{user:'2',body:{body:'Independent limit'}})).status,201);
 db.close();
});
test('pagination is bounded, stable, and deletion cascades with its target',async()=>{
 const {db,request}=await setup();
 for(let i=0;i<25;i++)db.prepare('INSERT INTO comments(player_id,author_bonk_id,body,created_at) VALUES(?,?,?,?)').run('p','1','Comment '+i,'2026-10-28');
 db.exec("INSERT INTO comments(player_id,assessment_id,author_bonk_id,body,created_at) VALUES('p',1,'1','Assessment','2026-10-28')");
 const first=await (await request('/api/players/p/comments')).json();assert.equal(first.comments.length,20);assert.equal(first.comments[0].body,'Comment 24');
 const second=await (await request('/api/players/p/comments?before='+first.next_cursor)).json();assert.equal(second.comments.length,5);assert.equal(second.next_cursor,null);assert.equal(second.comments[0].body,'Comment 4');
 assert.equal((await request('/api/players/p/comments?before=nope')).status,400);
 db.exec('DELETE FROM assessments WHERE id=1');assert.equal(db.prepare('SELECT COUNT(*) n FROM comments WHERE assessment_id IS NOT NULL').get().n,0);
 db.exec("DELETE FROM players WHERE id='p'");assert.equal(db.prepare('SELECT COUNT(*) n FROM comments').get().n,0);
 db.close();
});


test('deleted parents are redacted, retain replies, and reject new direct replies',async()=>{
 const {db,request}=await setup();
 const post=async body=>{const response=await request('/api/players/p/comments',{user:'1',body});assert.equal(response.status,201);return (await response.json()).id};
 const parent=await post({body:'Secret parent text'}),child=await post({body:'Surviving reply',parent_id:parent});
 await request('/api/comments/'+parent,{method:'DELETE',user:'1'});
 const row=db.prepare('SELECT * FROM comments WHERE id=?').get(parent);assert.equal(row.body,null);assert.equal(row.author_bonk_id,null);assert.ok(row.deleted_at);
 const roots=await (await request('/api/players/p/comments',{user:'1'})).json();assert.equal(roots.comments.length,1);assert.equal(roots.comments[0].deleted,true);assert.equal(roots.comments[0].author_name,null);assert.equal(roots.comments[0].avatar_code,null);assert.equal(roots.comments[0].can_reply,false);assert.equal(roots.comments[0].reply_count,1);
 const replies=await (await request('/api/players/p/comments?parent='+parent,{user:'1'})).json();assert.equal(replies.comments[0].body,'Surviving reply');assert.equal(replies.comments[0].can_reply,true);
 assert.equal((await request('/api/players/p/comments',{user:'1',body:{body:'Forbidden',parent_id:parent}})).status,409);
 const grandchild=await post({body:'Allowed on live child',parent_id:child});assert.ok(grandchild);
 assert.equal((await request('/api/players/q/comments',{user:'1',body:{body:'Wrong profile',parent_id:child}})).status,409);
 assert.equal((await request('/api/players/p/assessments/1/comments',{user:'1',body:{body:'Wrong assessment',parent_id:child}})).status,409);
 db.close();
});

test('comment and public profile avatars use stored skins without exposing Bonk IDs',async()=>{
 const {db,request}=await setup();db.prepare('INSERT INTO bonk_account_avatars VALUES(?,?)').run('1','saved-avatar');db.prepare('UPDATE players SET name=? WHERE id=?').run('Author','p');
 await request('/api/players/p/comments',{user:'1',body:{body:'With avatar'}});
 const comments=await (await request('/api/players/p/comments')).json();assert.equal(comments.comments[0].avatar_code,'saved-avatar');const own=await (await request('/api/players/p/comments',{user:'1'})).json();assert.equal(own.viewer.avatar_code,'saved-avatar');assert.equal('author_bonk_id' in comments.comments[0],false);
 const profile=await (await request('/api/players/p')).json();assert.equal(profile.profile.avatar_code,'saved-avatar');assert.equal(profile.profile.username,'Author');assert.equal('id' in profile.profile,false);
 db.close();
});

test('a reply cannot race the deletion of its immediate parent',async()=>{
 const {db,request,env}=await setup();const parent=await (await request('/api/players/p/comments',{user:'1',body:{body:'Parent'}})).json();
 const prepare=env.DB.prepare;
 env.DB.prepare=sql=>{if(sql.startsWith('INSERT INTO comments('))db.prepare('UPDATE comments SET body=NULL,author_bonk_id=NULL,deleted_at=? WHERE id=?').run('2026-10-28',parent.id);return prepare(sql)};
 assert.equal((await request('/api/players/p/comments',{user:'1',body:{body:'Late reply',parent_id:parent.id}})).status,409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM comments').get().n,1);db.close();
});

test('reply migration preserves existing comments and supports redaction',async()=>{
 const {db}=await setup();
 db.exec("DROP TABLE comments;CREATE TABLE comments(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,author_bonk_id TEXT NOT NULL REFERENCES bonk_users(bonk_id),body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created_at TEXT NOT NULL);INSERT INTO comments VALUES(77,'p',NULL,'1','Existing comment','2026-10-28');");
 db.exec(readFileSync(new URL('../migrations/0013_comment_replies.sql',import.meta.url),'utf8'));
 assert.equal(db.prepare('SELECT body FROM comments WHERE id=77').get().body,'Existing comment');
 db.exec("UPDATE comments SET body=NULL,author_bonk_id=NULL,deleted_at='2026-10-28' WHERE id=77;INSERT INTO comments(player_id,parent_id,author_bonk_id,body,created_at) VALUES('p',77,'1','Reply','2026-10-28')");
 assert.equal(db.prepare('SELECT parent_id FROM comments ORDER BY id DESC LIMIT 1').get().parent_id,77);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
});


test('accounts without assessments have public comment threads with normal authorship, replies and deletion',async()=>{
 const {db,request}=await setup();
 try{
  const path='/api/profiles/Other/comments';
  assert.equal((await request(path,{body:{body:'Anonymous'}})).status,401);
  const response=await request(path,{user:'1',body:{body:'Hello account',profile_bonk_id:'1',author_bonk_id:'2'}});
  assert.equal(response.status,201);const parent=(await response.json()).id;
  const stored=db.prepare('SELECT player_id,profile_bonk_id,author_bonk_id FROM comments WHERE id=?').get(parent);
  assert.equal(stored.player_id,null);assert.equal(stored.profile_bonk_id,'2');assert.equal(stored.author_bonk_id,'1');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM players').get().n,2);
  let page=await (await request(path)).json();assert.equal(page.comments[0].body,'Hello account');assert.equal(page.can_post,false);
  assert.equal('profile_bonk_id' in page.comments[0],false);assert.equal('author_bonk_id' in page.comments[0],false);
  const childResponse=await request(path,{user:'2',body:{body:'Reply',parent_id:parent}});assert.equal(childResponse.status,201);const child=(await childResponse.json()).id;
  assert.equal((await request('/api/comments/'+parent,{method:'DELETE',user:'2'})).status,403);
  assert.equal((await request('/api/comments/'+parent,{method:'DELETE',user:'1'})).status,200);
  page=await (await request(path)).json();assert.equal(page.comments[0].deleted,true);assert.equal(page.comments[0].reply_count,1);
  assert.equal((await request(path,{user:'1',body:{body:'Not allowed',parent_id:parent}})).status,409);
  assert.equal((await request(path,{user:'1',body:{body:'Allowed',parent_id:child}})).status,201);
  assert.equal((await request('/api/profiles/Author/comments',{user:'1',body:{body:'Wrong account',parent_id:child}})).status,409);
  assert.equal((await request('/api/players/p/assessments/1/comments',{user:'1',body:{body:'Wrong assessment',parent_id:child}})).status,409);
  assert.equal((await request('/api/profiles/missing/comments')).status,404);
  assert.equal((await request('/api/profiles/Other/comments?parent=nope')).status,400);
  assert.equal((await request('/api/profiles/Other/comments?before=nope')).status,400);
 }finally{db.close()}
});

test('an account thread survives its first assessment and legacy profile threads are promoted together',async()=>{
 const {db,request}=await setup();
 try{
  const account='/api/profiles/Author/comments';
  let response=await request(account,{user:'1',body:{body:'Before assessments'}});assert.equal(response.status,201);const accountRoot=(await response.json()).id;
  db.prepare('UPDATE players SET name=? WHERE id=?').run('Author','p');
  db.prepare('INSERT INTO comments(player_id,author_bonk_id,body,created_at) VALUES(?,?,?,?)').run('p','1','Legacy profile','2026-10-28');const legacyRoot=Number(db.prepare('SELECT last_insert_rowid() n').get().n);
  db.prepare('INSERT INTO comments(player_id,parent_id,author_bonk_id,body,created_at) VALUES(?,?,?,?,?)').run('p',legacyRoot,'2','Legacy child','2026-10-28');const legacyChild=Number(db.prepare('SELECT last_insert_rowid() n').get().n);
  db.prepare('INSERT INTO comments(player_id,assessment_id,author_bonk_id,body,created_at) VALUES(?,?,?,?,?)').run('p',1,'1','Assessment only','2026-10-28');
  const playerPath='/api/players/p/comments';
  let page=await (await request(playerPath)).json();assert.deepEqual(page.comments.map(comment=>comment.body),['Legacy profile','Before assessments']);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM comments WHERE profile_bonk_id=?').get('1').n,3);
  response=await request(playerPath,{user:'2',body:{body:'New reply to old profile',parent_id:legacyRoot}});assert.equal(response.status,201);
  response=await request(account,{user:'1',body:{body:'Reply to original account',parent_id:accountRoot}});assert.equal(response.status,201);
  for(const path of [account,playerPath]){
   page=await (await request(path+'?parent='+legacyRoot)).json();assert.deepEqual(page.comments.map(comment=>comment.body),['New reply to old profile','Legacy child']);
  }
  assert.equal((await (await request('/api/players/p/assessments/1/comments')).json()).comments[0].body,'Assessment only');
  db.prepare('UPDATE players SET name=? WHERE id=?').run('Different name','p');
  assert.equal((await (await request(playerPath)).json()).comments.length,0);
  db.prepare('DELETE FROM players WHERE id=?').run('p');
  page=await (await request(account+'?parent='+legacyRoot)).json();assert.equal(page.comments.length,2);assert.equal(page.comments[1].id,legacyChild);
  assert.equal((await (await request(account)).json()).comments.length,2);
 }finally{db.close()}
});

test('account and player comment aliases share the same rate limit',async()=>{
 const {db,request}=await setup();
 try{
  db.prepare('UPDATE players SET name=? WHERE id=?').run('Author','p');
  for(let i=0;i<5;i++)assert.equal((await request(i%2?'/api/profiles/Author/comments':'/api/players/p/comments',{user:'2',body:{body:'Comment'}})).status,201);
  assert.equal((await request('/api/profiles/Other/comments',{user:'2',body:{body:'Same global budget'}})).status,429);
 }finally{db.close()}
});

test('profile comment migration preserves nested tombstones, assessment separation and sequence',async()=>{
 const {db}=await setup();
 try{
  db.prepare('UPDATE players SET name=? WHERE id=?').run('Author','p');
  db.exec("DROP TABLE comments;CREATE TABLE comments(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,author_bonk_id TEXT REFERENCES bonk_users(bonk_id),body TEXT,created_at TEXT NOT NULL,deleted_at TEXT,CHECK((deleted_at IS NULL AND author_bonk_id IS NOT NULL AND body IS NOT NULL AND length(body) BETWEEN 1 AND 2000) OR (deleted_at IS NOT NULL AND author_bonk_id IS NULL AND body IS NULL)));INSERT INTO comments VALUES(7,'p',NULL,NULL,NULL,NULL,'2026-10-28','2026-10-28');INSERT INTO comments VALUES(8,'p',NULL,7,'1','Reply','2026-10-28',NULL);INSERT INTO comments VALUES(9,'p',1,NULL,'1','Assessment','2026-10-28',NULL);INSERT INTO comments VALUES(100,'q',NULL,NULL,'1','Removed','2026-10-28',NULL);DELETE FROM comments WHERE id=100;");
  db.exec(readFileSync(new URL('../migrations/0014_profile_comments.sql',import.meta.url),'utf8'));
  assert.equal(db.prepare('SELECT profile_bonk_id FROM comments WHERE id=7').get().profile_bonk_id,'1');
  assert.equal(db.prepare('SELECT parent_id FROM comments WHERE id=8').get().parent_id,7);
  assert.equal(db.prepare('SELECT player_id FROM comments WHERE id=9').get().player_id,'p');
  assert.equal(db.prepare('SELECT profile_bonk_id FROM comments WHERE id=9').get().profile_bonk_id,null);
  db.exec("INSERT INTO comments(profile_bonk_id,author_bonk_id,body,created_at) VALUES('2','1','New account comment','2026-10-28')");
  assert.equal(db.prepare('SELECT MAX(id) n FROM comments').get().n,101);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.throws(()=>db.exec("INSERT INTO comments(player_id,profile_bonk_id,author_bonk_id,body,created_at) VALUES('p','1','1','Invalid','2026-10-28')"));
  assert.throws(()=>db.exec("INSERT INTO comments(profile_bonk_id,assessment_id,author_bonk_id,body,created_at) VALUES('1',1,'1','Invalid','2026-10-28')"));
 }finally{db.close()}
});

test('profile comment migration keeps an empty table high-water mark',async()=>{
 const {db}=await setup();
 try{
  db.exec("INSERT INTO comments(id,player_id,author_bonk_id,body,created_at) VALUES(100,'p','1','Removed','2026-10-28');DELETE FROM comments;");
  db.exec(readFileSync(new URL('../migrations/0014_profile_comments.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO comments(profile_bonk_id,author_bonk_id,body,created_at) VALUES('2','1','New account comment','2026-10-28')");
  assert.equal(db.prepare('SELECT MAX(id) n FROM comments').get().n,101);
 }finally{db.close()}
});
