// Local Bonk skin decoder and vector renderer. No external runtime dependencies.
(()=>{
 'use strict';
 const MAX_CODE=20000,MAX_LAYERS=16;
 const color=value=>{if(!Number.isInteger(value)||value<0||value>0xffffff)throw Error('Invalid skin colour');return '#'+value.toString(16).padStart(6,'0')};
 function normalize(skin){
  if(!skin||typeof skin!=='object'||!Array.isArray(skin.layers)||skin.layers.length>MAX_LAYERS)throw Error('Invalid skin');
  const bc=skin.bc??skin.baseColour;color(bc);
  const layers=skin.layers.map(layer=>{
   if(!layer||!Number.isInteger(layer.id)||layer.id<1||layer.id>115)throw Error('Unknown skin shape');
   color(layer.color);
   for(const key of ['scale','angle','x','y'])if(typeof layer[key]!=='number'||!Number.isFinite(layer[key]))throw Error('Invalid skin transform');
   if(layer.scale<0||layer.scale>100||Math.abs(layer.angle)>100000||Math.abs(layer.x)>10000||Math.abs(layer.y)>10000)throw Error('Skin transform outside limits');
   for(const key of ['flipX','flipY'])if(typeof layer[key]!=='boolean')throw Error('Invalid skin flip');
   return {id:layer.id,color:layer.color,scale:layer.scale,angle:layer.angle,x:layer.x,y:layer.y,flipX:layer.flipX,flipY:layer.flipY};
  });
  return {bc,layers};
 }
 function decode(code){
  if(typeof code!=='string'||!code||code.length>MAX_CODE)throw Error('Invalid skin code');
  let text=code.trim();for(let i=0;i<2&&/%[0-9a-f]{2}/i.test(text);i++)text=decodeURIComponent(text);
  if(text.startsWith('{'))return normalize(JSON.parse(text));
  const binary=atob(text),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0)),view=new DataView(bytes.buffer);let offset=0;
  function read(size,get){if(offset+size>bytes.length)throw Error('Truncated skin');const value=view[get](offset,false);offset+=size;return value}
  const u8=()=>read(1,'getUint8'),u16=()=>read(2,'getUint16'),u32=()=>read(4,'getUint32'),float=()=>read(4,'getFloat32');
  function expect(...values){for(const value of values)if(u8()!==value)throw Error('Unsupported skin encoding')}
  expect(10,7,3,97);if(u16()!==2)throw Error('Unsupported skin version');expect(9);
  const countByte=u8(),count=(countByte-1)/2;if(!(countByte&1)||count>MAX_LAYERS)throw Error('Invalid layer count');expect(1);
  const layers=[];
  for(let i=0;i<count;i++){
   expect(10);if(i===0)expect(7,5,97,108);else expect(5);
   if(u16()!==1)throw Error('Unsupported layer version');
   const id=u16(),scale=float(),angle=float(),x=float(),y=float(),flipX=u8(),flipY=u8(),paint=u32();
   if(flipX>1||flipY>1)throw Error('Invalid layer flags');
   layers.push({id,scale,angle,x,y,flipX:!!flipX,flipY:!!flipY,color:paint});
  }
  const bc=u32();if(offset!==bytes.length)throw Error('Unexpected skin data');return normalize({bc,layers});
 }
 function toSVG(input,shapes){
  const skin=normalize(input),ids=[...new Set(skin.layers.map(layer=>layer.id))];
  const definitions=ids.map(id=>{
   const shape=Object.hasOwn(shapes,String(id))?shapes[id]:null;
   if(!shape||!Number.isFinite(shape.cx)||!Number.isFinite(shape.cy)||typeof shape.svg!=='string')throw Error('Missing shape asset');
   // Geometry is exclusively from the site's vetted static bundle, never skin JSON.
   return `<g id="shape-${id}" transform="translate(${-shape.cx} ${-shape.cy})">${shape.svg}</g>`;
  }).join('');
  const layers=skin.layers.slice().reverse().map(layer=>`<use href="#shape-${layer.id}" transform="translate(${layer.x} ${layer.y}) rotate(${layer.angle}) scale(${layer.scale*(layer.flipX?-1:1)} ${layer.scale*(layer.flipY?-1:1)})" color="${color(layer.color)}" fill="currentColor"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="-15 -15 30 30"><defs><clipPath id="avatar-boundary"><circle r="15"/></clipPath>${definitions}</defs><g clip-path="url(#avatar-boundary)"><circle r="15" fill="${color(skin.bc)}"/>${layers}</g><circle r="14.9" fill="none" stroke="#303630" stroke-width="0.2"/></svg>`;
 }
 const assetURL=new URL('./assets/skins/shapes.json',document.currentScript?.src||document.baseURI);
 let assetPromise;const cache=new Map();
 async function imageURL(code){
  if(cache.has(code))return cache.get(code);
  const skin=decode(code);
  if(!assetPromise)assetPromise=fetch(assetURL,{credentials:'omit'}).then(response=>{if(!response.ok)throw Error('Shapes unavailable');return response.json()}).then(data=>{if(data.version!==1||!data.shapes)throw Error('Unsupported shape bundle');return data.shapes}).catch(error=>{assetPromise=null;throw error});
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(toSVG(skin,await assetPromise));
  if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(code,url);return url;
 }
 const started=new WeakSet();
 function hydrate(node){
  if(node.nodeType!==1)return;
  const images=node.matches('img[data-bonk-skin]')?[node]:node.querySelectorAll('img[data-bonk-skin]');
  for(const img of images){if(started.has(img))continue;started.add(img);const code=img.getAttribute('data-bonk-skin');img.removeAttribute('data-bonk-skin');imageURL(code).then(url=>{if(img.isConnected)img.src=url}).catch(()=>img.remove())}
 }
 window.BonkSkinRenderer={decode,toSVG,imageURL};
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)hydrate(node)}).observe(document.body,{childList:true,subtree:true});
 hydrate(document.body);
})();
