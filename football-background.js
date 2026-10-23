// Decorative, locally rendered football scene. No game or external assets loaded.
const pitchCanvas=document.querySelector('#headerPitch');
const pitchHeader=document.querySelector('.homepage-header');
const pitchContext=pitchCanvas.getContext('2d');
const pitchMotion=matchMedia('(prefers-reduced-motion: reduce)');
let pitchWidth=1,pitchHeight=1,pitchFrame=null,pitchVisible=true;
let pitchPointer=null,pitchBlue=null,pitchPressed=false;
let pitchLastFrame=null,pitchTime=0;
let pitchRed=null,pitchBall=null,pitchSelectedTeam='blue';
const pitchImpacts=[];

function pitchCircle(x,y,r,fill,stroke,width=2){
 const c=pitchContext;c.beginPath();c.arc(x,y,r,0,Math.PI*2);
 if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}
}
function drawPitchPlayer(x,y,r,team,fill,highlight=0){
 const c=pitchContext;
 c.save();c.shadowColor=`rgb(255 255 255 / ${highlight})`;c.shadowBlur=highlight*16;
 pitchCircle(x,y,r,fill);
 pitchCircle(x,y,r+1.5,null,highlight>0?'#ffffff':team,3);c.restore();
}
function paintPitch(milliseconds=0){
 const dt=pitchLastFrame===null?0:Math.min(Math.max(0,milliseconds-pitchLastFrame),50)/1000;
 pitchLastFrame=milliseconds;if(!pitchMotion.matches)pitchTime+=dt;
 const time=pitchTime,c=pitchContext,w=pitchWidth,h=pitchHeight;
 c.clearRect(0,0,w,h);c.fillStyle='#739a7d';c.fillRect(0,0,w,h);
 const margin=Math.min(w,h)*.075,left=margin,top=margin,right=w-margin,bottom=h-margin;
 const fw=right-left,fh=bottom-top;
 c.save();c.beginPath();c.rect(left,top,fw,fh);c.clip();
 for(let i=-h;i<w+h;i+=110){c.fillStyle='#ffffff07';c.beginPath();c.moveTo(i,top);c.lineTo(i+65,top);c.lineTo(i+65+h,bottom);c.lineTo(i+h,bottom);c.closePath();c.fill()}
 c.restore();c.strokeStyle='#ffffff55';c.lineWidth=1.5;c.strokeRect(left,top,fw,fh);
 c.beginPath();c.moveTo(w/2,top);c.lineTo(w/2,bottom);c.stroke();
 pitchCircle(w/2,h/2,Math.min(fh*.18,fw*.12),null,'#ffffff55',1.5);
 const goalHeight=fh*.48,goalWidth=fw*.085;
 c.strokeRect(left, h/2-goalHeight/2,goalWidth,goalHeight);
 c.strokeRect(right-goalWidth,h/2-goalHeight/2,goalWidth,goalHeight);
 for(const post of pitchGoalPosts({left,top,right,bottom}))pitchCircle(post.x,post.y,post.radius-1,post.x===left?'#6bb7fc':'#ed7777','#ffffffa0',2);
 const radius=Math.max(11,Math.min(22,w*.017));
 updatePitchPhysics(pitchMotion.matches?0:dt,{left,top,right,bottom},radius);
 const highlight=pitchPressed?1:0;
 drawPitchPlayer(pitchBlue.x,pitchBlue.y,radius,'#55a5ee','#367bae',pitchSelectedTeam==='blue'?highlight:0);
 drawPitchPlayer(pitchRed.x,pitchRed.y,radius,'#e77572','#be4e4d',pitchSelectedTeam==='red'?highlight:0);
 c.save();c.shadowColor='#24412b30';c.shadowBlur=8;c.shadowOffsetY=3;
 pitchCircle(pitchBall.x,pitchBall.y,radius*.44,'#ffffff','#ffffffc0',1);c.restore();
 for(let i=pitchImpacts.length-1;i>=0;i--){const impact=pitchImpacts[i],age=time-impact.time;if(age>.4){pitchImpacts.splice(i,1);continue}pitchCircle(impact.x,impact.y,8+age*(impact.heavy?100:65),null,`rgb(255 255 255 / ${(1-age/.4)*.7})`,impact.heavy?3:2)}
 pitchCircle(w/2,h/2,2,'#ffffff70');
}
const pitchBallSpeedLimit=560;
function kickPitchBall(ball,nx,ny){
 const speed=Math.hypot(ball.vx,ball.vy);
 const alignment=speed?Math.max(-1,Math.min(1,(ball.vx*nx+ball.vy*ny)/speed)):0;
 // Preserve momentum along the kick; a sharp turn carries only 20% of it.
 const retained=.2+.8*Math.pow(Math.max(0,alignment),2);
 const kickedSpeed=Math.min(pitchBallSpeedLimit,280+speed*retained);
 ball.vx=nx*kickedSpeed;ball.vy=ny*kickedSpeed;
}
function pitchGoalPosts(bounds){
 const centreY=(bounds.top+bounds.bottom)/2,offset=(bounds.bottom-bounds.top)*.24;
 const radius=Math.max(7,Math.min(11,(bounds.right-bounds.left)*.009))+1;
 return [bounds.left,bounds.right].flatMap(x=>[centreY-offset,centreY+offset].map(y=>({x,y,radius,inward:x===bounds.left?1:-1})));
}
function resolvePitchPost(body,radius,post,restitution,useMovement=false){
 const dx=body.x-post.x,dy=body.y-post.y,distance=Math.hypot(dx,dy),minimum=radius+post.radius;
 if(distance>=minimum)return false;
 const nx=distance?dx/distance:post.inward,ny=distance?dy/distance:0;
 body.x=post.x+nx*(minimum+.01);body.y=post.y+ny*(minimum+.01);
 const approach=(useMovement?body.moveX||0:body.vx)*nx+(useMovement?body.moveY||0:body.vy)*ny;
 if(approach<0){const impulse=(1+restitution)*approach;
  body.vx-=impulse*nx;body.vy-=impulse*ny;
  if(useMovement){body.moveX-=impulse*nx;body.moveY-=impulse*ny}
 }
 return true;
}
function applyPitchBallKnockback(body,ball,nx,ny,ballRadius,playerRadius,closingSpeed){
 // Equal-density circles: relative mass follows their visible area.
 const incoming=Math.max(0,-(ball.vx*nx+ball.vy*ny));
 const impact=Math.min(incoming,Math.max(0,closingSpeed));
 if(!impact)return;
 const massRatio=(ballRadius/playerRadius)**2;
 const transfer=Math.min(120,impact*1.2*massRatio/(1+massRatio));
 body.vx-=nx*transfer;body.vy-=ny*transfer;
 const speed=Math.hypot(body.vx,body.vy);
 if(speed>145){body.vx*=145/speed;body.vy*=145/speed}
}
function updatePitchPhysics(dt,bounds,radius){
 const w=pitchWidth,h=pitchHeight,ballRadius=radius*.44,bodyRadius=radius;
 if(!pitchBlue)pitchBlue={x:w*.25,y:h*.31,vx:0,vy:0,kickAt:-1};
 if(!pitchRed)pitchRed={x:w*.79,y:h*.7,vx:0,vy:0,kickAt:-1};
 if(!pitchBall)pitchBall={x:w*.48,y:h*.64,vx:42,vy:0};
 const posts=pitchGoalPosts(bounds);
 const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const keepInside=(body,r)=>{body.x=clamp(body.x,bounds.left+r,bounds.right-r);body.y=clamp(body.y,bounds.top+r,bounds.bottom-r)};
 for(let i=0;i<steps;i++){
  for(const [body,targetX,targetY,tau] of [
   [pitchBlue,pitchPointer&&pitchSelectedTeam==='blue'?pitchPointer.x:w*.25+Math.sin(pitchTime*.23)*w*.035,pitchPointer&&pitchSelectedTeam==='blue'?pitchPointer.y:h*.31+Math.cos(pitchTime*.3)*h*.04,pitchPointer&&pitchSelectedTeam==='blue' ? .7 : 2.8],
   [pitchRed,pitchPointer&&pitchSelectedTeam==='red'?pitchPointer.x:w*.76+Math.cos(pitchTime*.27)*w*.03,pitchPointer&&pitchSelectedTeam==='red'?pitchPointer.y:h*.7+Math.sin(pitchTime*.32)*h*.04,pitchPointer&&pitchSelectedTeam==='red' ? .7 : 2.8]
  ]){
   const oldX=body.x,oldY=body.y,ease=1-Math.exp(-step/tau);
   let dx=(targetX-body.x)*ease,dy=(targetY-body.y)*ease;
   const length=Math.hypot(dx,dy),limit=220*step;if(length>limit){dx*=limit/length;dy*=limit/length}
   body.x+=dx+body.vx*step;body.y+=dy+body.vy*step;keepInside(body,bodyRadius);
   body.moveX=step?(body.x-oldX)/step:0;body.moveY=step?(body.y-oldY)/step:0;
   for(let pass=0;pass<3;pass++){for(const post of posts)resolvePitchPost(body,bodyRadius,post,.85,true);keepInside(body,bodyRadius)}
   body.moveX=step?(body.x-oldX)/step:0;body.moveY=step?(body.y-oldY)/step:0;
   body.vx*=Math.exp(-step*4);body.vy*=Math.exp(-step*4);
  }
  // Equal, gentle separation allows either player to nudge the other.
  let dx=pitchRed.x-pitchBlue.x,dy=pitchRed.y-pitchBlue.y,distance=Math.hypot(dx,dy),spacing=bodyRadius*2;
  if(distance<spacing){const nx=distance?dx/distance:1,ny=distance?dy/distance:0,overlap=spacing-distance;
   pitchBlue.x-=nx*overlap*.5;pitchBlue.y-=ny*overlap*.5;pitchRed.x+=nx*overlap*.5;pitchRed.y+=ny*overlap*.5;
   const closing=(pitchBlue.moveX-pitchRed.moveX)*nx+(pitchBlue.moveY-pitchRed.moveY)*ny;
   const nudge=Math.min(30,Math.max(0,closing)*.12);
   pitchBlue.vx=clamp(pitchBlue.vx-nx*nudge,-65,65);pitchBlue.vy=clamp(pitchBlue.vy-ny*nudge,-65,65);
   pitchRed.vx=clamp(pitchRed.vx+nx*nudge,-65,65);pitchRed.vy=clamp(pitchRed.vy+ny*nudge,-65,65);
   keepInside(pitchBlue,bodyRadius);keepInside(pitchRed,bodyRadius);
   for(const body of [pitchBlue,pitchRed])for(let pass=0;pass<3;pass++){for(const post of posts)resolvePitchPost(body,bodyRadius,post,.85,true);keepInside(body,bodyRadius)}
  }
  pitchBall.x+=pitchBall.vx*step;pitchBall.y+=pitchBall.vy*step;
  for(const body of [pitchBlue,pitchRed]){
   dx=pitchBall.x-body.x;dy=pitchBall.y-body.y;distance=Math.hypot(dx,dy);
   const bodyContact=distance<=bodyRadius+ballRadius;
   const ringContact=distance<=radius+3+ballRadius;
   const heavy=ringContact&&body===(pitchSelectedTeam==='blue'?pitchBlue:pitchRed)&&pitchPressed&&pitchTime-body.kickAt>.35;
   if(!bodyContact&&!heavy)continue;
   const nx=distance?dx/distance:1,ny=distance?dy/distance:0;
   if(bodyContact){pitchBall.x=body.x+nx*(bodyRadius+ballRadius+.1);pitchBall.y=body.y+ny*(bodyRadius+ballRadius+.1)}
   const closing=bodyContact?(body.moveX-pitchBall.vx)*nx+(body.moveY-pitchBall.vy)*ny:0;
   if(bodyContact)applyPitchBallKnockback(body,pitchBall,nx,ny,ballRadius,bodyRadius,closing);
   const impulse=Math.max(0,closing)*1.2+(heavy?280:0);
   if(impulse>0){if(heavy)kickPitchBall(pitchBall,nx,ny);else{pitchBall.vx+=nx*impulse;pitchBall.vy+=ny*impulse;}
    if(heavy||closing>12){pitchImpacts.push({x:pitchBall.x,y:pitchBall.y,time:pitchTime,heavy});if(heavy)body.kickAt=pitchTime}
   }
  }
  if(pitchBall.x<bounds.left+ballRadius){pitchBall.x=bounds.left+ballRadius;pitchBall.vx=Math.abs(pitchBall.vx)*.85}
  if(pitchBall.x>bounds.right-ballRadius){pitchBall.x=bounds.right-ballRadius;pitchBall.vx=-Math.abs(pitchBall.vx)*.85}
  if(pitchBall.y<bounds.top+ballRadius){pitchBall.y=bounds.top+ballRadius;pitchBall.vy=Math.abs(pitchBall.vy)*.85}
  if(pitchBall.y>bounds.bottom-ballRadius){pitchBall.y=bounds.bottom-ballRadius;pitchBall.vy=-Math.abs(pitchBall.vy)*.85}
  for(let pass=0;pass<3;pass++){for(const post of posts)resolvePitchPost(pitchBall,ballRadius,post,.85);keepInside(pitchBall,ballRadius)}
  const speed=Math.hypot(pitchBall.vx,pitchBall.vy),drag=Math.exp(-step*.65),scale=speed>pitchBallSpeedLimit?pitchBallSpeedLimit/speed:1;
  pitchBall.vx*=drag*scale;pitchBall.vy*=drag*scale;
  if(Math.hypot(pitchBall.vx,pitchBall.vy)<2){pitchBall.vx=0;pitchBall.vy=0}
 }
}
function runPitch(time){pitchFrame=null;paintPitch(time);if(pitchVisible&&!document.hidden&&!pitchMotion.matches)pitchFrame=requestAnimationFrame(runPitch)}
function refreshPitch(){
 if(pitchFrame!==null)cancelAnimationFrame(pitchFrame);pitchFrame=null;pitchLastFrame=null;
 paintPitch(performance.now());if(pitchVisible&&!document.hidden&&!pitchMotion.matches)pitchFrame=requestAnimationFrame(runPitch);
}
new ResizeObserver(()=>{
 const rect=pitchHeader.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
 pitchWidth=rect.width;pitchHeight=rect.height;
 pitchCanvas.width=Math.round(rect.width*ratio);pitchCanvas.height=Math.round(rect.height*ratio);
 pitchContext.setTransform(ratio,0,0,ratio,0,0);refreshPitch();
}).observe(pitchHeader);
new IntersectionObserver(entries=>{pitchVisible=entries[0].isIntersecting;refreshPitch()}).observe(pitchHeader);
let pitchTouchId=null,pitchHeavyTouchId=null;
function setPitchPointer(event){
 const rect=pitchHeader.getBoundingClientRect();
 pitchPointer={x:Math.max(0,Math.min(rect.width,event.clientX-rect.left)),y:Math.max(0,Math.min(rect.height,event.clientY-rect.top))};
}
function releasePitchPlayer(){
 const captured=[pitchTouchId,pitchHeavyTouchId];pitchTouchId=null;pitchHeavyTouchId=null;pitchPointer=null;pitchPressed=false;
 for(const id of captured)if(id!==null&&pitchHeader.hasPointerCapture(id))pitchHeader.releasePointerCapture(id);
 refreshPitch();
}
pitchHeader.addEventListener('pointermove',event=>{
 if(pitchTouchId!==null){if(event.pointerId!==pitchTouchId){if(event.pointerId===pitchHeavyTouchId)event.preventDefault();return}event.preventDefault();setPitchPointer(event);if(pitchMotion.matches)refreshPitch();return}
 if(event.pointerType==='mouse')setPitchPointer(event);
},{passive:false});
pitchHeader.addEventListener('pointerleave',()=>{if(pitchTouchId===null)releasePitchPlayer()});
window.addEventListener('blur',releasePitchPlayer);
pitchHeader.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('a,button,input,select,textarea,summary,details'))return;
 if(event.pointerType==='touch'||event.pointerType==='pen'){
  event.preventDefault();
  if(pitchTouchId===null){pitchTouchId=event.pointerId;setPitchPointer(event);pitchPressed=false;pitchHeader.setPointerCapture(event.pointerId)}
  else if(pitchHeavyTouchId===null&&event.pointerId!==pitchTouchId){pitchHeavyTouchId=event.pointerId;pitchPressed=true;pitchHeader.setPointerCapture(event.pointerId)}
 }else{if(pitchTouchId!==null)return;if(!pitchPointer)setPitchPointer(event);pitchPressed=true}
 refreshPitch();
},{passive:false});
function endPitchTouch(event){
 if(event.pointerId===pitchTouchId){releasePitchPlayer();return}
 if(event.pointerId===pitchHeavyTouchId){
  const id=pitchHeavyTouchId;pitchHeavyTouchId=null;pitchPressed=false;
  if(pitchHeader.hasPointerCapture(id))pitchHeader.releasePointerCapture(id);
  refreshPitch();
 }
}
window.addEventListener('pointerup',event=>{
 if(pitchTouchId!==null||pitchHeavyTouchId!==null){endPitchTouch(event);return}
 if(!pitchPressed)return;pitchPressed=false;refreshPitch();
});
pitchHeader.addEventListener('pointercancel',endPitchTouch);
pitchHeader.addEventListener('lostpointercapture',endPitchTouch);
pitchMotion.addEventListener('change',refreshPitch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePitchPlayer();refreshPitch()});

document.querySelectorAll('[data-pitch-team]').forEach(button=>button.addEventListener('click',()=>{
 pitchSelectedTeam=button.dataset.pitchTeam;pitchPressed=pitchHeavyTouchId!==null;
 document.querySelectorAll('[data-pitch-team]').forEach(item=>item.setAttribute('aria-pressed',item.dataset.pitchTeam===pitchSelectedTeam));
 refreshPitch();
}));
