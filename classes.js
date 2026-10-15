// Set video to a local path (e.g. './videos/weaver.mp4') when a clip is ready.
const PLAYER_CLASSES = [
  {id:'weaver',name:'Weaver',summary:"Uses close control and changes of direction to get around opponents.",attack:"Keeps the ball close and works around challenges to find space.",defence:"Moves around the opponent to get a touch on the ball and take possession.",example:"Look for changes of direction that let the player keep the ball through a challenge.",video:'',videoType:'video/mp4'},
  {id:'bulwark',name:'Bulwark',summary:"Holds their ground and uses positioning to protect the ball or block a route.",attack:"Shields the ball and gives teammates time to get into position.",defence:"Stays between the opponent and a dangerous area, making it harder to get through.",example:"Look at where the player holds their position and which route that blocks.",video:'',videoType:'video/mp4'},
  {id:'catalyst',name:'Catalyst',summary:"Starts moves and puts opponents under pressure to make something happen.",attack:"Starts passing moves or draws an opponent out to open space for a teammate.",defence:"Closes down the ball carrier and forces them to make a quick decision.",example:"Look for the pass or challenge that gets the move going.",video:'',videoType:'video/mp4'},
  {id:'tactician',name:'Tactician',summary:"Reads the play and gets into position before the next touch.",attack:"Moves early to receive a pass or set up the next touch.",defence:"Spots where the ball is likely to go and gets there to cut it off.",example:"Look at where the player is before the ball reaches them.",video:'',videoType:'video/mp4'},
  {id:'opportunist',name:'Opportunist',summary:"Makes the most of loose balls, mistakes, and gaps that only last a moment.",attack:"Gets a shot or touch away when a gap opens or the ball breaks loose.",defence:"Takes the ball when an opponent leaves it exposed or commits too far.",example:"Look for the opening and how quickly the player takes it.",video:'',videoType:'video/mp4'},
  {id:'dynamo',name:'Dynamo',summary:"Keeps moving and stays involved from one challenge to the next.",attack:"Offers passing options and follows up after the first shot or pass.",defence:"Gets back quickly and challenges again if the first attempt fails.",example:"Follow the player after their first touch or challenge to see how they get involved again.",video:'',videoType:'video/mp4'},
  {id:'renegade',name:'Renegade',summary:"Takes unexpected approaches and makes their own openings. Hard to predict, even when playing patiently.",attack:"Uses unusual touches, sudden turns, or an unexpected route to catch opponents out. May hold the ball and wait before trying something different.",defence:"Challenges from an unexpected angle or steps in when most players would retreat. Changes their approach to keep the opponent guessing.",detail:"Unpredictable decisions define this class, not constant aggression. Their improvisation can catch teammates off guard too.",example:"Look for a decision that breaks the expected pattern, rather than just a fast or forceful play.",video:'',videoType:'video/mp4'}
];

function classesPage(){
  render(`<div class="hero"><div class="eyebrow">PLAYSTYLE ARCHETYPES</div><h1>Classes</h1><p>Classes describe how someone plays Bonk.io football. Players can share traits from more than one class.</p></div><div class="classes-grid">${PLAYER_CLASSES.map(c=>`<section class="card class-card"><div class="eyebrow">${esc(c.id)}</div><h2>${esc(c.name)}</h2><p>${esc(c.summary)}</p><button class="secondary" data-class-details="${c.id}" aria-haspopup="dialog">More details</button></section>`).join('')}</div>`);
  V.querySelectorAll('[data-class-details]').forEach(button=>button.onclick=()=>openClassDetails(PLAYER_CLASSES.find(c=>c.id===button.dataset.classDetails),button));
}

function openClassDetails(c,opener){
  if(!c)return;
  const dialog=document.createElement('dialog');
  dialog.className='class-dialog';
  dialog.setAttribute('aria-labelledby','classDialogTitle');
  dialog.innerHTML=`<div class="app-dialog-heading"><h2 id="classDialogTitle">${esc(c.name)}</h2><button class="secondary dialog-dismiss" data-class-close aria-label="Close ${esc(c.name)} details">&times;</button></div><div class="class-dialog-body"><figure class="class-example"><div class="class-video-stage">${c.video?`<video controls playsinline preload="metadata" aria-label="${esc(c.name)} example"><source src="${esc(c.video)}" type="${esc(c.videoType)}">Your browser does not support this video. <a href="${esc(c.video)}">Download the example</a>.</video>`:'<div class="class-video-placeholder"><span aria-hidden="true">&#9654;</span><strong>Example video coming soon</strong><p>An example clip will be added here.</p></div>'}</div><figcaption>${c.detail?`<p>${esc(c.detail)}</p>`:''}<p><strong>In attack:</strong> ${esc(c.attack)}</p><p><strong>In defence:</strong> ${esc(c.defence)}</p><p class="meta">${esc(c.example)}</p></figcaption></figure></div>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-class-close]').forEach(button=>button.onclick=()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()});
  dialog.addEventListener('close',()=>{dialog.querySelector('video')?.pause();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true})},{once:true});
  dialog.showModal();
  dialog.querySelector('[data-class-close]').focus({preventScroll:true});
}
