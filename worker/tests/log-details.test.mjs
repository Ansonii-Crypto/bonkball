import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
const ctx=vm.createContext({A:[['control','CTRL','Control']],date:x=>x,esc:x=>String(x).replaceAll('<','&lt;')});
vm.runInContext(source.slice(source.indexOf('function logChangeDetails('),source.indexOf('async function logs(')),ctx);

test('log buttons only appear on recorded edits and show changed values safely',()=>{
 const base={id:1,action:'updated_player',player_name:'Test',created_at:'2026-10-17',assessment_id:1};
 assert.ok(!ctx.logRow(base).includes('More information'));
 const log={...base,assessment_changes:JSON.stringify({before:{control:100,playstyle:'old',class_name:'Weaver'},after:{control:150,playstyle:'<new>',class_name:'Weaver'}})};
 const html=ctx.logRow(log);
 assert.match(html,/More information/);assert.match(html,/100/);assert.match(html,/150/);assert.match(html,/&lt;new>/);assert.ok(!html.includes('<dt>Class</dt>'));
 assert.ok(!ctx.logRow({...log,action:'created_player'}).includes('More information'));
});

test('opening a log closes its neighbour and clicking it again closes it',()=>{
 const panels={one:{hidden:true},two:{hidden:true}};
 const button=id=>({expanded:'false',textContent:'More information',getAttribute(key){return key==='aria-controls'?id:this.expanded},setAttribute(key,value){this.expanded=String(value)}});
 const buttons=[button('one'),button('two')];
 const container={contains:()=>true,querySelectorAll:()=>buttons,querySelector:key=>panels[key.slice(1)]};
 ctx.wireLogDetails(container);
 const click=b=>container.onclick({target:{closest:()=>b}});
 click(buttons[0]);assert.equal(panels.one.hidden,false);
 click(buttons[1]);assert.equal(panels.one.hidden,true);assert.equal(panels.two.hidden,false);
 click(buttons[1]);assert.equal(panels.two.hidden,true);
});
