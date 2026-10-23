function accountAvatar(user){
 const initial=esc(Array.from(user.username||'?')[0].toUpperCase());
 const code=typeof user.avatar_code==='string'&&user.avatar_code.length<=20000?user.avatar_code:null;
 const src=code?'https://bonkleagues.io/api/avatar.svg?skinCode='+encodeURIComponent(code):null;
 return `<span class="account-avatar" aria-hidden="true"><span class="account-avatar-initial">${initial}</span>${src?`<img data-bonk-avatar src="${esc(src)}" alt="" referrerpolicy="no-referrer" decoding="async">`:''}</span>`;
}
document.addEventListener('load',event=>{if(event.target.matches?.('[data-bonk-avatar]'))event.target.parentElement.classList.add('has-skin')},true);
document.addEventListener('error',event=>{if(event.target.matches?.('[data-bonk-avatar]')){event.target.parentElement.classList.remove('has-skin');event.target.remove()}},true);
// Bonk identity and optional administrator elevation are separate sessions.
let pendingAdminSetup=null;
let accountPageVersion=0;
async function accountPage({admin:wantAdmin=false}={}){
 const version=++accountPageVersion;
 render('<div class="login"><h1>Account</h1><p>Checking your session…</p></div>');
 const loadingPanel=V.firstElementChild;
 let state;try{state=await api('/api/session')}catch(error){if(version===accountPageVersion&&loadingPanel.isConnected){render(`<div class="login"><h1>Account unavailable</h1><p class="error">${esc(error.message)}</p><button id="retryAccount">Retry</button></div>`);document.querySelector('#retryAccount').onclick=()=>accountPage({admin:wantAdmin})}return}
 if(version!==accountPageVersion||!loadingPanel.isConnected)return;
 updateAccountMenus(state.user,state.admin_account);
 if(state.user){
  const account=state.admin_account;
  if(pendingAdminSetup){
   if(account?.id===pendingAdminSetup.id&&pendingAdminSetup.invite&&!account.code_ready&&account.invitation_expires_at>Date.now()){
    const invitation=pendingAdminSetup.invite;pendingAdminSetup=null;login(account,invitation);return;
   }
   pendingAdminSetup=null;
   render(`<div class="login"><h1>Invitation unavailable</h1><p>This invitation is expired, already used, or belongs to another Bonk account. Signed in as ${esc(state.user.username)}.</p><button id="accountBack">Back to account</button></div>`);
   document.querySelector('#accountBack').onclick=()=>accountPage();return;
  }
  if(wantAdmin&&account){if(state.authenticated){await admin();return}login(account);return}
  render(`<div class="login"><div class="account-profile">${accountAvatar(state.user)}<h1>${esc(state.user.username)}</h1></div><p>Bonk account ID: <strong>${esc(state.user.id)}</strong></p><p>You are browsing as a regular user.${account?' Your personal code is only needed for administrator tools.':''}</p>${account?`<button id="openAdmin">${state.authenticated?'Open administrator tools':'Unlock administrator tools'}</button>`:wantAdmin?'<p>This Bonk account does not have administrator access.</p>':''}<p><a href="#/players">Browse players</a></p></div>`);
  document.querySelector('#openAdmin')?.addEventListener('click',()=>{if(location.hash==='#/admin')admin();else location.hash='#/admin'});return;
 }
 render(`<div class="login"><h1>Sign in to Bonk Critic</h1><p>Use your Bonk account to sign in.${pendingAdminSetup?' Sign in to the account this admin invitation was issued for.':''}</p><form id="bonkLogin" class="card"><label for="bonkUsername">Bonk username</label><input id="bonkUsername" name="username" autocomplete="username" maxlength="100" required><label for="bonkPassword">Bonk password</label><input id="bonkPassword" name="password" type="password" autocomplete="current-password" maxlength="1024" required><p class="meta">Your credentials are sent securely through Bonk Critic’s server to Bonk. Your password is not saved by Bonk Critic.</p><p id="bonkLoginError" class="error" role="status" aria-live="polite"></p><button type="submit">Sign in</button></form></div>`);
 const form=document.querySelector('#bonkLogin');
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button'),password=form.elements.password;button.disabled=true;form.querySelector('[role="status"]').textContent='Signing in…';
  try{await api('/api/bonk/login',{method:'POST',body:JSON.stringify({username:form.elements.username.value.trim(),password:password.value})});if(version===accountPageVersion&&form.isConnected)await accountPage({admin:wantAdmin})}
  catch(error){if(form.isConnected)form.querySelector('[role="status"]').textContent=error.message}
  finally{password.value='';button.disabled=false}
 };
}
function profileAssessmentOrder(history,order='newest',author=''){
 const byDate=(a,b)=>{const left=Date.parse(a.assessed_at),right=Date.parse(b.assessed_at);if(Number.isFinite(left)!==Number.isFinite(right))return Number.isFinite(left)?-1:1;return (Number.isFinite(left)?right-left:0)||Number(b.id)-Number(a.id)};
 const byAuthor=(a,b)=>String(a.assessed_by||'Not recorded').localeCompare(String(b.assessed_by||'Not recorded'),undefined,{sensitivity:'base'});
 return history.filter(h=>!author||(h.assessed_by||'Not recorded')===author).sort((a,b)=>{
  if(order==='oldest'){const left=Date.parse(a.assessed_at),right=Date.parse(b.assessed_at);if(Number.isFinite(left)!==Number.isFinite(right))return Number.isFinite(left)?-1:1;return -byDate(a,b)}
  if(order==='admin-asc'||order==='admin-desc')return (order==='admin-asc'?byAuthor(a,b):-byAuthor(a,b))||byDate(a,b);
  return byDate(a,b);
 });
}
function profileAssessmentCard(h){
 const instant=String(h.assessed_at||''),timestamp=instant.includes('T')&&Number.isFinite(Date.parse(instant))?new Date(instant).toLocaleString():date(instant);
 const total=Number(h.total??A.reduce((sum,[key])=>sum+Number(h[key]||0),0));
 const notes=[['Playstyle',h.playstyle],['Strengths',h.strengths],['Weaknesses',h.weaknesses],['Notes',h.notes]].filter(([,value])=>typeof value==='string'&&value.trim());
 return `<article class="card profile-assessment-card"><div class="assessment-heading"><strong>${esc(timestamp)}</strong>${cardTierBadge({overall_tier:h.overall_tier})}</div><p class="meta">Assessment #${Number(h.id)}${h.class_name?` &middot; ${esc(h.class_name)}`:''}</p><p>Assessed by <strong>${esc(h.assessed_by||'Not recorded')}</strong></p><p><strong>${total} / 1800</strong></p><details class="profile-assessment-details"><summary><span class="profile-show-label">View assessment</span><span class="profile-hide-label">Hide assessment</span><span class="profile-expand-icon" aria-hidden="true">+</span></summary><div class="profile-assessment-body"><dl class="profile-attribute-list">${A.map(([key,,label])=>`<div><dt>${esc(label)}</dt><dd>${Number(h[key]||0)}<span> / 300</span></dd><dd class="profile-attribute-tier">${esc(tier(h[key]))}</dd></div>`).join('')}</dl>${notes.map(([label,value])=>`<section class="profile-assessment-note"><h3>${label}</h3><p>${esc(value)}</p></section>`).join('')}</div></details></article>`;
}
function renderOwnProfile(user,record,history){
 const authors=[...new Set(history.map(h=>h.assessed_by||'Not recorded'))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
 render(`<section class="own-profile"><div class="hero own-profile-heading"><div class="account-profile">${accountAvatar(user)}<h1>${esc(user.username)}</h1></div><p>Bonk account ID: ${esc(user.id)}</p></div>${history.length?`<section aria-labelledby="ownAssessmentsTitle"><div class="profile-assessments-toolbar"><h2 id="ownAssessmentsTitle">Assessments</h2><div class="profile-assessments-controls"><label>Order<select id="profileAssessmentSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="admin-asc">Admin: A-Z</option><option value="admin-desc">Admin: Z-A</option></select></label><label>Admin<select id="profileAssessmentAdmin"><option value="">All admins</option>${authors.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label></div></div><p class="meta" id="profileAssessmentCount" role="status"></p><div class="profile-assessments-grid" id="profileAssessmentCards" tabindex="0" aria-label="Assessments, scroll horizontally for more"></div></section>`:'<p>No assessments have been recorded for this username yet.</p>'}</section>`);
 if(!history.length)return;
 const sort=document.querySelector('#profileAssessmentSort'),author=document.querySelector('#profileAssessmentAdmin'),cards=document.querySelector('#profileAssessmentCards'),count=document.querySelector('#profileAssessmentCount');
 function draw(){const visible=profileAssessmentOrder(history,sort.value,author.value);cards.innerHTML=visible.map(profileAssessmentCard).join('')||'<p>No assessments match this admin.</p>';cards.scrollLeft=0;count.textContent=`${visible.length} ${visible.length===1?'assessment':'assessments'}`}
 sort.onchange=draw;author.onchange=draw;draw();
}
async function ownProfile(){
 render('<div class="login"><h1>Profile</h1><p>Loading your assessments...</p></div>');
 const panel=V.firstElementChild;
 try{
  const state=await api('/api/session');if(!panel.isConnected)return;
  if(!state.user){await accountPage();return}
  const {players}=await api('/api/players');if(!panel.isConnected)return;
  // Existing public assessment records are named, not linked to Bonk IDs.
  // An exact username match is for displaying public history only, never permissions.
  const name=state.user.username.trim().toLowerCase();
  const record=players.find(player=>String(player.name).trim().toLowerCase()===name);
  let history=[];if(record){const result=await api('/api/players/'+encodeURIComponent(record.id));if(!panel.isConnected)return;history=result.history||[]}
  renderOwnProfile(state.user,record,history);
 }catch(error){if(panel.isConnected)render(`<div class="login"><h1>Profile unavailable</h1><p class="error">${esc(error.message)}</p><a href="#/account">Back to account</a></div>`)}
}
function updateAccountMenus(user,adminAccount=null){
 document.querySelectorAll('[data-account-control]').forEach(container=>{
  if(!user){container.innerHTML='<a href="#/account">Account</a>';return}
  container.innerHTML=`<details class="user-account-menu"><summary>${accountAvatar(user)}<span class="account-username">${esc(user.username)}</span><span aria-hidden="true">▾</span></summary><div class="user-account-options"><a href="#/profile">Profile</a>${adminAccount?'<a href="#/admin">Admin tools</a>':''}<button type="button" class="account-logout">Log out</button></div></details>`;
  container.querySelector('.account-logout').onclick=async event=>{
   const button=event.currentTarget;button.disabled=true;
   try{await api('/api/bonk/logout',{method:'POST',body:'{}'});pendingAdminSetup=null;updateAccountMenus(null);if(location.hash==='#/account')await accountPage();else location.hash='#/account'}catch(error){msg(error.message);button.disabled=false}
  };
  const menu=container.querySelector('details');container.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menu.open=false;if(location.hash===link.getAttribute('href')){if(location.hash==='#/admin')admin();else ownProfile()}}));menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.user-account-menu[open]').forEach(other=>{if(other!==menu)other.open=false})});
 });
}
document.addEventListener('click',event=>{document.querySelectorAll('.user-account-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false})});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.user-account-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus()})});
let menuRefreshVersion=0;
async function refreshAccountMenus(){const version=++menuRefreshVersion;try{const state=await api('/api/session');if(version===menuRefreshVersion)updateAccountMenus(state.user,state.admin_account)}catch{if(version===menuRefreshVersion)updateAccountMenus(null)}}
window.addEventListener('accountchange',refreshAccountMenus);
window.addEventListener('focus',refreshAccountMenus);
refreshAccountMenus();
