// Production homepage shell. Uses the existing live application views and API.
const homepageScroller=document.querySelector('#scrollArea');
const homepageHeader=document.querySelector('.homepage-header');
const appSurface=document.querySelector('#appSurface');
const appScroller=appSurface.querySelector('.surface-scroll');
let openPage=null,revealAnimation=null,revealVersion=0,currentView=null;
function updateHomepageHeader(){const progress=Math.min(1,homepageScroller.scrollTop/homepageHeader.getBoundingClientRect().height);homepageHeader.style.setProperty('--hero-shift',(-progress*45)+'px');homepageHeader.style.setProperty('--hero-opacity',String(1-progress))}
homepageScroller.addEventListener('scroll',updateHomepageHeader,{passive:true});
new ResizeObserver(updateHomepageHeader).observe(homepageHeader);
const initialHash=location.hash||'#/';
const initialPreload=(initialHash==='#/'||initialHash==='#')?home().then(()=>{currentView='players'}):Promise.resolve();
function closeDestination(){++revealVersion;revealAnimation?.cancel();revealAnimation=null;openPage=null;appSurface.classList.remove('is-open');appSurface.style.clipPath='circle(0px at 50% 50%)';appSurface.inert=true;homepageScroller.inert=false;homepageScroller.style.visibility=''}
function updateDestinationNavigation(){const page=location.hash.startsWith('#/player/')?'players':location.hash.slice(2);appSurface.querySelectorAll('nav a').forEach(link=>{if(link.getAttribute('href')==='#/'+page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')})}
async function navigateSite(hash,button=null,animate=false){
 const version=++revealVersion;
 if(hash==='#/'||hash==='#'||!hash){closeDestination();homepageScroller.scrollTop=0;updateHomepageHeader();return}
 await initialPreload;if(version!==revealVersion)return;
 const page=hash==='#/classes'?'classes':hash==='#/admin'||hash==='#/account'||hash.startsWith('#/setup?')?'admin':'players';
 revealAnimation?.cancel();
 if(animate)appSurface.style.clipPath='circle(0px at 50% 50%)';
 if(hash.startsWith('#/setup?')){await openSetupLink(hash);currentView='admin'}
 else if(hash.startsWith('#/profile/')){await publicPlayerProfile(decodeURIComponent(hash.split('/')[2]));currentView='profile'}
 else if(hash==='#/profile'){await ownProfile();currentView='profile'}
 else if(hash==='#/account'){await accountPage();currentView='account'}
 else if(hash==='#/admin'){await admin();currentView='admin'}
 else if(hash==='#/classes'){classesPage();currentView='classes'}
 else if(hash.startsWith('#/player/')){await player(decodeURIComponent(hash.split('/')[2]),hash.split('/')[4]);currentView='profile'}
 else if(hash==='#/players'){if(currentView!=='players')await home();currentView='players'}
 else{closeDestination();return}
 if(version!==revealVersion)return;
 appSurface.dataset.page=page;appSurface.classList.add('is-open');appScroller.scrollTop=0;openPage=page;updateDestinationNavigation();
 const finish=()=>{if(version!==revealVersion)return;appSurface.style.clipPath='none';appSurface.inert=false;homepageScroller.inert=true;homepageScroller.style.visibility='hidden';V.tabIndex=-1;V.focus({preventScroll:true})};
 if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
 const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+2;
 appSurface.inert=true;
 const animation=appSurface.animate([{clipPath:`circle(0px at ${x}px ${y}px)`},{clipPath:`circle(${radius}px at ${x}px ${y}px)`}],{duration:850,easing:'cubic-bezier(.2,.65,.25,1)',fill:'forwards'});
 revealAnimation=animation;animation.onfinish=()=>{finish();animation.cancel();if(revealAnimation===animation)revealAnimation=null};
}
window.siteRouter=()=>navigateSite(location.hash||'#/');
addEventListener('hashchange',window.siteRouter);
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();const hash='#/'+button.dataset.page;history.pushState(null,'',hash);navigateSite(hash,button,true)}));
document.querySelector('.homepage-header .brand').addEventListener('click',()=>{closeDestination();homepageScroller.scrollTop=0;updateHomepageHeader()});
document.querySelector('.homepage-scroll-cue').addEventListener('click',event=>{event.preventDefault();homepageScroller.scrollTo({top:homepageScroller.scrollTop+homepageHeader.getBoundingClientRect().bottom-homepageScroller.getBoundingClientRect().top,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})});
const destinationHeader=appSurface.querySelector('.destination-navigation');
appScroller.addEventListener('scroll',()=>{const offset=Math.min(destinationHeader.getBoundingClientRect().height,appScroller.scrollTop);destinationHeader.style.marginTop=-offset+'px';destinationHeader.inert=offset>=destinationHeader.getBoundingClientRect().height},{passive:true});
window.siteRouter();

const recentList=document.querySelector('#recentAssessmentList');
recentList.tabIndex=0;recentList.setAttribute('role','region');recentList.setAttribute('aria-label','Recent assessment updates. Hover or focus to pause automatic scrolling.');
async function loadRecentAssessments(){
 recentList.innerHTML='<p>Loading recent assessments...</p>';
 try{
  const {updates}=await api('/api/recent-assessments');
  recentList.innerHTML=updates.length?updates.map(update=>{
   const when=new Date(update.changed_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
   return `<article class="recent-assessment-item"><div class="recent-assessment-player">${cardTierBadge(update)}<div><h3>${esc(update.name)}</h3><p>${esc(update.class_name||'Class undetermined')} &middot; ${Number(update.total)} / 1800</p></div></div><div class="recent-assessment-update"><span class="assessment-activity-tag ${update.kind==='added'?'added':'edited'}">${update.kind==='added'?'Added':'Updated'}</span><p>Assessment by ${esc(update.assessed_by||'Not recorded')}</p><p class="recent-assessment-meta"><time datetime="${esc(update.changed_at)}">${esc(when)}</time></p></div><a href="#/player/${encodeURIComponent(update.id)}" class="review-assessment-link">Review stats <span aria-hidden="true">&#8599;</span></a></article>`;
  }).join(''):'<p>No recent assessments recorded yet.</p>';
 }catch(error){recentList.innerHTML='<p>Recent assessments are unavailable.</p><button class="secondary" data-retry-recent>Retry</button>';recentList.querySelector('[data-retry-recent]').onclick=loadRecentAssessments}
}
loadRecentAssessments();

// Move the real list, not duplicate cards, so every player appears only once.
const recentMotion=matchMedia('(prefers-reduced-motion: reduce)');
const recentHorizontal=matchMedia('(max-width: 600px)');
let recentVisible=false,recentHovered=false,recentFocused=false,recentFrame=null,recentLastTime=null,recentDirection=1,recentPosition=0,recentResumeAt=0,recentResumeTimer=null;
function pauseRecent(){if(recentFrame!==null)cancelAnimationFrame(recentFrame);recentFrame=null;recentLastTime=null}
function resumeRecentAfterDelay(){
 pauseRecent();clearTimeout(recentResumeTimer);recentResumeAt=performance.now()+350;
 recentResumeTimer=setTimeout(()=>{recentResumeTimer=null;startRecent()},350);
}
function canScrollRecent(){return performance.now()>=recentResumeAt&&recentVisible&&!recentHovered&&!recentFocused&&!document.hidden&&!recentMotion.matches&&openPage===null}
function startRecent(){if(!canScrollRecent()||recentFrame!==null)return;recentPosition=recentHorizontal.matches?recentList.scrollLeft:recentList.scrollTop;recentFrame=requestAnimationFrame(scrollRecent)}
function scrollRecent(time){
 recentFrame=null;if(!canScrollRecent()){recentLastTime=null;return}
 const elapsed=recentLastTime===null?0:Math.min(time-recentLastTime,50);recentLastTime=time;
 const max=recentHorizontal.matches?recentList.scrollWidth-recentList.clientWidth:recentList.scrollHeight-recentList.clientHeight;
 if(max>1){
  const speed=recentDirection===1?.018:Math.max(.6,max/350);
  recentPosition=Math.max(0,Math.min(max,recentPosition+recentDirection*elapsed*speed));
  if(recentHorizontal.matches)recentList.scrollLeft=recentPosition;else recentList.scrollTop=recentPosition;
  if(recentPosition>=max)recentDirection=-1;
  else if(recentPosition<=0)recentDirection=1;
 }
 recentFrame=requestAnimationFrame(scrollRecent);
}
recentList.addEventListener('pointerenter',()=>{recentHovered=true;clearTimeout(recentResumeTimer);pauseRecent()});
recentList.addEventListener('pointerleave',()=>{recentHovered=false;resumeRecentAfterDelay()});
recentList.addEventListener('focusin',()=>{recentFocused=true;clearTimeout(recentResumeTimer);pauseRecent()});
recentList.addEventListener('focusout',()=>{recentFocused=recentList.contains(document.activeElement);resumeRecentAfterDelay()});
recentList.addEventListener('pointerdown',()=>{recentFocused=true;clearTimeout(recentResumeTimer);pauseRecent()},{passive:true});
recentList.addEventListener('pointerup',()=>{recentFocused=recentList.contains(document.activeElement);resumeRecentAfterDelay()},{passive:true});
new IntersectionObserver(entries=>{recentVisible=entries[0].isIntersecting;if(recentVisible)startRecent();else pauseRecent()}).observe(recentList);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRecent();else startRecent()});
recentMotion.addEventListener('change',()=>{pauseRecent();startRecent()});
addEventListener('hashchange',()=>{pauseRecent();startRecent()});

recentHorizontal.addEventListener('change',()=>{pauseRecent();recentList.scrollTop=0;recentList.scrollLeft=0;recentPosition=0;recentDirection=1;startRecent()});
recentList.addEventListener('pointercancel',()=>{recentHovered=false;recentFocused=recentList.contains(document.activeElement);resumeRecentAfterDelay()},{passive:true});

recentList.addEventListener('wheel',resumeRecentAfterDelay,{passive:true});

