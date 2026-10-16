import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('temporary save accepts incomplete forms; Push saves then publishes the draft',async()=>{
 const source=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function wireForm('),source.indexOf('\nasync function edit(',source.indexOf('function wireForm(')));
 const temporary={},submit={},status={},error={},events=[];
 const data={name:'Draft',overall_tier:''};
 const form={isConnected:true,querySelector(selector){return {'[data-save-draft]':temporary,'button[type="submit"]':submit,'[data-draft-status]':status,'[data-tier-error]':error,'[data-assessment-tier]':{focus(){}}}[selector]||null}};
 const context=vm.createContext({document:{querySelector:()=>form},wireTierSelect(){},wireAutomaticTier(){data.overall_tier='F'},A:[],FormData:class{constructor(){return Object.entries(data)}},
  savePlayerDraft:async(form,state)=>{events.push('save draft');state.id='draft-id';state.revision=2},
  api:async(path,options)=>{events.push(path);assert.equal(JSON.parse(options.body).revision,2)},
  msg(){},adminTab:()=>events.push('players tab')});
 vm.runInContext(code,context);
 context.wireForm(null,null,false,{});
 await temporary.onclick();
 assert.deepEqual(events,['save draft']);
 assert.match(status.textContent,/Other admins/);
 await temporary.onclick();
 assert.equal(status.textContent,'Draft changes saved.');
 data.overall_tier='S';
 await form.onsubmit({preventDefault(){}});
 assert.deepEqual(events,['save draft','save draft','save draft','/api/player-drafts/draft-id/push','players tab']);
});

test('other admins preview read-only; authors can confirm or cancel discarding',async()=>{
 const controls=[{},{}],actions={hidden:false,prepend(button){this.discard=button}},heading={textContent:'Draft by Author'},submit={disabled:false};
 const form={isConnected:true,querySelectorAll:()=>controls,querySelector:key=>key==='.new-player-actions'?actions:submit};
 const container={querySelector:key=>key==='#pf'?form:key==='.draft-heading p'?heading:{}};
 let allowed=false,calls=[];
 const context=vm.createContext({adminViewVersion:0,document:{querySelector:()=>container,createElement:()=>({})},esc:String,form:()=>'',wireForm(){},wireAutomaticTier(){},appConfirm:async()=>allowed,msg(){},api:async(path,options)=>calls.push([path,options.method])});
 vm.runInContext(readFileSync(new URL('../../drafts.js',import.meta.url),'utf8'),context);
 context.newPlayerPage=async()=>{};
 const draft={id:'saved',owner_id:'author',owner_name:'Author',revision:1,data:{}};
 context.openPlayerDraft(draft,'viewer');
 assert.ok(controls.every(control=>control.disabled));assert.equal(actions.hidden,true);assert.match(heading.textContent,/Read-only/);assert.equal(actions.discard,undefined);
 context.openPlayerDraft(draft,'author');
 assert.equal(actions.discard.className,'danger');
 await actions.discard.onclick();assert.equal(calls.length,0);
 allowed=true;await actions.discard.onclick();assert.deepEqual(calls,[['/api/player-drafts/saved','DELETE']]);
});


test('automatic new-player tiers use six attributes and update on input',()=>{
 const source=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
 const tierLine=source.split('\n').find(line=>line.startsWith('const tier='));
 const helper=source.slice(source.indexOf('function calculatedPlayerTier('),source.indexOf('function form('));
 const keys=['control','execution','defending','reaction_time','chemistry','game_sense'];
 const fields=Object.fromEntries(keys.map(key=>[key,{value:'256',addEventListener(event,handler){this.update=handler}}]));
 const input={},buttons='SABCDEF'.split('').map(rank=>({dataset:{assessmentTier:rank},setAttribute(key,value){this[key]=value}}));
 const ctx=vm.createContext({A:keys.map(key=>[key])});vm.runInContext(tierLine+'\n'+helper,ctx);
 for(const [score,expected] of [[0,'F'],[43,'E'],[86,'D'],[129,'C'],[172,'B'],[215,'A'],[256,'A'],[257,'S'],[300,'S']])assert.equal(ctx.calculatedPlayerTier(Object.fromEntries(keys.map(key=>[key,score]))),expected);
 const form={querySelector(selector){if(selector==='[name="overall_tier"]')return input;return fields[selector.match(/name="([^"]+)"/)[1]]},querySelectorAll:()=>buttons};
 ctx.wireAutomaticTier(form);assert.equal(input.value,'A');
 for(const field of Object.values(fields))field.value='257';fields.control.update();assert.equal(input.value,'S');assert.equal(buttons.filter(b=>b['aria-pressed']).length,1);
});
