import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=readFileSync(new URL('../../skin-renderer.js',import.meta.url),'utf8');
const bundle=JSON.parse(readFileSync(new URL('../../assets/skins/shapes.json',import.meta.url),'utf8'));
function renderer(fetch=async()=>Response.json(bundle)){
 const context=vm.createContext({window:{},document:{currentScript:{src:'https://bonk-critic.com/skin-renderer.js'},body:{nodeType:1,matches:()=>false,querySelectorAll:()=>[]}},URL,Uint8Array,DataView,atob,fetch,MutationObserver:class{observe(){}}});
 vm.runInContext(source,context);return context.window.BonkSkinRenderer;
}
const sample={bc:0xabcdef,layers:[{id:13,color:0xff0000,scale:0.2,angle:90,x:2,y:-3,flipX:true,flipY:false}]};
function binarySkin(skin){
 const bytes=[];const byte=n=>bytes.push(n),short=n=>bytes.push(n>>8,n&255),word=n=>bytes.push(n>>>24,(n>>>16)&255,(n>>>8)&255,n&255),float=n=>{const value=Buffer.alloc(4);value.writeFloatBE(n);bytes.push(...value)};
 bytes.push(10,7,3,97);short(2);bytes.push(9,skin.layers.length*2+1,1);
 skin.layers.forEach((layer,i)=>{byte(10);bytes.push(...(i===0?[7,5,97,108]:[5]));short(1);short(layer.id);for(const key of ['scale','angle','x','y'])float(layer[key]);byte(+layer.flipX);byte(+layer.flipY);word(layer.color)});word(skin.bc);
 return Buffer.from(bytes).toString('base64');
}
test('decodes JSON and raw, encoded and double-encoded Bonk skin codes',()=>{
 const api=renderer(),json=JSON.stringify(sample);assert.deepEqual(JSON.parse(JSON.stringify(api.decode(json))),sample);
 const code=binarySkin(sample);
 for(const text of [code,encodeURIComponent(code),encodeURIComponent(encodeURIComponent(code))]){
  const result=api.decode(text);assert.equal(result.bc,sample.bc);assert.equal(result.layers[0].id,13);assert.ok(Math.abs(result.layers[0].scale-0.2)<0.00001);assert.equal(result.layers[0].flipX,true);
 }
 assert.equal(api.decode(binarySkin({bc:0,layers:[]})).layers.length,0);
});
test('malformed, oversized and untrusted skin values are rejected',()=>{
 const api=renderer();
 for(const value of ['', 'x'.repeat(20001), 'invalid!', '%ZZ', JSON.stringify({...sample,layers:[{...sample.layers[0],id:999}]}),JSON.stringify({...sample,bc:'<script>'}),JSON.stringify({...sample,layers:Array(17).fill(sample.layers[0])}),binarySkin(sample).slice(0,-8)])assert.throws(()=>api.decode(value));
 assert.throws(()=>api.toSVG({...sample,layers:[{...sample.layers[0],x:Infinity}]},bundle.shapes));
 assert.throws(()=>api.toSVG({...sample,layers:[{...sample.layers[0],scale:'1) url(https://evil)'}]},bundle.shapes));
});
test('composes locally bundled shapes with transforms, colours and circular clipping',()=>{
 const api=renderer(),svg=api.toSVG(sample,bundle.shapes);
 assert.match(svg,/viewBox="-15 -15 30 30"/);assert.match(svg,/fill="#abcdef"/);assert.match(svg,/color="#ff0000"/);
 assert.match(svg,/translate\(2 -3\) rotate\(90\) scale\(-0.2 0.2\)/);assert.match(svg,/clip-path="url\(#avatar-boundary\)"/);
 assert.equal((svg.match(/id="shape-13"/g)||[]).length,1);
 assert.throws(()=>api.toSVG(sample,{}));
 assert.doesNotMatch(svg,/<script|onload=|https:\/\//i);
});
test('all 115 shapes are bundled as vectors without external references or scripts',()=>{
 assert.equal(Object.keys(bundle.shapes).length,115);
 for(let id=1;id<=115;id++){
  const shape=bundle.shapes[id];assert.ok(Number.isFinite(shape.cx)&&Number.isFinite(shape.cy));assert.ok(shape.svg.length);
  assert.doesNotMatch(shape.svg,/<script|<image|<foreignObject|\bon\w+=|https?:|(?:href|src)=/i);
 }
});
test('assets and rendered avatars are cached and fetched only from this site',async()=>{
 let calls=0;const api=renderer(async url=>{calls++;assert.equal(String(url),'https://bonk-critic.com/assets/skins/shapes.json');return Response.json(bundle)});
 const code=JSON.stringify(sample),first=await api.imageURL(code),second=await api.imageURL(code);
 assert.equal(first,second);assert.match(first,/^data:image\/svg\+xml/);assert.equal(calls,1);
 await api.imageURL(JSON.stringify({...sample,bc:0}));assert.equal(calls,1);
});
test('a failed asset fetch can recover without reloading the page',async()=>{
 let calls=0;const api=renderer(async()=>{if(++calls===1)throw Error('Offline');return Response.json(bundle)});
 await assert.rejects(api.imageURL(JSON.stringify(sample)));assert.match(await api.imageURL(JSON.stringify(sample)),/^data:image/);assert.equal(calls,2);
});
