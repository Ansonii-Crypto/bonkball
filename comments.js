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
function commentContentHTML(comment){
 if(comment.deleted)return '<p class="comment-deleted">This comment has been deleted.</p>';
 const avatar=typeof accountAvatar==='function'?accountAvatar({username:comment.author_name,avatar_code:comment.avatar_code}):`<span class="account-avatar" aria-hidden="true">${esc(Array.from(comment.author_name||'?')[0])}</span>`;
 return `<div class="comment-heading">${avatar}<strong>${esc(comment.author_name)}</strong><time class="meta" datetime="${esc(comment.created_at)}">${esc(new Date(comment.created_at).toLocaleString())}</time>${comment.can_delete?'<button type="button" class="comment-delete" aria-label="Delete comment">Delete</button>':''}</div><p class="comment-body">${esc(comment.body)}</p>${comment.can_reply?'<button type="button" class="comment-reply">Reply</button>':''}<div class="comment-reply-form-slot"></div>`;
}
async function loadCommentThread(thread){
 const playerId=thread.dataset.commentPlayer,assessmentId=thread.dataset.commentAssessment;
 const path='/api/players/'+encodeURIComponent(playerId)+(assessmentId?'/assessments/'+assessmentId:'')+'/comments';
 try{
  const data=await api(path);if(!thread.isConnected)return;
  thread.innerHTML=`<h2>${assessmentId?'Comments':'Profile comments'}</h2>${data.can_post?`<form class="comment-form"><label>Comment as <strong>${esc(data.viewer.username)}</strong><textarea name="body" maxlength="2000" rows="3" placeholder="Write a comment..." required></textarea></label><div class="comment-form-actions"><span class="meta">2,000 characters maximum</span><button type="submit">Post comment</button></div></form>`:'<p class="meta"><a class="comment-sign-in" href="#/account">Sign in with Bonk</a> to leave a comment.</p>'}<p class="comment-error error" role="status" aria-live="polite"></p><div class="comment-list"></div>`;
  const error=thread.querySelector('.comment-error');
  function pagePath(parent,cursor=null){const query=new URLSearchParams();if(parent)query.set('parent',parent);if(cursor)query.set('before',cursor);return path+(query.size?'?'+query:'')}
  function populateBranch(container,page,parent=null,depth=0){
   container.innerHTML='<div class="comment-branch-list"></div><button type="button" class="secondary comment-more" hidden>Load older comments</button>';
   const list=container.querySelector('.comment-branch-list'),more=container.querySelector('.comment-more');let cursor=page.next_cursor;
   function append(comments){
    if(!list.children.length&&!comments.length){list.innerHTML='<p class="meta comment-empty">No comments yet.</p>';return}
    list.querySelector('.comment-empty')?.remove();comments.forEach(comment=>list.append(createComment(comment,depth)));
   }
   append(page.comments);more.hidden=!cursor;
   more.onclick=async()=>{if(!cursor)return;more.disabled=true;error.textContent='';try{const next=await api(pagePath(parent,cursor));if(!thread.isConnected)return;append(next.comments);cursor=next.next_cursor;more.hidden=!cursor}catch(problem){error.textContent=problem.message}finally{more.disabled=false}};
  }
  function createComment(comment,depth){
   const article=document.createElement('article');article.className='comment';
   article.innerHTML='<div class="comment-content"></div><button type="button" class="comment-replies-toggle" aria-expanded="false"></button><div class="comment-replies" hidden></div>';
   const content=article.querySelector('.comment-content'),toggle=article.querySelector('.comment-replies-toggle'),replies=article.querySelector('.comment-replies');
   if(depth>=3)replies.classList.add('comment-replies-flat');let loaded=false;
   function updateToggle(){toggle.textContent=`${replies.hidden?'Show':'Hide'} replies (${comment.reply_count||0})`;toggle.hidden=!comment.reply_count;toggle.setAttribute('aria-expanded',String(!replies.hidden))}
   async function showReplies(refresh=false){
    replies.hidden=false;updateToggle();if(loaded&&!refresh)return;
    replies.innerHTML='<p class="meta">Loading replies...</p>';
    try{const page=await api(pagePath(comment.id));if(!thread.isConnected)return;populateBranch(replies,page,comment.id,depth+1);loaded=true}
    catch(problem){loaded=false;replies.innerHTML='<p class="error">Replies could not be loaded.</p>';error.textContent=problem.message}
   }
   function drawContent(){
    content.innerHTML=commentContentHTML(comment);
    content.querySelector('.comment-delete')?.addEventListener('click',async event=>{
     const button=event.currentTarget;if(!await appConfirm('Delete this comment? Replies will remain.',{title:'Delete comment',confirmLabel:'Delete'}))return;
     button.disabled=true;error.textContent='';
     try{await api('/api/comments/'+comment.id,{method:'DELETE'});comment={...comment,deleted:true,body:null,author_name:null,avatar_code:null,can_reply:false,can_delete:false};drawContent()}
     catch(problem){error.textContent=problem.message;button.disabled=false}
    });
    content.querySelector('.comment-reply')?.addEventListener('click',()=>{
     const slot=content.querySelector('.comment-reply-form-slot');if(slot.children.length){slot.querySelector('textarea').focus();return}
     slot.innerHTML='<form class="comment-reply-form"><label>Reply<textarea name="body" maxlength="2000" rows="3" required></textarea></label><div class="comment-form-actions"><button type="submit">Post reply</button><button type="button" class="secondary comment-cancel-reply">Cancel</button></div></form>';
     const form=slot.querySelector('form');form.elements.body.focus();form.querySelector('.comment-cancel-reply').onclick=()=>{slot.innerHTML=''};
     form.onsubmit=async event=>{event.preventDefault();const text=form.elements.body,body=text.value.trim(),button=form.querySelector('[type="submit"]');if(!body){error.textContent='Write a reply before posting.';return}button.disabled=true;error.textContent='';
      try{await api(path,{method:'POST',body:JSON.stringify({body,parent_id:comment.id})});slot.innerHTML='';comment.reply_count=(comment.reply_count||0)+1;await showReplies(true)}catch(problem){error.textContent=problem.message;button.disabled=false}
     };
    });
   }
   toggle.onclick=async()=>{if(!replies.hidden){replies.hidden=true;updateToggle()}else await showReplies()};
   drawContent();updateToggle();return article;
  }
  populateBranch(thread.querySelector('.comment-list'),data);
  const form=thread.querySelector('.comment-form');
  if(form)form.onsubmit=async event=>{
   event.preventDefault();const text=form.elements.body,button=form.querySelector('button'),body=text.value.trim();if(!body){error.textContent='Write a comment before posting.';return}
   button.disabled=true;error.textContent='';
   try{await api(path,{method:'POST',body:JSON.stringify({body})});text.value='';await loadCommentThread(thread)}catch(problem){error.textContent=problem.message;button.disabled=false}
  };
 }catch(problem){if(!thread.isConnected)return;thread.innerHTML=`<h2>${assessmentId?'Comments':'Profile comments'}</h2><p class="error">${esc(problem.message)}</p><button type="button" class="secondary comment-retry">Retry comments</button>`;thread.querySelector('.comment-retry').onclick=()=>loadCommentThread(thread)}
}
