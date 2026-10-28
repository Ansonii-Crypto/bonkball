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
 const ctx=vm.createContext({window:{},document:doc,location:{hash:'#/'},ResizeObserver:class{observe(){}},addEventListener(){},V:{focus(){}},home:async()=>calls.push('players'),classesPage:()=>calls.push('classes'),admin:async()=>calls.push('admin'),accountPage:async()=>calls.push('account'),ownProfile:async()=>calls.push('own-profile'),publicPlayerProfile:async id=>calls.push('public-profile:'+id),player:async(id,assessmentId)=>calls.push('profile:'+id+(assessmentId?':'+assessmentId:'')),openSetupLink:async hash=>calls.push('setup:'+hash),matchMedia:()=>({matches:true})});
 const source=readFileSync(new URL('../../homepage.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('const recentList=')),ctx);
 await ctx.navigateSite('#/players');assert.ok(calls.includes('players'));assert.equal(scroller.style.visibility,'hidden');
 await ctx.navigateSite('#/classes');assert.equal(calls.at(-1),'classes');
 await ctx.navigateSite('#/profile/player%20id');assert.equal(calls.at(-1),'public-profile:player id');
 await ctx.navigateSite('#/profile');assert.equal(calls.at(-1),'own-profile');
 await ctx.navigateSite('#/account');assert.equal(calls.at(-1),'account');
 await ctx.navigateSite('#/admin');assert.equal(calls.at(-1),'admin');
 await ctx.navigateSite('#/player/live-player/assessment/7');assert.equal(calls.at(-1),'profile:live-player:7');
 await ctx.navigateSite('#/player/live-player');assert.equal(calls.at(-1),'profile:live-player');
 await ctx.navigateSite('#/setup?account=test&invite=test');assert.match(calls.at(-1),/^setup:/);
 await ctx.navigateSite('#/');assert.equal(surface.inert,true);assert.equal(scroller.inert,false);assert.equal(scroller.style.visibility,'');
});


test('assessment links select that assessment rather than always selecting the latest',()=>{
 const source=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
 const elements={};for(const key of ['#mainAssessment','#openAssessmentHistory','#returnLatestAssessment','#assessmentSelectionSummary','#profileOverall','#profileClass','#assessmentPlaystyle','#assessmentComments'])elements[key]={};
 const context=vm.createContext({document:{querySelector:key=>elements[key]},assessmentDetails:h=>'Assessment '+h.id,assessmentPlaystyle:()=>'',date:value=>value,commentThreadHTML:(_player,id)=>'Thread '+id,mountCommentThreads(){}});
 vm.runInContext(source.split('\n').find(line=>line.startsWith('function assessmentOrder(')),context);
 vm.runInContext(source.slice(source.indexOf('function wireAssessmentHistory('),source.indexOf('function assessmentPlaystyle(')),context);
 context.wireAssessmentHistory([{id:1,player_id:'p',assessed_at:'2026-10-20',overall_tier:'A'},{id:2,player_id:'p',assessed_at:'2026-10-21',overall_tier:'S'}],null,1);
 assert.match(elements['#mainAssessment'].innerHTML,/Selected assessment/);assert.match(elements['#mainAssessment'].innerHTML,/Assessment 1/);assert.equal(elements['#profileOverall'].textContent,'A');
 assert.doesNotMatch(elements['#mainAssessment'].innerHTML,/Thread|assessment-comments/);assert.match(elements['#assessmentComments'].innerHTML,/comment-panel/);assert.match(elements['#assessmentComments'].innerHTML,/Thread 1/);
 elements['#returnLatestAssessment'].onclick();assert.match(elements['#assessmentComments'].innerHTML,/Thread 2/);
});


test('fullscreen shortcuts do not convert pointer focus into keyboard focus',()=>{
 const handlers={},dataset={};
 const context=vm.createContext({document:{documentElement:{dataset},addEventListener:(type,handler)=>{handlers[type]=handler}}});
 vm.runInContext(readFileSync(new URL('../../focus.js',import.meta.url),'utf8'),context);
 handlers.pointerdown();assert.equal(dataset.focusInput,'pointer');handlers.keydown({key:'F11'});assert.equal(dataset.focusInput,'pointer');
 handlers.keydown({key:'Tab'});assert.equal(dataset.focusInput,'keyboard');handlers.keydown({key:'F11'});assert.equal(dataset.focusInput,'keyboard');
 handlers.pointerdown();assert.equal(dataset.focusInput,'pointer');handlers.keydown({key:'ArrowDown'});assert.equal(dataset.focusInput,'keyboard');
});
