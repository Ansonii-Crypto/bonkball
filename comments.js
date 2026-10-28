// Public threads; posting and deletion permissions are enforced by the Worker.
function commentThreadHTML(playerId,assessmentId=null){
 if(!playerId)return '';
 return `<section class="comment-thread" data-comment-player="${esc(playerId)}"${assessmentId?` data-comment-assessment="${Number(assessmentId)}"`:''} aria-label="${assessmentId?'Assessment':'Profile'} comments"><p class="meta">Loading comments...</p></section>`;
}
const mountedCommentThreads=new WeakSet();
function mountCommentThreads(root=V){
 root.querySelectorAll('[data-comment-player]').forEach(thread=>{
  if(mountedCommentThreads.has(thread))return;mountedCommentThreads.add(thread);
  const disclosure=thread.closest('details.assessment-comments');
  let loaded=false;
  function start(){if(loaded||!thread.isConnected)return;loaded=true;loadCommentThread(thread)}
  if(disclosure){disclosure.addEventListener('toggle',()=>{if(disclosure.open)start()});if(disclosure.open)start()}else start();
 });
}
async function loadCommentThread(thread){
 const playerId=thread.dataset.commentPlayer,assessmentId=thread.dataset.commentAssessment;
 const path='/api/players/'+encodeURIComponent(playerId)+(assessmentId?'/assessments/'+assessmentId:'')+'/comments';
 try{
  const data=await api(path);if(!thread.isConnected)return;
  thread.innerHTML=`<h2>${assessmentId?'Comments':'Profile comments'}</h2>${data.can_post?`<form class="comment-form"><label>Comment as <strong>${esc(data.viewer.username)}</strong><textarea name="body" maxlength="2000" rows="3" placeholder="Write a comment..." required></textarea></label><div class="comment-form-actions"><span class="meta">2,000 characters maximum</span><button type="submit">Post comment</button></div></form>`:'<p class="meta"><a class="comment-sign-in" href="#/account">Sign in with Bonk</a> to leave a comment.</p>'}<p class="comment-error error" role="status" aria-live="polite"></p><div class="comment-list"></div><button type="button" class="secondary comment-more"${data.next_cursor?'':' hidden'}>Load older comments</button>`;
  const list=thread.querySelector('.comment-list'),error=thread.querySelector('.comment-error'),more=thread.querySelector('.comment-more');let cursor=data.next_cursor;
  function append(comments){
   if(!list.children.length&&!comments.length){list.innerHTML='<p class="meta comment-empty">No comments yet.</p>';return}
   list.querySelector('.comment-empty')?.remove();
   comments.forEach(comment=>{
    const article=document.createElement('article');article.className='comment';
    article.innerHTML=`<div class="comment-heading"><strong>${esc(comment.author_name)}</strong><time class="meta" datetime="${esc(comment.created_at)}">${esc(new Date(comment.created_at).toLocaleString())}</time>${comment.can_delete?'<button type="button" class="comment-delete" aria-label="Delete comment">Delete</button>':''}</div><p class="comment-body">${esc(comment.body)}</p>`;
    article.querySelector('.comment-delete')?.addEventListener('click',async event=>{
     const button=event.currentTarget;
     if(!await appConfirm('Delete this comment?',{title:'Delete comment',confirmLabel:'Delete'}))return;
     button.disabled=true;error.textContent='';
     try{await api('/api/comments/'+comment.id,{method:'DELETE'});article.remove();if(!list.children.length)list.innerHTML='<p class="meta comment-empty">No comments on this page.</p>'}
     catch(problem){error.textContent=problem.message;button.disabled=false}
    });list.append(article);
   });
  }
  append(data.comments);
  more.onclick=async()=>{
   if(!cursor)return;more.disabled=true;error.textContent='';
   try{const page=await api(path+'?before='+cursor);if(!thread.isConnected)return;append(page.comments);cursor=page.next_cursor;more.hidden=!cursor}
   catch(problem){error.textContent=problem.message}finally{more.disabled=false}
  };
  const form=thread.querySelector('.comment-form');
  if(form)form.onsubmit=async event=>{
   event.preventDefault();const text=form.elements.body,button=form.querySelector('button'),body=text.value.trim();if(!body){error.textContent='Write a comment before posting.';return}
   button.disabled=true;error.textContent='';
   try{await api(path,{method:'POST',body:JSON.stringify({body})});text.value='';await loadCommentThread(thread)}
   catch(problem){error.textContent=problem.message;button.disabled=false}
  };
 }catch(problem){
  if(!thread.isConnected)return;
  thread.innerHTML=`<h2>${assessmentId?'Comments':'Profile comments'}</h2><p class="error">${esc(problem.message)}</p><button type="button" class="secondary comment-retry">Retry comments</button>`;
  thread.querySelector('.comment-retry').onclick=()=>loadCommentThread(thread);
 }
}
