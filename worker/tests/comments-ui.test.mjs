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
 const content={querySelector:key=>key==='.comment-replies-slot'?{append(){}}:key==='.comment-delete'&&comment.can_delete?deleteButton:null},toggle={setAttribute(){}},replies={hidden:true,classList:{add(){}}};
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


test('mentions highlight only the signed-in username using their skin base colour',()=>{
 const ctx=context({window:{BonkSkinRenderer:{decode:()=>({bc:0x123456})}}});
 const html=ctx.commentMentionHTML('Hello @PLAYER, @Player2, mail@Player and @Other. @Player!',{username:'Player',avatar_code:'skin'});
 assert.equal((html.match(/<mark /g)||[]).length,2);assert.match(html,/--mention-bg:#123456/);assert.match(html,/--mention-ink:#fffdf5/);
 assert.match(html,/@Player2/);assert.match(html,/mail@Player/);assert.doesNotMatch(ctx.commentMentionHTML('@Player',null),/<mark/);
});

test('mention matching handles spaces and regex characters without allowing HTML',()=>{
 const ctx=context({window:{BonkSkinRenderer:{decode:()=>({bc:0xffffff})}}});
 const html=ctx.commentMentionHTML('<script>@A+B (x)</script> @AxB (x)',{username:'A+B (x)',avatar_code:'skin'});
 assert.equal((html.match(/<mark /g)||[]).length,1);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/--mention-ink:#17231f/);
 assert.match(ctx.commentMentionHTML('@Player',{username:'Player',avatar_code:'broken'}),/<mark/);
});


test('deep reply references distinguish different comments by the same author and escape content',()=>{
 const ctx=context(),first={author_name:'Alex',body:'First comment'},second={author_name:'Alex',body:'Second comment'};
 assert.notEqual(ctx.commentParentReferenceText(first),ctx.commentParentReferenceText(second));
 assert.equal(ctx.commentParentReferenceHTML(first,1),'');assert.match(ctx.commentParentReferenceHTML(first,2),/comment-parent-mobile-only/);
 assert.doesNotMatch(ctx.commentParentReferenceHTML(first,3),/comment-parent-mobile-only/);
 const html=ctx.commentParentReferenceHTML({author_name:'<Alex>',body:'<script>danger</script>'},4);assert.match(html,/&lt;Alex&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.ok(ctx.commentParentReferenceText({author_name:'Alex',body:'a'.repeat(100)}).endsWith('..."'));
});

test('deleting a parent updates its reference labels without exposing the old author or text',()=>{
 const ctx=context(),button={isConnected:true,textContent:'Old author and text'},detached={isConnected:false};
 const parent={comment:{deleted:true,author_name:'Old author',body:'Old text'},references:new Set([button,detached])};
 ctx.refreshCommentParentReferences(parent);assert.equal(button.textContent,'Replying to a deleted comment.');assert.equal(parent.references.size,1);
});

test('parent navigation targets the exact content element, respects reduced motion and clears its highlight',()=>{
 let timer,focused=false,scrolled;const classes=new Set();
 const ctx=context({matchMedia:()=>({matches:true}),clearTimeout(){},setTimeout(callback){timer=callback;return 1}});
 const parent={isConnected:true,scrollIntoView:options=>{scrolled=options},focus:()=>{focused=true},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
 ctx.focusCommentParent(parent);assert.equal(scrolled.behavior,'auto');assert.equal(scrolled.block,'center');assert.equal(focused,true);assert.equal(parent.tabIndex,-1);assert.equal(classes.has('comment-parent-highlight'),true);
 timer();assert.equal(classes.has('comment-parent-highlight'),false);
});
