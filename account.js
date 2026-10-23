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
  render(`<div class="login"><div class="account-profile"><span class="account-avatar" aria-hidden="true">${esc(Array.from(state.user.username)[0].toUpperCase())}</span><h1>${esc(state.user.username)}</h1></div><p>Bonk account ID: <strong>${esc(state.user.id)}</strong></p><p>You are browsing as a regular user.${account?' Your personal code is only needed for administrator tools.':''}</p>${account?`<button id="openAdmin">${state.authenticated?'Open administrator tools':'Unlock administrator tools'}</button>`:wantAdmin?'<p>This Bonk account does not have administrator access.</p>':''}<p><a href="#/players">Browse players</a></p></div>`);
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
async function ownProfile(){
 render('<div class="login"><h1>Profile</h1><p>Loading your assessments?</p></div>');
 const panel=V.firstElementChild;
 try{
  const state=await api('/api/session');if(!panel.isConnected)return;
  if(!state.user){await accountPage();return}
  const {players}=await api('/api/players');if(!panel.isConnected)return;
  // Existing public assessment records are named, not linked to Bonk IDs.
  // An exact username match is for displaying public history only, never permissions.
  const name=state.user.username.trim().toLowerCase();
  const record=players.find(player=>String(player.name).trim().toLowerCase()===name);
  if(record){await player(record.id);return}
  render(`<div class="login"><div class="account-profile"><span class="account-avatar" aria-hidden="true">${esc(Array.from(state.user.username)[0].toUpperCase())}</span><h1>${esc(state.user.username)}</h1></div><p>No assessments have been recorded for this username yet.</p><a href="#/players">Browse players</a></div>`);
 }catch(error){if(panel.isConnected)render(`<div class="login"><h1>Profile unavailable</h1><p class="error">${esc(error.message)}</p><a href="#/account">Back to account</a></div>`)}
}
function updateAccountMenus(user,adminAccount=null){
 document.querySelectorAll('[data-account-control]').forEach(container=>{
  if(!user){container.innerHTML='<a href="#/account">Account</a>';return}
  container.innerHTML=`<details class="user-account-menu"><summary><span class="account-avatar" aria-hidden="true">${esc(Array.from(user.username)[0].toUpperCase())}</span><span class="account-username">${esc(user.username)}</span><span aria-hidden="true">▾</span></summary><div class="user-account-options"><a href="#/profile">Profile</a>${adminAccount?'<a href="#/admin">Admin tools</a>':''}<button type="button" class="account-logout">Log out</button></div></details>`;
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
