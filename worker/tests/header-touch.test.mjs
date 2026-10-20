import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('touch controls capture one pointer, release cleanly and leave navigation taps alone',()=>{
 const listeners={},windowListeners={},capture=new Set();
 const header={addEventListener:(name,handler)=>listeners[name]=handler,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700}),setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)};
 const ctx=vm.createContext({document:{querySelector:key=>key==='#headerPitch'?{getContext:()=>({})}:header,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener:(name,handler)=>windowListeners[name]=handler},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}}});
 vm.runInContext(readFileSync(new URL('../../football-background.js',import.meta.url),'utf8'),ctx);
 ctx.refreshPitch=()=>{};
 const event=(id,x,y,control=false)=>({pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,target:{closest:()=>control?{}:null},preventDefault(){this.prevented=true}});
 const down=event(1,200,300);listeners.pointerdown(down);
 assert.equal(down.prevented,true);assert.equal(capture.has(1),true);
 const move=event(1,600,500);listeners.pointermove(move);
 assert.equal(vm.runInContext('pitchPointer.x',ctx),600);
 listeners.pointermove(event(2,900,600));assert.equal(vm.runInContext('pitchPointer.x',ctx),600);
 listeners.pointerleave();assert.equal(vm.runInContext('pitchTouchId',ctx),1);
 windowListeners.pointerup(event(1,600,500));assert.equal(vm.runInContext('pitchPointer',ctx),null);assert.equal(vm.runInContext('pitchPressed',ctx),false);assert.equal(capture.size,0);
 const button=event(3,200,300,true);listeners.pointerdown(button);assert.equal(button.prevented,undefined);assert.equal(capture.size,0);
 listeners.pointerdown(event(4,200,300));listeners.pointercancel(event(4,200,300));assert.equal(capture.size,0);
});
