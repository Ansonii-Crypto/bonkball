import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../../comments.js',import.meta.url),'utf8');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function context(values={}){const ctx=vm.createContext({esc,...values});vm.runInContext(source,ctx);return ctx}
test('profile and assessment placeholders carry distinct safe targets',()=>{
 const ctx=context();assert.match(ctx.commentThreadHTML('p"<>'),/data-comment-player="p&quot;&lt;&gt;"/);
 assert.doesNotMatch(ctx.commentThreadHTML('p'),/data-comment-assessment/);
 assert.match(ctx.commentThreadHTML('p',7),/data-comment-assessment="7"/);
});
test('assessment comments load only on expansion and mount only once',async()=>{
 let calls=0,handler;const disclosure={open:false,addEventListener(_event,callback){handler=callback}};
 const thread={isConnected:true,closest:()=>disclosure};
 const ctx=context();ctx.loadCommentThread=()=>{calls++};const root={querySelectorAll:()=>[thread]};
 ctx.mountCommentThreads(root);assert.equal(calls,0);disclosure.open=true;handler();assert.equal(calls,1);handler();ctx.mountCommentThreads(root);assert.equal(calls,1);
});
function threadFixture(comment){
 const button={},input={value:'My unsent comment'},error={},more={},articles=[],deleteButton={addEventListener(_event,fn){this.handler=fn}};
 const form={elements:{body:input},querySelector:()=>button},list={children:articles,querySelector:()=>null,append:article=>articles.push(article)};
 const branch={querySelector:key=>key==='.comment-branch-list'?list:more};
 const thread={isConnected:true,dataset:{commentPlayer:'p',commentAssessment:'7'},querySelector:key=>({'.comment-list':branch,'.comment-error':error,'.comment-form':form}[key])};
 const content={querySelector:key=>key==='.comment-delete'&&comment.can_delete?deleteButton:null},toggle={setAttribute(){}},replies={hidden:true,classList:{add(){}}};
 const article={querySelector:key=>({'.comment-content':content,'.comment-replies-toggle':toggle,'.comment-replies':replies}[key])};
 const ctx=context({URLSearchParams,appConfirm:async()=>true,document:{createElement:()=>article},api:async(path,options)=>{
  if(options?.method==='DELETE')return {ok:true};
  assert.equal(path,'/api/players/p/assessments/7/comments');
  if(options){assert.equal(JSON.parse(options.body).body,'My unsent comment');throw Error('Please wait')}
  return {can_post:true,viewer:{username:'Author'},comments:[comment],next_cursor:null};
 }});
 return {ctx,thread,content,form,error,input,button,replies,deleteButton};
}

test('comment text is escaped and failed posts preserve the typed text',async()=>{
 const ui=threadFixture({id:1,author_name:'<Author>',body:'<script>hello</script>',created_at:'2026-10-28',can_delete:false});
 await ui.ctx.loadCommentThread(ui.thread);assert.match(ui.content.innerHTML,/&lt;script&gt;hello&lt;\/script&gt;/);assert.match(ui.content.innerHTML,/&lt;Author&gt;/);
 await ui.form.onsubmit({preventDefault(){}});assert.equal(ui.error.textContent,'Please wait');assert.equal(ui.input.value,'My unsent comment');assert.equal(ui.button.disabled,false);
});

test('deleted comments expose neither original content nor author and have no reply controls',()=>{
 const ctx=context();const html=ctx.commentContentHTML({id:1,deleted:true,body:'Old text',author_name:'Old author',can_reply:true,can_delete:true});
 assert.match(html,/This comment has been deleted/);assert.doesNotMatch(html,/Old text|Old author|comment-reply|comment-delete"|account-avatar/);
});

test('deleting a rendered parent preserves its already-open replies',async()=>{
 const ui=threadFixture({id:1,author_name:'Author',body:'Original comment',created_at:'2026-10-28',can_delete:true,reply_count:1});
 await ui.ctx.loadCommentThread(ui.thread);ui.replies.hidden=false;ui.replies.innerHTML='Existing child replies';
 await ui.deleteButton.handler({currentTarget:ui.deleteButton});
 assert.match(ui.content.innerHTML,/This comment has been deleted/);assert.doesNotMatch(ui.content.innerHTML,/Original comment|Author/);assert.equal(ui.replies.innerHTML,'Existing child replies');assert.equal(ui.replies.hidden,false);
});

test('live comment headings include the author avatar',()=>{
 const ctx=context({accountAvatar:user=>`<span data-skin="${user.avatar_code}"></span>`});
 assert.match(ctx.commentContentHTML({author_name:'Author',avatar_code:'saved-skin',body:'Hello',created_at:'2026-10-28',can_reply:true}),/data-skin="saved-skin"/);
});
