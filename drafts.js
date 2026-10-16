async function newPlayerPage(){
 const container=document.querySelector('#adminContent'),version=++adminViewVersion;
 container.innerHTML='<p>Loading player drafts...</p>';
 try{
  const [result,session]=await Promise.all([api('/api/player-drafts'),api('/api/session')]);
  if(version!==adminViewVersion||!container.isConnected)return;
  if(!result.drafts.length){openPlayerDraft(null,session.account.id);return}
  container.innerHTML=`<section class="card"><h2>New players</h2><p>Temporarily saved players are visible to all admins. Only the author can edit or push their draft.</p><button id="startPlayerDraft">Start another player</button><div class="draft-list">${result.drafts.map(d=>`<div class="listrow"><div><strong>${esc(d.data.name||'Unnamed player')}</strong><div class="meta">${esc(d.owner_name)} &middot; Saved ${esc(new Date(d.updated_at).toLocaleString())}</div></div><button class="secondary" data-open-draft="${esc(d.id)}">Continue</button></div>`).join('')}</div></section>`;
  container.querySelector('#startPlayerDraft').onclick=()=>openPlayerDraft(null,session.account.id);
  container.querySelectorAll('[data-open-draft]').forEach(button=>button.onclick=()=>openPlayerDraft(result.drafts.find(d=>d.id===button.dataset.openDraft),session.account.id));
 }catch(error){if(version===adminViewVersion&&container.isConnected){container.innerHTML='<div class="empty"><p data-draft-error></p><button id="retryDrafts">Retry</button></div>';container.querySelector('[data-draft-error]').textContent=error.message;container.querySelector('#retryDrafts').onclick=newPlayerPage}}
}

function openPlayerDraft(draft,accountId){
 ++adminViewVersion;
 const container=document.querySelector('#adminContent');
 container.innerHTML=`<div class="draft-heading"><button class="secondary" id="backToDrafts">Back to drafts</button><p>${draft?`Draft by ${esc(draft.owner_name)}`:'New player draft'}</p></div>${form(draft?.data||{})}`;
 container.querySelector('#backToDrafts').onclick=newPlayerPage;
 const formElement=container.querySelector('#pf');
 if(draft&&draft.owner_id!==accountId){
  container.querySelector('.draft-heading p').textContent+=' ? Read-only preview';
  formElement.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=true);
  formElement.querySelector('.new-player-actions').hidden=true;
  return;
 }
 const state={id:draft?.id||null,revision:draft?.revision||null};
 wireForm(null,null,false,state);
 const discard=document.createElement('button');discard.type='button';discard.className='danger';discard.textContent='Discard draft';
 formElement.querySelector('.new-player-actions').prepend(discard);
 discard.onclick=async()=>{
  if(formElement.querySelector('button[type="submit"]').disabled){msg('Wait for the current save to finish.');return}
  if(!await appConfirm('Discard this draft and its saved statistics? This cannot be undone.',{title:'Discard draft',confirmLabel:'Discard draft'}))return;
  discard.disabled=true;
  try{
   if(state.id)await api('/api/player-drafts/'+encodeURIComponent(state.id),{method:'DELETE',body:JSON.stringify({revision:state.revision})});
   msg('Draft discarded.');if(formElement.isConnected)await newPlayerPage();
  }catch(error){msg(error.message);discard.disabled=false}
 };
}

async function savePlayerDraft(form,state){
 const data=Object.fromEntries(new FormData(form));
 const result=await api('/api/player-drafts'+(state.id?'/'+encodeURIComponent(state.id):''),{method:state.id?'PUT':'POST',body:JSON.stringify({data,revision:state.revision})});
 state.id=result.id;state.revision=result.revision;
 return result;
}
