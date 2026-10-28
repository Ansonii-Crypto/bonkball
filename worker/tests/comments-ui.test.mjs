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
test('comment text is escaped and failed posts preserve the typed text',async()=>{
 const button={},input={value:'My unsent comment'},error={},more={},articles=[];
 const form={elements:{body:input},querySelector:()=>button};
 const list={children:articles,querySelector:()=>null,append:article=>articles.push(article)};
 const thread={isConnected:true,dataset:{commentPlayer:'p',commentAssessment:'7'},querySelector:key=>({'.comment-list':list,'.comment-error':error,'.comment-more':more,'.comment-form':form}[key])};
 const article={querySelector:()=>null};
 const ctx=context({document:{createElement:()=>article},api:async(path,options)=>{
  assert.equal(path,'/api/players/p/assessments/7/comments');
  if(options){assert.equal(JSON.parse(options.body).body,'My unsent comment');throw Error('Please wait')}
  return {can_post:true,viewer:{username:'Author'},comments:[{id:1,author_name:'<Author>',body:'<script>hello</script>',created_at:'2026-10-28',can_delete:false}],next_cursor:null};
 }});
 await ctx.loadCommentThread(thread);assert.match(article.innerHTML,/&lt;script&gt;hello&lt;\/script&gt;/);assert.match(article.innerHTML,/&lt;Author&gt;/);
 await form.onsubmit({preventDefault(){}});assert.equal(error.textContent,'Please wait');assert.equal(input.value,'My unsent comment');assert.equal(button.disabled,false);
});
