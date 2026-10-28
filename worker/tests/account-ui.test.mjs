import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../../account.js',import.meta.url),'utf8');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(state){
 let html='',loginCalls=[],adminCalls=0,submitted;
 const button={},status={},form={isConnected:true,elements:{username:{value:'Typed'},password:{value:'test-only'}},querySelector:selector=>selector==='button'?button:status};
 const V={firstElementChild:{isConnected:true}};
 const elements={'#bonkLogin':form,'#accountBack':{},'#retryAccount':{},'#openAdmin':{addEventListener(){}}};
 const context=vm.createContext({document:{querySelector:selector=>elements[selector],querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},V,location:{hash:'#/account'},history:{},esc:escape,render(value){html=value},api:async(path,options)=>{if(path==='/api/session')return state;submitted={path,options};throw Error('Wrong password')},login:(...args)=>loginCalls.push(args),admin:async()=>{adminCalls++},msg(){}});
 vm.runInContext(source,context);
 return {context,form,status,button,get html(){return html},get loginCalls(){return loginCalls},get adminCalls(){return adminCalls},get submitted(){return submitted}};
}
test('regular accounts do not receive admin code setup, while eligible admins unlock explicitly',async()=>{
 const regular=fixture({user:{id:'1',username:'<Player>'},admin_account:null});await regular.context.accountPage();
 assert.match(regular.html,/&lt;Player&gt;/);assert.doesNotMatch(regular.html,/id="openAdmin"/);assert.equal(regular.loginCalls.length,0);
 const account={id:'admin',name:'Admin',code_ready:1},admin=fixture({user:{id:'2',username:'Admin'},admin_account:account,authenticated:false});
 await admin.context.accountPage();assert.match(admin.html,/Unlock administrator tools/);assert.equal(admin.loginCalls.length,0);
 await admin.context.accountPage({admin:true});assert.equal(admin.loginCalls[0][0],account);
});
test('Bonk form sends credentials only to the server and clears the password after rejection',async()=>{
 const ui=fixture({user:null});await ui.context.accountPage();
 assert.match(ui.html,/type="password"/);await ui.form.onsubmit({preventDefault(){}});
 assert.equal(ui.submitted.path,'/api/bonk/login');assert.deepEqual(JSON.parse(ui.submitted.options.body),{username:'Typed',password:'test-only'});
 assert.equal(ui.form.elements.password.value,'');assert.equal(ui.status.textContent,'Wrong password');assert.equal(ui.button.disabled,false);
});
test('an invitation cannot open setup under another Bonk identity',async()=>{
 const ui=fixture({user:{id:'2',username:'Other'},admin_account:null});
 vm.runInContext("pendingAdminSetup={id:'intended',invite:'secret'}",ui.context);
 await ui.context.accountPage({admin:true});assert.match(ui.html,/Invitation unavailable/);assert.equal(ui.loginCalls.length,0);
});
test('account dropdown displays an escaped initial and username, and offers profile',()=>{
 const ui=fixture({user:null}),button={},menu={addEventListener(){}};let markup='';
 const container={querySelectorAll:()=>[],set innerHTML(value){markup=value},querySelector:selector=>selector==='details'?menu:button};
 ui.context.document.querySelectorAll=()=>[container];
 ui.context.updateAccountMenus({username:'<Player>'});
 assert.match(markup,/account-avatar[^>]*>&lt;<\/span>/);assert.match(markup,/&lt;Player&gt;/);assert.match(markup,/>Log out<\/button>/);
 assert.match(markup,/href="#\/profile"/);assert.doesNotMatch(markup,/>Admin tools</);
 assert.equal((markup.match(/<button/g)||[]).length,1);assert.equal(typeof button.onclick,'function');
 ui.context.updateAccountMenus({username:'Admin'},{id:'admin'});assert.match(markup,/href="#\/admin">Admin tools/);
});


test('own profile loads matching assessments into a dedicated profile, not the player view',async()=>{
 const ui=fixture({user:{username:'PLAYER',id:'7'}});let loaded=null;
 ui.context.api=async path=>{if(path==='/api/session')return {user:{username:'PLAYER',id:'7'}};if(path==='/api/players')return {players:[{id:'record-7',name:'Player'}]};assert.equal(path,'/api/players/record-7');return {history:[{id:1}]}};
 ui.context.renderOwnProfile=(user,record,history)=>{loaded={user,record,history}};
 ui.context.player=()=>assert.fail('Must not open the public player assessment view');
 await ui.context.ownProfile();assert.equal(loaded.record.id,'record-7');assert.equal(loaded.history.length,1);
});

test('profiles without assessments omit the assessments heading and controls',()=>{
 const ui=fixture({user:null});ui.context.renderOwnProfile({username:'Player',id:'7'},null,[]);
 assert.match(ui.html,/Player/);assert.match(ui.html,/No assessments have been recorded/);
 assert.doesNotMatch(ui.html,/ownAssessmentsTitle|profileAssessmentFilter/);
});

