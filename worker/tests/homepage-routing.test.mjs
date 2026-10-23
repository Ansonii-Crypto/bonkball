import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('homepage shell routes real players, profiles, classes, admin and setup',async()=>{
 const calls=[];
 const style={setProperty(){}};
 const header={style,getBoundingClientRect:()=>({height:800,bottom:800})};
 const scroller={scrollTop:0,style,addEventListener(){},getBoundingClientRect:()=>({top:0}),scrollTo(){}};
 const destinationHeader={style:{},getBoundingClientRect:()=>({height:76})};
 const surface={style:{},dataset:{},classList:{add(){},remove(){}},querySelector:key=>key==='.surface-scroll'?scroller:destinationHeader,querySelectorAll:()=>[]};
 const doc={body:{},querySelector:key=>key==='#appSurface'?surface:key==='.homepage-header'?header:key==='#scrollArea'?scroller:{addEventListener(){}},querySelectorAll:()=>[]};
 const ctx=vm.createContext({window:{},document:doc,location:{hash:'#/'},ResizeObserver:class{observe(){}},addEventListener(){},V:{focus(){}},home:async()=>calls.push('players'),classesPage:()=>calls.push('classes'),admin:async()=>calls.push('admin'),accountPage:async()=>calls.push('account'),ownProfile:async()=>calls.push('own-profile'),publicPlayerProfile:async id=>calls.push('public-profile:'+id),player:async id=>calls.push('profile:'+id),openSetupLink:async hash=>calls.push('setup:'+hash),matchMedia:()=>({matches:true})});
 const source=readFileSync(new URL('../../homepage.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('const recentList=')),ctx);
 await ctx.navigateSite('#/players');assert.ok(calls.includes('players'));
 await ctx.navigateSite('#/classes');assert.equal(calls.at(-1),'classes');
 await ctx.navigateSite('#/profile/player%20id');assert.equal(calls.at(-1),'public-profile:player id');
 await ctx.navigateSite('#/profile');assert.equal(calls.at(-1),'own-profile');
 await ctx.navigateSite('#/account');assert.equal(calls.at(-1),'account');
 await ctx.navigateSite('#/admin');assert.equal(calls.at(-1),'admin');
 await ctx.navigateSite('#/player/live-player');assert.equal(calls.at(-1),'profile:live-player');
 await ctx.navigateSite('#/setup?account=test&invite=test');assert.match(calls.at(-1),/^setup:/);
 await ctx.navigateSite('#/');assert.equal(surface.inert,true);assert.equal(scroller.inert,false);
});
