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
test('account dropdown displays an escaped initial and username, and only offers logout',()=>{
 const ui=fixture({user:null}),button={},menu={addEventListener(){}};let markup='';
 const container={set innerHTML(value){markup=value},querySelector:selector=>selector==='details'?menu:button};
 ui.context.document.querySelectorAll=()=>[container];
 ui.context.updateAccountMenus({username:'<Player>'});
 assert.match(markup,/account-avatar[^>]*>&lt;<\/span>/);assert.match(markup,/&lt;Player&gt;/);assert.match(markup,/>Log out<\/button>/);
 assert.equal((markup.match(/<button/g)||[]).length,1);assert.equal(typeof button.onclick,'function');
});