test('assessment order respects timestamps, explicit sort choice, and admin filter',()=>{
 const ui=fixture({user:null}),history=[{id:1,assessed_at:'2026-10-22T10:00:00Z',assessed_by:'Zed',total:1300},{id:2,assessed_at:'2026-10-22T11:00:00Z',assessed_by:'Amy',total:1500},{id:3,assessed_at:'2026-10-23',assessed_by:'Zed',total:1300}];
 const ids=(order,author='')=>Array.from(ui.context.profileAssessmentOrder(history,order,author),h=>h.id);
 assert.deepEqual(ids('newest'),[3,2,1]);assert.deepEqual(ids('oldest'),[1,2,3]);
 assert.deepEqual(ids('points-asc'),[3,1,2]);assert.deepEqual(ids('points-desc'),[2,3,1]);
 assert.deepEqual(ids('oldest','Zed'),[1,3]);assert.deepEqual(ids('newest','Absent'),[]);
 assert.deepEqual(history.map(h=>h.id),[1,2,3]);
});

test('single profile dropdown sorts, filters and keeps the admin flyout interactive',()=>{
 const ui=fixture({user:null}),cards={scrollLeft:100},count={},label={focus(){}};
 const makeButton=dataset=>({dataset,setAttribute(key,value){this[key]=value},focus(){}});
 const orders=['newest','oldest','points-asc','points-desc'].map(value=>makeButton({profileOrder:value}));
 const authors=['','Amy','Zed'].map(value=>makeButton({profileAuthor:value}));
 const submenuEvents={},events={},submenu={open:false,addEventListener(key,fn){submenuEvents[key]=fn},contains:()=>false,querySelector:key=>key==='button'?authors[0]:label};
 const filter={open:true,querySelector:()=>submenu,querySelectorAll:key=>key==='[data-profile-order]'?orders:authors,addEventListener(key,fn){events[key]=fn}};
 ui.context.document.querySelector=key=>({'#profileAssessmentFilter':filter,'#profileAssessmentFilterLabel':label,'#profileAssessmentCards':cards,'#profileAssessmentCount':count}[key]);
 ui.context.profileAssessmentCard=h=>`<article>${h.id}</article>`;
 ui.context.renderOwnProfile({username:'Player',id:'7'},{class_name:'Weaver',overall_tier:'S'},[{id:1,assessed_at:'2026-10-20',assessed_by:'Amy'},{id:2,assessed_at:'2026-10-21',assessed_by:'Zed'}]);
 assert.doesNotMatch(ui.html,/<select/);assert.match(ui.html,/profile-admin-submenu/);
 assert.equal(cards.innerHTML,'<article>2</article><article>1</article>');
 orders[1].onclick();assert.equal(cards.innerHTML,'<article>1</article><article>2</article>');assert.equal(filter.open,false);
 authors[1].onclick();assert.equal(cards.innerHTML,'<article>1</article>');assert.equal(count.textContent,'1 assessment');assert.equal(label.textContent,'Oldest first - Amy');assert.equal(cards.scrollLeft,0);
 authors[0].onclick();assert.equal(cards.innerHTML,'<article>1</article><article>2</article>');
 submenuEvents.pointerenter({pointerType:'mouse'});assert.equal(submenu.open,true);
 submenuEvents.pointerleave({pointerType:'mouse'});assert.equal(submenu.open,false);
 submenuEvents.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(submenu.open,true);
 events.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(submenu.open,false);
});



test('expanded profile cards show attributes and notes without repeating assessment metadata',()=>{
 const ui=fixture({user:null});ui.context.A=[['control','CTRL','Control']];ui.context.date=value=>value;ui.context.tier=()=> 'A';ui.context.cardTierBadge=()=>'<span>A</span>';
 const html=ui.context.profileAssessmentCard({id:7,assessed_at:'2026-10-23',overall_tier:'A',total:1400,control:230,class_name:'Weaver',assessed_by:'Admin',strengths:'Close <control>'});
 assert.equal((html.match(/Assessed by/g)||[]).length,1);assert.equal((html.match(/2026-10-23/g)||[]).length,1);
 assert.match(html,/profile-attribute-list/);assert.match(html,/230/);assert.match(html,/Close &lt;control&gt;/);assert.match(html,/Hide assessment/);
});


test('avatar supplies escaped skin data to the local renderer with an initial fallback',()=>{
 const ui=fixture({user:null});
 assert.doesNotMatch(ui.context.accountAvatar({username:'Player'}),/<img/);
 const html=ui.context.accountAvatar({username:'Player',avatar_code:'skin&code="test"'});
 assert.match(html,/account-avatar-initial/);assert.match(html,/data-bonk-avatar/);assert.match(html,/data-bonk-skin="skin&amp;code=&quot;test&quot;"/);assert.doesNotMatch(html,/https?:/);
 assert.doesNotMatch(html,/onerror=|onload=/);
});


test('public profile opens the requested player rather than the signed-in account',async()=>{
 const ui=fixture({user:{username:'Signed in',id:'1'}});let profile;
 ui.context.api=async path=>{assert.equal(path,'/api/players/player%20id');return {player:{id:'player id',name:'Other player'},profile:{avatar_code:'public-skin'},history:[{id:8}]}};
 ui.context.renderOwnProfile=(user,record,history)=>{profile={user,record,history}};
 await ui.context.publicPlayerProfile('player id');assert.equal(profile.user.username,'Other player');assert.equal(profile.user.id,undefined);assert.equal(profile.user.avatar_code,'public-skin');assert.equal(profile.history[0].id,8);
});
