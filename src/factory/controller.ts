// Company UI controller: the scroll-driven company tour (see company/tour.ts), stop drawers,
// in-scene controls, the workforce bays, globe UI, header menu, hash navigation and the
// flat (no-3D) fallback page.
import { INDS, ECO, CAREER_CFG } from '../data/content';
import { Tour, type TourRoute, type TourStop } from '../company/tour';
import { Story, lobbyPose, setRoomFocus, type PathId, type RoomDef, type RoomId } from '../story/guide';
import { PodMission, podLabels } from '../pod/mission';
import { i18n, translateDom } from '../app/i18n';
import { POD_PLACE, DEVELOP_AREAS } from '../pod/missions';
import { Opening, BEATS } from '../story/opening';
import { currentPath, currentRoute, legacyHashPath, onPathChange, setPath } from '../app/router';
import { routeFor, type Dest } from '../app/routes';
import { Passport } from '../app/passport';
import { motion } from '../app/motion';
import { quality } from '../app/quality';
import { SelectionTray } from '../app/selection';
import { makeRoutes, PROFESSIONS, PROFESSION_NODE, DEMOS } from '../story/routes';
import type { StoryIntroIntent } from '../story/intro';
import type { Object3D } from 'three';
import type * as THREE from 'three';
import type { FactoryApi, P3, ScreenPoint, StopCopy, TalentUnit } from '../bridge';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

type El = HTMLElement;
/** A camera pose for the workforce hub: position and look-at. */
interface WfPose { p: number[]; l: number[] }
/** A control mirrored into the 3D scene (PHS) and/or the stop drawer and globe control bar. */
interface Ctl {
  label?: string; el?: El; o?: CSS3DObject; src?: () => El | null; fn?: () => void; at?: [string, number][];
  tg?: number; noObj?: number; cls?: string; html?: string; par?: string; pin?: number; fix?: number; sw?: number;
  pos?: P3; cam?: P3; face?: P3; z?: number; flat?: number; ww?: number; pxW?: number;
  cond?: () => boolean; upd?: (e: Ctl, a: boolean) => void; db?: HTMLButtonElement; rb?: HTMLButtonElement; sc0?: number; k?: number;
}
/** A stop board: copy shown in the drawer and, when placed, as a 3D board in the scene. */
interface Board {
  r: string; s: number; h: string; p?: string; pts?: string[]; mv?: string[]; x?: [string, string][]; track?: number; noSign?: number;
  place?: { pos: P3; ww: number; face?: P3; twf?: number; par?: string }; keep?: [P3, P3][];
  w?: El; bd?: ChildNode | null; o?: CSS3DObject; pose?: P3[]; bx?: number; px?: number; tw?: number;
}
type PlacedBoard = Board & { w: El; bd: ChildNode | null; o: CSS3DObject; pose: P3[]; bx: number; px: number };
interface Rect { l: number; t: number; r: number; b: number }
/** A career-path card placed beside the scene (layout pass in step()). */
interface CorPlace { t: { c: El; p: ScreenPoint; w: number; hh: number }; o: number; x: number; y: number; l: number; r: number; tp: number; b: number }

export interface ControllerApi {
  /** The story intro has handed over: show the tour at the Company stop. */
  enterFromStory(intent?: StoryIntroIntent): void;
  /** The story is about to replay over the page: close panels and leave the globe. */
  beforeStory(): void;
}

export function initController(replayStory: () => void): ControllerApi {
  const $=<T extends El=El>(id:string)=>document.getElementById(id) as T;
  let reduce=motion.reduced;motion.on(v=>{reduce=v});
  const B1=3.8,SEG=1.3,INTRO_END=B1+.55;
  const HOLD:Record<string,[number,number]>={career:[5,3.6]},HL=(r:string)=>HOLD[r]?HOLD[r][1]:0,topOf=(r:string,i:number)=>((HOLD[r]&&i>HOLD[r][0])?i+HOLD[r][1]:i)*SEG*innerHeight,dwell=(x:number)=>{const i=Math.floor(x);return i+sm(.3,.7,x-i)};
  const LABELS:Record<string,string[]>={career:['Intake','Assessment','Your Path','Career Launch','Career Pro','Career Accelerate','ETAF™','Opportunity'],globe:['Professions','Journey','Who is this for?'],workforce:['Dock','Verified Talent','PODs','Workforce Capability','Campus','Ecosystem','Compare']};
  const BLOCKS=[...document.querySelectorAll<El>('.cp:not(.wm)')].map((el,i)=>({el,r:'career',s:i})).concat([...document.querySelectorAll<El>('.cp.wm')].map((el,i)=>({el,r:'workforce',s:i})));
  const sm=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
  const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const track=$('track'),rail=$('rail'),setTrack=(u:number)=>track.style.height=((u+1)*100)+'vh';setTrack(INTRO_END);
  let pendLine:string|null=null,stWho:string|null=null,stCat='For students',podI=0,podLock=false,podLastW=0,wasAtPods=false,podWf:number|null=null,podFly=false,flyE=1;
  let mode='intro',route:string|null=null,flyT0=0,backT0=0,gT0=0,gNext:string|null=null,pending=null,yS=scrollY,lastRA=-1,lastRB=-1,dots:El[]=[],sel=-1;
  const jump=(top:number)=>{scrollTo({top,behavior:'instant'});yS=top};
  function buildRail(r:string){rail.innerHTML='';LABELS[r].forEach((l,i)=>{const b=document.createElement('button');b.type='button';b.innerHTML='<i></i><span>'+l+'</span>';b.setAttribute('aria-label','Go to '+l);b.onclick=()=>{if(r==='workforce'){wfGo(i);return}if(r==='globe'){if(mode==='globe')globeRail(i)}else if(mode==='route')scrollTo({top:topOf(r,i),behavior:reduce?'auto':'smooth'})};rail.appendChild(b)});dots=[...rail.children] as El[]}
  function choose(r:string){if(mode!=='intro'||!window.FACTORY)return;stCat=stWho||(r==='career'?'For students':'For startups');stWho=null;window.FACTORY.setHover(null);spine(false);window.FACTORY.snapshot();podFly=true;route=r;mode='fly';flyT0=performance.now();buildRail(r);setTrack(r==='workforce'?0:(LABELS[r].length-1+HL(r))*SEG+.6);jump(0)}
  /** Where the visitor came from when they entered the globe (null: opened directly), so Back returns there. */
  let gReturn:{route:TourRoute;index:number}|null=null;
  function toGlobe(){const F=window.FACTORY;if(!F||(mode!=='intro'&&mode!=='route'&&mode!=='hub'&&mode!=='tour'))return;gReturn=mode==='tour'?{route:tour.route,index:tour.route!=='story'&&TOURS_ALL()[tour.route][tour.index]?.id==='world'?Math.max(0,tour.index-1):tour.index}:null;paintGlobeBack();syncPath('ai-for-everyone/');tour.stop();story.hide();closeDrawer();F.setHover(null);spine(false);F.globeBegin('in');mode='gIn';gT0=performance.now();route=null;buildRail('globe');setTrack(0);jump(0);closeSide()}
  function leaveGlobe(next:string|null){const F=window.FACTORY!;if(mode!=='globe'&&mode!=='gIn')return;closeWho();closeSide();F.globeBegin('out');mode='gOut';gT0=performance.now();gNext=next}
  function back(){if(menuOpen){closeMenu();return}if(cd.classList.contains('open')){closeDrawer();return}if(!$('handoff').hidden){hideHandoff();return}if(flatOpen&&!flatAuto){closeFlat();return}if(whoOpen){closeWho();return}if(side.classList.contains('open')){closeSide();return}const F=window.FACTORY;if(!F)return;if(mode==='tour'){if(tour.index>0)tour.travel(tour.index-1);return}if(mode==='globe'||mode==='gIn'){leaveGlobe(null);return}if(mode==='hub'){if(wfAt!==0){wfGo(0);return}F.pod(false);F.snapshot();mode='back';backT0=performance.now();return}if(mode!=='route'&&mode!=='fly')return;F.snapshot();mode='back';backT0=performance.now()}
  /** The globe's back button names where it goes. */
  function paintGlobeBack(){const b=$('finGlobe').querySelector<El>('.backBtn:not(#whoBtn)');if(b)b.textContent=gReturn?'← Back to your tour':'← Back to the entrance'}
  function finishBack(){startTour(tour.route,Math.max(0,tour.count-2))}
  $('doorCareer').onclick=()=>choose('career');
  const atPods=()=>false;
  const podGo=(d:number)=>{const n=Math.max(0,Math.min(2,podI+d));if(n===podI)return false;podI=n;return true};
  const podEnter=(i:number)=>{stWho=['For students','For universities','For startups'][i];if(i===0){podWf=null;choose('career')}else{podWf=i===1?4:2;choose('workforce')}};
  addEventListener('wheel',e=>{if(!atPods())return;let d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!d)return;const now=performance.now(),quiet=now-podLastW>200;podLastW=now;if(podLock&&quiet)podLock=false;
    if(!podLock&&d<0&&podI===0)return;e.preventDefault();if(podLock)return;podGo(Math.sign(d));podLock=true},{passive:false,capture:true});
  let pty:number|null=null,pDone=false;addEventListener('touchstart',e=>{pty=atPods()?e.touches[0].clientY:null;pDone=false},{passive:true});
  addEventListener('touchmove',e=>{if(pty==null||!atPods())return;const d=pty-e.touches[0].clientY;if(d<0&&podI===0&&!pDone)return;e.preventDefault();if(!pDone&&Math.abs(d)>36){podGo(Math.sign(d));pDone=true}},{passive:false});
  addEventListener('keydown',e=>{if(!atPods()||(e.target as Element).closest&&(e.target as Element).closest('input,textarea,select,#menu'))return;const k=e.key;let d=0;if(k==='ArrowDown'||k==='ArrowRight'||k==='PageDown')d=1;else if(k==='ArrowUp'||k==='ArrowLeft'||k==='PageUp')d=-1;if(!d||(d<0&&podI===0))return;e.preventDefault();podGo(d)});
  setTimeout(function wirePods(){const F=window.FACTORY;if(!F||!F.podEls){setTimeout(wirePods,300);return}F.podEls().forEach((el,i)=>{el.addEventListener('click',()=>{if(!atPods())return;if(i===F.podCentre()&&i===podI)podEnter(i);else podI=i});el.addEventListener('focus',()=>{if(atPods())podI=i})})},300);$('doorWork').onclick=()=>choose('workforce');$('doorGlobe').onclick=toGlobe;
  document.querySelectorAll<El>('.backBtn,#hdrBack').forEach(b=>b.onclick=back);
  const side=$('gSide'),nodeWrap=$('nodes');
  const nodeEls=INDS.map((d,i)=>{const b=document.createElement('button');b.type='button';b.className='node';b.innerHTML='<b></b><span></span>';b.firstChild!.textContent=d.name;b.lastChild!.textContent=d.ph?'Coming soon':d.line;b.onclick=()=>openSide(i);nodeWrap.appendChild(b);return b});
  const escG=(s:string)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),PHG='<span class="tbc">To be confirmed</span>';
  const LVN=['AI Awareness','AI Productivity','For Your Profession','Applied Projects','Career Readiness'],LVD=['What AI is, what it can and cannot do, and how to use it safely.','Everyday AI tools for writing, research, analysis and planning.','AI applied to the workflows of your profession.','Real projects that produce work you can show.','Evidence of capability that employers can check.'];
  let lvl=0,whoOpen=false,who=0,lastSel=0;const ring=$('gRing');
  ring.innerHTML='<svg viewBox="-150 -150 300 300" aria-hidden="true"><line id="gLead" x1="0" y1="0" x2="0" y2="0" stroke="#C9A33A" stroke-width="1.5" stroke-dasharray="4 4"></line><circle r="118" fill="none" stroke="#C9A33A" stroke-width="1.5"></circle><circle id="gDot" r="5" fill="#C9A33A"></circle></svg>'+LVN.map((n,i)=>{const k=(-90+i*72)*Math.PI/180;const c=Math.cos(k),tf=c>.3?'translate(-17px,-50%)':c<-.3?'translate(calc(-100% + 17px),-50%)':'translate(-50%,-50%)',fd=c<-.3?';flex-direction:row-reverse;padding:6px 6px 6px 11px':'';return'<button type="button" data-lv="'+i+'" style="left:'+Math.round(c*118)+'px;top:'+Math.round(Math.sin(k)*118)+'px;transform:'+tf+fd+'"><i>'+(i+1)+'</i>'+n+'</button>'}).join('');
  ring.querySelectorAll<El>('[data-lv]').forEach(b=>b.onclick=()=>{lvl=+b.dataset.lv!;paintLv()});
  function paintLv(){if(sel<0)return;const d=INDS[sel];ring.querySelectorAll<El>('[data-lv]').forEach(b=>{const on=+b.dataset.lv! ===lvl;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});const wf=lvl===2&&!d.ph?'<small>Workflows</small><ul>'+d.uses.map(u=>'<li>'+escG(u)+'</li>').join('')+'</ul>':'';$('gLvD').innerHTML='<small>Level '+(lvl+1)+' of 5</small><b>'+LVN[lvl]+'</b><p>'+LVD[lvl]+'</p>'+wf;paintGo()}
  function paintGo(){const n=sel>=0?INDS[sel].name:'';$('gGo').innerHTML=($<HTMLInputElement>('gOrg').checked?'Bring AI Capability to My Team':'Explore AI for '+escG(n))+' <span>→</span>';$('gHand').hidden=true}
  $('gOrg').onchange=paintGo;$('gGo').onclick=()=>{openDrawer('ph','Talk to us',$('gGo').textContent!.replace(/\s*→$/,''))};
  const gQ=$<HTMLInputElement>('gQ'),gList=$('gList');
  gList.innerHTML=INDS.map((d,i)=>'<li data-gl="'+i+'"><button type="button" data-gi="'+i+'">'+escG(d.name)+'<i aria-hidden="true">›</i></button></li>').join('')+'<li class="none" hidden>No profession matches.</li>';
  const gItems=[...gList.querySelectorAll<El>('[data-gi]')];gItems.forEach(b=>b.onclick=()=>openSide(+b.dataset.gi!));
  function paintList(){gItems.forEach(b=>b.classList.toggle('on',+b.dataset.gi! ===sel))}
  const visItems=()=>gItems.filter(b=>!(b.parentNode as El).hidden);
  gQ.addEventListener('input',()=>{const q=gQ.value.trim().toLowerCase();gItems.forEach(b=>{(b.parentNode as El).hidden=!!q&&!INDS[+b.dataset.gi!].name.toLowerCase().includes(q)});gList.querySelector<El>('.none')!.hidden=visItems().length>0});
  gQ.addEventListener('keydown',e=>{const v=visItems();if(e.key==='ArrowDown'&&v.length){e.preventDefault();v[0].focus()}else if(e.key==='Enter'&&v.length){e.preventDefault();v[0].click()}});
  gList.addEventListener('keydown',e=>{const v=visItems(),k=v.indexOf(document.activeElement as El);if(k<0)return;if(e.key==='ArrowDown'){e.preventDefault();(v[k+1]||v[k]).focus()}else if(e.key==='ArrowUp'){e.preventDefault();(k?v[k-1]:gQ).focus()}});
  function openSide(i:number,view?:'work'|'path'){if(whoOpen)closeWho(true);sel=i;lastSel=i;lvl=0;const d=INDS[i];$('gName').textContent=d.name;$('gLine').textContent=d.ph?'Details for this profession are coming soon.':d.line;$<HTMLInputElement>('gOrg').checked=false;paintLv();side.classList.add('open');nodeEls.forEach((n,k)=>n.classList.toggle('on',k===i));paintList();window.FACTORY!.focusNode(i);window.FACTORY!.setPanel(1);window.FACTORY!.setSel(i);
    const has=!!window.FACTORY?.hasDio(i);$('gTabs').hidden=!has;paintWork();setView(has?(view??'work'):'path')}
  /** The profession panel's two views: the workflow diorama on the globe, or the five-level learning path (with its ring). */
  let gView:'work'|'path'='path',stepSync=0;
  function setView(v:'work'|'path'){gView=v;const work=v==='work'&&sel>=0;$('gWork').hidden=!work;$('gLvD').hidden=work;document.querySelectorAll<El>('[data-gv]').forEach(b=>{const on=b.dataset.gv===v;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on))});window.FACTORY?.globeZoom(work?sel:-1);if(!work&&sel>=0)window.FACTORY?.focusNode(sel);clearInterval(stepSync);if(work)stepSync=window.setInterval(paintStep,250)}
  document.querySelectorAll<El>('[data-gv]').forEach(b=>b.onclick=()=>setView(b.dataset.gv as 'work'|'path'));
  function paintWork(){const d=sel>=0?DEMOS[INDS[sel].name]:undefined;if(!d){$('gWork').innerHTML='';return}
    const ST=['Sample input','AI draft','You check'];
    $('gWork').innerHTML='<small>A task you already do</small><b class="gTask">'+escG(d.task)+'</b><ol class="gSteps">'+d.demo.map((t,k)=>'<li><button type="button" data-dst="'+k+'"><i>'+(k+1)+'</i><span><b>'+ST[k]+'</b>'+escG(t)+'</span></button></li>').join('')+'</ol><button type="button" class="opt" id="gReplay">▶ Play the steps</button><div class="gSplit"><div><small>AI helps with</small><p>'+escG(d.helps)+'</p></div><div><small>Stays with you</small><p>'+escG(d.decides)+'</p></div></div><p class="note"><span class="ill">ILLUSTRATIVE</span> A sample workflow. It doesn’t show a real product or a measured result.</p>';
    $('gWork').querySelectorAll<El>('[data-dst]').forEach(b=>b.onclick=()=>{window.FACTORY?.dioStep(+b.dataset.dst!);paintStep()});$('gReplay').onclick=()=>window.FACTORY?.dioStep(-1)}
  function paintStep(){const k=window.FACTORY?.dioAt()??0;$('gWork').querySelectorAll<El>('[data-dst]').forEach(b=>{const on=+b.dataset.dst! ===k;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'step':'false')})}
  const PW:[string,string,string,number][]=[['Everyone','Anyone starting with AI, at any stage of their career.','Self-paced modules with live sessions, open to all.',0],['Professionals','Working professionals applying AI in the role they hold.','Profession tracks through the five levels, ending in applied projects.',0],['Engineers','Engineers and graduates who build AI systems.','The Career route: Entry Assessment, Career Pro pods and ETAF™ verification.',-1],['Leaders','Executives and managers leading AI adoption.','Leadership cohorts and strategy workshops.',0],['Enterprises','Organisations building AI capability across their teams.','Corporate academy, L&D as a service or Product Engineering PODs.',1],['Government & Education','Ministries, agencies, universities and schools.','Sector programmes and Campus Talent Factories.',2]];
  const WB=['Explore Programme','Bring AI to My Team','Discuss Enterprise Delivery'];
  $('radial').insertAdjacentHTML('beforeend',PW.map((p,i)=>{const k=(-90+i*60)*Math.PI/180;return'<button type="button" data-pw="'+i+'" style="left:'+Math.round(150+Math.cos(k)*102)+'px;top:'+Math.round(150+Math.sin(k)*102)+'px">'+escG(p[0])+'</button>'}).join(''));
  document.querySelectorAll<El>('[data-pw]').forEach(b=>b.onclick=()=>{who=+b.dataset.pw!;paintWho()});
  function whoHand(n:string){openDrawer('ph',n,'AI for Everyone')}
  function paintWho(){const p=PW[who];document.querySelectorAll<El>('[data-pw]').forEach(b=>{const on=+b.dataset.pw! ===who;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});$('whoHub').textContent='AI for '+p[0];
    $('whoD').innerHTML='<small>Audience</small><p>'+escG(p[1])+'</p><small>Delivery shape</small><p>'+escG(p[2])+'</p><small>Next step</small><p>'+(p[3]<0?'Enter the Career route':WB[p[3]])+'</p>';
    $('whoActs').innerHTML=(p[3]<0?'<button class="cta" type="button" data-wb="c">Enter the Career route <span>→</span></button>':'')+WB.map((n,i)=>'<button class="cta'+(i===p[3]?'':' ghost')+'" type="button" data-wb="'+i+'">'+n+(i===p[3]?' <span>→</span>':'')+'</button>').join('');
    $('whoHand').hidden=true;$('whoActs').querySelectorAll<El>('[data-wb]').forEach(b=>b.onclick=()=>{const k=b.dataset.wb!;if(k==='c')leaveGlobe('career');else if(k==='1')leaveGlobe('workforce');else whoHand(WB[+k])})}
  function openWho(){if(mode!=='globe')return;if(side.classList.contains('open'))closeSide();whoOpen=true;$('gWho').classList.add('open');paintWho();window.FACTORY!.setPanel(1);const b=document.querySelector<El>('[data-pw="'+who+'"]');b&&b.focus({preventScroll:true})}
  function closeWho(keep?:boolean){whoOpen=false;$('gWho').classList.remove('open');if(!keep&&window.FACTORY)window.FACTORY.setPanel(0)}
  function globeRail(i:number){if(i===0){closeWho();closeSide()}else if(i===1)openSide(sel>=0?sel:lastSel);else openWho()}
  $('whoBtn').onclick=openWho;$('whoClose').onclick=()=>closeWho();
  function closeSide(){clearInterval(stepSync);window.FACTORY?.globeZoom(-1);sel=-1;side.classList.remove('open');nodeEls.forEach(n=>n.classList.remove('on'));paintList();if(window.FACTORY){window.FACTORY.setPanel(whoOpen?1:0);window.FACTORY.setSel(-1)}}
  side.querySelector<El>('.gClose')!.onclick=closeSide;
  const GIN=6200,xf=$('xf'),lift=$('lift');const skipLift=()=>{if(mode==='gIn'&&!reduce)gT0=performance.now()-GIN};
  addEventListener('pointerdown',e=>{if(mode==='gIn'&&!(e.target as Element).closest('header'))skipLift()},true);addEventListener('keydown',e=>{if(mode==='gIn'&&e.key!=='Escape'&&e.key!=='Tab')skipLift()});
  addEventListener('keydown',e=>{if(e.key==='Escape')back()});
  let drag:{x:number;y:number}|null=null;
  addEventListener('pointerdown',e=>{if(mode!=='globe'||(e.target as Element).closest('button,a,input,select,#gSide,#gWho,#gRing,#finGlobe,header,.p3,.b3,#ctl,#radial'))return;drag={x:e.clientX,y:e.clientY};document.body.style.cursor='grabbing'});
  addEventListener('pointermove',e=>{if(!drag)return;window.FACTORY!.drag(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY});
  const endDrag=()=>{drag=null;document.body.style.cursor=mode==='globe'?'grab':''};addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
  const tags=[...document.querySelectorAll<El>('.tag')],doors=[$('doorCareer'),$('doorWork'),$('doorGlobe')];
  const anchor=(el:El)=>el.dataset.anchor!.split(',').map(Number) as P3;
  const sA=$('sceneA'),sB=$('sceneB'),tA=$('textA'),tB=$('textB'),svgA=$('svgA'),svgB=$('svgB'),cv=$('c'),title=$('title'),hint=$('hint'),hdrLogo=$('hdrLogo'),hdrBack=$('hdrBack'),gTitle=$('finGlobe'),gHint=$('gHint');
  const crumb=$('crumb'),menu=$('menu'),menuBtn=$('menuBtn'),flat=$('flat');let menuOpen=false,flatOpen=false,flatAuto=false;
  const sF=$('sceneF'),svgF=$('svgF'),tB2=$('textB2'),ask=$('ask'),bldg=$('bldg'),zones=[...document.querySelectorAll('.zone')];let fl:[Element,[P3,P3]][]|null=null,spOn=false,spT0=0;
  function spine(on:boolean){if(on&&!spOn)spT0=performance.now();spOn=on;window.FACTORY&&window.FACTORY.setSpine(on)}
  bldg.addEventListener('pointerenter',()=>spine(true));bldg.addEventListener('pointerleave',()=>spine(false));bldg.addEventListener('focus',()=>spine(true));bldg.addEventListener('blur',()=>spine(false));bldg.onclick=()=>spine(true);
  [['doorCareer','career'],['doorWork','workforce'],['doorGlobe','globe']].forEach(([id,k])=>{const d=$(id),on=()=>window.FACTORY&&window.FACTORY.setHover(k),off=()=>window.FACTORY&&window.FACTORY.setHover(null);d.addEventListener('pointerenter',on);d.addEventListener('focus',on);d.addEventListener('pointerleave',off);d.addEventListener('blur',off)});
  const ZA=[[-16,10.5,-4],[-5.5,10.5,-4],[5.5,10.5,-4],[16,10.5,-4]];
  const cd=$('cDrawer'),cors=[...document.querySelectorAll<El>('.cor')],CFG=CAREER_CFG,REC='pro',PATHN:Record<string,string>={launch:'Career Launch',pro:'Career Pro',accel:'Career Accelerate'};let hasResult=false,curS=0;
  let drawerOpener:HTMLElement|null=null;
  function openDrawer(k:string,t?:string,e?:string){if(!cd.classList.contains('open'))drawerOpener=document.activeElement instanceof HTMLElement?document.activeElement:null;cd.inert=false;cd.querySelectorAll<El>('[data-d]').forEach(x=>x.hidden=x.dataset.d!==k);if(k==='ph'){$('phT').textContent=t!;$('phE').textContent=e||'Build My Career';$('phT').nextElementSibling!.textContent='Online enquiries are not available yet. You can continue exploring the services and return when contact details are published.'}cd.classList.add('open');setTimeout(()=>{if(cd.classList.contains('open'))$('cdClose').focus({preventScroll:true})},60)}
  cd.inert=true;
  function closeDrawer(){
    const wasOpen=cd.classList.contains('open');
    cd.classList.remove('open');cd.inert=true;
    if(!wasOpen)return;
    const opener=drawerOpener;drawerOpener=null;
    requestAnimationFrame(()=>{
      if(cd.classList.contains('open'))return;
      if(mode==='tour'&&tour.route==='story')story.restoreFocus(opener);
      else if(opener?.isConnected&&opener.getClientRects().length&&!opener.closest('[hidden]'))opener.focus({preventScroll:true});
      else menuBtn.focus({preventScroll:true});
    });
  }
  cd.querySelectorAll<HTMLElement>('[data-close-drawer]').forEach(b=>b.onclick=closeDrawer);
  $('cdClose').onclick=closeDrawer;
  function goStop(i:number){closeDrawer();if(mode==='tour'){startTour('career',tour.route==='career'?tour.index:0);tour.travel(CTS[i]);return}if(mode==='route'&&route==='career')scrollTo({top:topOf('career',i),behavior:reduce?'auto':'smooth'})}
  function ctaLabel(k:string){if(!hasResult)return 'Take the Entry Assessment';if(PATHN[k])return k===REC?'Continue '+PATHN[k]:(k==='accel'?'Discuss Eligibility':'View Programme Details');return k==='etaf'?'View My Readiness Journey':'Continue My Application'}
  function refreshCareer(){document.querySelectorAll<El>('[data-path]').forEach(b=>b.innerHTML=ctaLabel(b.dataset.path!)+' <span>→</span>');
    cors.forEach(c=>{const k=c.dataset.k;if(!k)return;c.classList.toggle('rec',hasResult&&k===REC);c.classList.toggle('cmp',hasResult&&k!==REC);c.querySelector('small')!.textContent=!hasResult?'Recommended after assessment':k===REC?'Recommended · SAMPLE':'Available to compare'});
    $('cpLocked').hidden=hasResult;$('cpResult').hidden=!hasResult}
  document.querySelectorAll<El>('[data-path]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.path!;passport.interest(k);if(!hasResult){goStop(1);return}const i=({launch:3,pro:4,accel:5} as Record<string,number>)[k];if(k===REC){goStop(Math.round(curS)===i?i+1:i);return}openDrawer('ph',ctaLabel(k),PATHN[k]||(k==='etaf'?'ETAF™ Assurance':'Opportunity'))}));
  document.querySelectorAll('[data-go-assess]').forEach(b=>b.addEventListener('click',()=>goStop(1)));
  document.querySelectorAll<El>('[data-drawer]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.drawer!));
  document.querySelectorAll<El>('[data-ph]').forEach(b=>b.onclick=()=>openDrawer('ph',b.dataset.ph,b.dataset.phe));
  document.querySelectorAll<El>('[data-drive]').forEach(b=>{b.textContent=CFG.drive.label;b.onclick=()=>{if(CFG.drive.url)location.href=CFG.drive.url;else openDrawer('drive')}});$('driveT').textContent=CFG.drive.label;
  $('startA').innerHTML=CFG.assessment.label+' <span>→</span>';
  function hideHandoff(){$('handoff').hidden=true;$('aScan').style.display='flex';$('startA').focus({preventScroll:true})}
  $('startA').onclick=()=>{
    if(!CFG.assessment.url){openDrawer('ph','Assessment access','Entry Assessment');$('phT').nextElementSibling!.textContent='The online assessment is not available yet. You can explore the assessment process and return when the assessment link is published.';return}
    $('aScan').style.display='none';$('handoff').hidden=false;$<HTMLAnchorElement>('assessLink').href=CFG.assessment.url;$('assessLink').hidden=false;$('assessPh').hidden=true;$('assessLink').focus({preventScroll:true})
  };
  $('assessLink').onclick=e=>{if(!CFG.assessment.url)e.preventDefault()};$('hoBack').onclick=hideHandoff;
  $('contRec').onclick=()=>goStop(4);
  $('sampleT').onchange=e=>{hasResult=(e.target as HTMLInputElement).checked;refreshCareer()};
  refreshCareer();
  let floorX=-1,curStage=-1;const ticks=new Set<number>(),ppRows=[...document.querySelectorAll('#pp>div')],lpW=$('lpW'),lpB=$('lp'),lpL=$('lpList');
  const STN=[['Fundamentals lab','Fundamentals + AI fluency.'],['AI productivity console','Hands-on labs with AI tools.'],['Collaboration zone','Communication and problem solving.'],['Project bench','Hands-on projects that build your portfolio.'],['Career readiness booth','Resume, interview and workplace coaching.']];
  const PODS=['AI/ML','Data','Cloud/DevOps','Cybersecurity','Full Stack','ServiceNow','IoT / Engineering AI'];
  const STG=[['Discover','Frame the industry problem, its users and constraints with the client.'],['Design','Shape the architecture and plan the sprint.'],['Build','Write and review the code across AI, data, cloud and security work.'],['Test & Secure','Test the build and check it against security requirements.'],['Deploy & Operate','Release to a live environment and monitor it.'],['Demo & Validate','Demo to the client and validate against the original problem.']];
  const SRN=[['Assessments','Career Launch'],['Artifacts & code','Career Pro'],['Project delivery','Product Engineering floor'],['Performance data','Product Engineering floor'],['Observed behaviour','Career Launch'],['Credentials','Career Pro']];
  lpL.innerHTML=STN.map(s=>'<li>'+s[0]+'</li>').join('');
  $('podBtns').innerHTML=PODS.map((p,i)=>'<button class="opt" type="button" data-pod="'+i+'" data-hit="pod'+i+'">'+p+'</button>').join('');
  $('stgBtns').innerHTML=STG.map((p,i)=>'<button class="opt" type="button" data-stg="'+i+'" data-hit="stg'+i+'">'+(i+1)+' · '+p[0].replace('&','&amp;')+'</button>').join('');
  $('srBtns').innerHTML=SRN.map((p,i)=>'<button class="opt" type="button" data-sr="'+i+'" data-hit="sr'+i+'">'+p[0].replace('&','&amp;')+'</button>').join('');
  function paintPass(){const n=ticks.size;lpB.querySelectorAll('.tk i').forEach((d,i)=>d.classList.toggle('on',ticks.has(i)));$('lpN').textContent=n+' / 5';lpL.querySelectorAll('li').forEach((l,i)=>l.classList.toggle('on',ticks.has(i)));document.querySelectorAll<El>('[data-st]').forEach(b=>b.classList.toggle('done',ticks.has(+b.dataset.st!)));window.FACTORY&&window.FACTORY.setTicks([...ticks])}
  function selStation(i:number){ticks.add(i);paintPass();document.querySelectorAll<El>('[data-st]').forEach(b=>b.classList.toggle('on',+b.dataset.st! ===i));$('stDet').innerHTML='<small>Station '+(i+1)+' of 5 · explored</small><b>'+STN[i][0]+'</b><p>'+STN[i][1]+'</p>'}
  function openPod(i:number){$('podT').textContent=PODS[i];document.querySelectorAll<El>('[data-pod]').forEach(b=>b.classList.toggle('on',+b.dataset.pod! ===i));openDrawer('pod')}
  function showStage(i:number){document.querySelectorAll<El>('[data-stg]').forEach(b=>b.classList.toggle('on',+b.dataset.stg! ===i));$('stgDet').innerHTML='<small>Stage '+(i+1)+' of 6</small><b>'+STG[i][0].replace('&','&amp;')+'</b><p>'+STG[i][1]+'</p><small>Evidence produced</small><p><span class="tbc">To be confirmed</span></p>'}
  function goStage(i:number){showStage(i);curStage=i;if(mode==='tour'){window.FACTORY&&window.FACTORY.setCrate(i);return}if(mode==='route'&&route==='career')scrollTo({top:(5+i/5*HOLD.career[1])*SEG*innerHeight+2,behavior:reduce?'auto':'smooth'})}
  function glance(i:number){document.querySelectorAll<El>('[data-sr]').forEach(b=>b.classList.toggle('on',+b.dataset.sr! ===i));window.FACTORY&&window.FACTORY.glance(i)}
  document.querySelectorAll<El>('[data-st]').forEach(b=>b.onclick=()=>selStation(+b.dataset.st!));
  document.querySelectorAll<El>('[data-pod]').forEach(b=>b.onclick=()=>openPod(+b.dataset.pod!));
  document.querySelectorAll<El>('[data-stg]').forEach(b=>b.onclick=()=>goStage(+b.dataset.stg!));
  document.querySelectorAll<El>('[data-sr]').forEach(b=>{b.onclick=()=>glance(+b.dataset.sr!);b.title='Created in '+SRN[+b.dataset.sr!][1]});
  showStage(0);curStage=0;
  lpB.onclick=()=>{lpL.hidden=!lpL.hidden;lpB.setAttribute('aria-expanded',String(!lpL.hidden))};
  const HITSTOP:Record<number,number>={3:1,4:1,5:1,6:1},hitKey=(e:MouseEvent)=>{if(mode==='hub'&&route==='workforce'&&wfAt===0&&wfArr&&window.FACTORY&&!(e.target as Element).closest('button,a,input,select,label,.cp,#cDrawer,header,#rail,#menu,.b3,.p3,#ctl'))return window.FACTORY.pick(e.clientX,e.clientY,'w0');if(mode!=='route'||route!=='career'||!window.FACTORY||(e.target as Element).closest('button,a,input,select,label,.cp,#cDrawer,header,#rail,.cor,#lpW,#menu,.b3,.p3,#ctl'))return null;const st=Math.round(curS);return HITSTOP[st]&&Math.abs(curS-st)<.3?window.FACTORY.pick(e.clientX,e.clientY,st):null};
  let hovK:string|null=null;addEventListener('pointermove',e=>{const k=hitKey(e);if(k===hovK)return;hovK=k;if(route==='workforce')setBayHv(k&&k.startsWith('bay')?+k.slice(3):-1);document.querySelectorAll<El>('[data-hit]').forEach(b=>b.classList.toggle('hov',b.dataset.hit===k));document.body.style.cursor=k?'pointer':(mode==='globe'?'grab':'')});
  addEventListener('click',e=>{const k=hitKey(e);if(!k)return;const n=+k.replace(/\D+/,'');if(k.startsWith('bay')){wfGo(n+1);return}if(k.startsWith('stg'))goStage(n);else if(k.startsWith('st'))selStation(n);else if(k.startsWith('pod'))openPod(n);else if(k.startsWith('sr'))glance(n)});
  let wfShift=0,wfAt=0,wfFrom:(WfPose&{i:number})|null=null,wfT0=0,wfArr=true,lastPose:(WfPose&{i:number})|null=null,bayHv=-1,wfFil='all',eng=0,dom='All',band='All';
  const lerp3=(a:number[],b:number[],e:number)=>[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e,a[2]+(b[2]-a[2])*e];
  const FXW=[22,15.6,9.2,2.8,-3.6,-10],WFP:([P3,P3]|null)[]=[[[54,8,-13.5],[30,3.5,-13.5]],[[29.4,2.6,-5.6],[19,1.1,-5.6]],null,[[-9,4.5,-1.5],[-21.9,2.2,-14]],[[-35,12.5,3],[-50,3,-23]],[[-6,62,6],[-6,27,-31]],[[62,11,-13.5],[30,4,-13.5]]];
  function wfPose(i:number):{p:P3;l:P3}{if(i===3){const tx=Math.tan(25*Math.PI/180)*Math.min(1.9,Math.max(1.3,innerWidth/innerHeight)),a=-46*Math.PI/180-Math.atan(tx/3);return{p:WFP[3]![0],l:[-9+18*Math.sin(a),2.2,-1.5-18*Math.cos(a)]}}if(i!==2)return{p:WFP[i]![0],l:WFP[i]![1]};const F=window.FACTORY,g=F?F.podG():-1;let x;if(g<0)x=FXW[0]+(-g)*9.5;else{const k=Math.min(4,Math.floor(g));x=FXW[k]+(FXW[k+1]-FXW[k])*(g-k)}const px=Math.min(26,x);return{p:[px,3.2,-22.8],l:[px,1.3,-32.5]}}
  function wfGo(i:number){if(mode==='tour'){if(tour.route!=='workforce')startTour('workforce',0);tour.travel(i+1);return}if(mode!=='hub'||i===wfAt)return;closeDrawer();const F=window.FACTORY;wfFrom=lastPose?{p:lastPose.p.slice(),l:lastPose.l.slice(),i:wfAt}:null;wfAt=i;wfT0=performance.now();wfArr=false;setBayHv(-1);if(F){F.pod(i===2);if(i===2)F.podJump(-1.62);F.wfStop(i);if(i===3||i===4)F.campusIn()}}
  const WFAM=["Verified Talent (TaaS)","Product Engineering PODs","Workforce Capability","Campus Talent Factory","Ecosystem at Scale"],WPREV=['Consume verified capability.','Bring an industry problem.','Upgrade the team you already have.','Build the future talent supply.','Regional and sector capability building.'],FIL:Record<string,number[]>={all:[0,1,2,3,4],ent:[0,1,2],uni:[1,3],gov:[2,3,4],st:[1,0]};
  const bayTip=$('bayTip');
  function setBayHv(i:number){bayHv=i;document.querySelectorAll<El>('[data-bay]').forEach(b=>b.classList.toggle('hov',+b.dataset.bay! ===i));if(i>=0){bayTip.firstChild!.textContent='0'+(i+1)+' · '+WFAM[i];bayTip.lastChild!.textContent=WPREV[i]}}
  document.querySelectorAll<El>('[data-bay]').forEach(b=>{const i=+b.dataset.bay!;b.addEventListener('pointerenter',()=>setBayHv(i));b.addEventListener('focus',()=>setBayHv(i));b.addEventListener('pointerleave',()=>setBayHv(-1));b.addEventListener('blur',()=>setBayHv(-1));b.onclick=()=>wfGo(i+1)});
  function applyFil(k:string){wfFil=FIL[k]?k:'all';document.querySelectorAll('[data-fil]').forEach(x=>x.classList.toggle('on',(x as El).dataset.fil===wfFil));document.querySelectorAll<El>('#bayBtns [data-bay]').forEach(x=>{const i=+x.dataset.bay!,s=wfFil!=='all'&&FIL[wfFil].includes(i);x.classList.toggle('sug',s);x.style.order=s?String(FIL[wfFil].indexOf(i)-9):''})}
  document.querySelectorAll<El>('[data-fil]').forEach(b=>b.onclick=()=>{applyFil(b.dataset.fil!);tray?.setAudience(wfFil)});
  const DOMS=['AI/ML','Data','Cloud/DevOps','Cybersecurity','Full Stack'],STC:Record<string,string>={Available:'#C9A33A',Deployed:'#1E4632','In Training':'#FFFFFF'};
  const UNITD:TalentUnit[]=([[0,2,'Available'],[1,1,'Deployed'],[2,3,'Available'],[3,2,'In Training'],[4,1,'Available'],[0,3,'Deployed'],[1,2,'Available'],[2,1,'In Training'],[3,3,'Available'],[4,2,'Deployed'],[0,1,'In Training'],[2,2,'Available']] as [number,number,string][]).map(([d,b,s],i)=>({id:'U-'+String(i+1).padStart(2,'0'),dom:DOMS[d],band:'Band '+b,state:s}));
  const ENGL=['Reserve individual verified units.','Reserve a cross-functional squad as one unit.','Draw on senior expertise when you need it.','EmpowerED builds and runs the team, then transfers it to you.'];
  $('domBtns').innerHTML=['All'].concat(DOMS).map(d=>'<button class="opt'+(d==='All'?' on':'')+'" type="button" data-dom="'+d+'">'+(d==='All'?'All domains':d)+'</button>').join('');
  $('bandBtns').innerHTML=['All','Band 1','Band 2','Band 3'].map(d=>'<button class="opt'+(d==='All'?' on':'')+'" type="button" data-band="'+d+'">'+(d==='All'?'All bands':d)+'</button>').join('');
  $('shelf').innerHTML=UNITD.map(u=>'<div class="unit"><b>'+u.id+'</b><span>'+u.dom+'</span><span>'+u.band+'</span><span class="st" style="--c:'+STC[u.state]+'">'+u.state+'</span></div>').join('');
  const unitEls=[...document.querySelectorAll('.unit')];
  function paintShelf(){UNITD.forEach(u=>{u.off=(dom!=='All'&&u.dom!==dom)||(band!=='All'&&u.band!==band)});const avail=UNITD.map((u,i)=>!u.off&&u.state==='Available'?i:-1).filter(i=>i>=0);const grp=eng===1||eng===3?[0,1,2,4,6].filter(i=>!UNITD[i].off):eng===2?UNITD.map((u,i)=>u.band==='Band 3'&&!u.off?i:-1).filter(i=>i>=0):avail.slice(0,1);UNITD.forEach((u,i)=>{u.grp=grp.includes(i);unitEls[i].classList.toggle('off',u.off);unitEls[i].classList.toggle('grp',grp.includes(i))});$('engLine').textContent=ENGL[eng];window.FACTORY&&window.FACTORY.setUnits(UNITD)}
  document.querySelectorAll<El>('[data-dom]').forEach(b=>b.onclick=()=>{dom=b.dataset.dom!;document.querySelectorAll('[data-dom]').forEach(x=>x.classList.toggle('on',x===b));paintShelf()});
  document.querySelectorAll<El>('[data-band]').forEach(b=>b.onclick=()=>{band=b.dataset.band!;document.querySelectorAll('[data-band]').forEach(x=>x.classList.toggle('on',x===b));paintShelf()});
  document.querySelectorAll<El>('[data-eng]').forEach(b=>b.onclick=()=>{eng=+b.dataset.eng!;document.querySelectorAll('[data-eng]').forEach(x=>x.classList.toggle('on',x===b));paintShelf()});
  paintShelf();setTimeout(paintShelf,1500);
  $('modelBtn').onclick=()=>openDrawer('model');
  const STGN=['Discover','Design','Build','Test & Secure','Deploy & Operate','Demo & Validate'],ROLES=['Product/BA','AI/ML','Data','Full Stack','Cloud','Cyber'];
  $('wStg').innerHTML=STGN.map((n,i)=>'<button class="opt" type="button" data-wst="'+i+'">'+(i+1)+' · '+n.replace('&','&amp;')+'</button>').join('');
  document.querySelectorAll<El>('[data-wst]').forEach(b=>b.onclick=()=>window.FACTORY&&window.FACTORY.podJump(+b.dataset.wst!));
  $('podReplay').onclick=()=>window.FACTORY&&window.FACTORY.podJump(-1.62);
  const TYPES:Record<string,number[]>={'New product or platform':[0,3],'Data and analytics':[2,1],'AI or automation':[1,2],'Cloud migration or modernisation':[4,3],'Security hardening':[5,4]},OUTS:Record<string,number[]>={'Product / PoC':[2,5],'Talent capability evidence':[2,3],'Deployment pipeline':[4,3]};
  const escW=(s:string)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  $('cfgInd').innerHTML=INDS.map(d=>'<option>'+escW(d.name)+'</option>').join('');$('cfgType').innerHTML=Object.keys(TYPES).map(k=>'<option>'+k+'</option>').join('');$('cfgOut').innerHTML=Object.keys(OUTS).map(k=>'<option>'+escW(k)+'</option>').join('');
  function paintCfg(){const ld=TYPES[$<HTMLSelectElement>('cfgType').value],em=OUTS[$<HTMLSelectElement>('cfgOut').value];$('cfgPrev').innerHTML='<small>Illustrative POD · '+escW($<HTMLSelectElement>('cfgInd').value)+'</small><div class="opts">'+ROLES.map((r,i)=>'<span class="opt'+(ld.includes(i)?' lead':'')+'">'+r+(ld.includes(i)?' · lead':'')+'</span>').join('')+'</div><small>Lifecycle emphasis</small><div class="opts">'+STGN.map((n,i)=>'<span class="opt'+(em.includes(i)?' lead':'')+'">'+escW(n)+'</span>').join('')+'</div>'}
  ['cfgInd','cfgType','cfgOut'].forEach(id=>$(id).onchange=paintCfg);paintCfg();
  const leadCfg=()=>window.FACTORY?.setPodLead(TYPES[$<HTMLSelectElement>('cfgType').value]??[]);$('cfgType').addEventListener('change',leadCfg);setTimeout(leadCfg,1500);
  function wform(t:string){$('wfT').textContent=t;$<HTMLInputElement>('pfInd').value=$<HTMLSelectElement>('cfgInd').value;$<HTMLInputElement>('pfOut').value=$<HTMLSelectElement>('cfgOut').value;$('wfSum').textContent=t==='Design My POD'?'Configurator: '+$<HTMLSelectElement>('cfgInd').value+' · '+$<HTMLSelectElement>('cfgType').value+' · '+$<HTMLSelectElement>('cfgOut').value+' (illustrative).':'';openDrawer('wform')}
  window.__wform=wform;window.__goForm=(i,tt)=>goForm(i,tt);$('probBtn').onclick=()=>wform('Bring Us a Problem');$('designBtn').onclick=()=>wform('Design My POD');
  const MODS=['AI foundations','Copilots & prompting','Data literacy','Workflow automation','Responsible AI','Applied ML','LLM app engineering','MLOps & cloud AI'],LVLS=['Aware','Practitioner','Builder'];
  const LFN:Record<string,number[]>={'Finance':[1,1,1.2,1.1,1.1,.8,.5,.5],'HR & People':[1,1.1,.9,1,1.2,.5,.4,.3],'Operations':[1,1,1.1,1.3,1,.9,.6,.6],'Sales & Marketing':[1,1.3,1.1,1,.9,.7,.5,.3],'Customer Service':[1,1.3,.8,1.2,1,.5,.6,.3],'IT & Engineering':[.8,1,1.1,1.2,1,1.3,1.4,1.4],'Leadership':[1.2,.9,1,.8,1.3,.5,.3,.3]};
  const LOUT:Record<string,[number[],number[]]>={'Everyday productivity with AI':[[1,.9,.1],[3,3,2,1,2,0,0,0]],'Automate team workflows':[[.5,1,.5],[2,2,2,3,2,1,1,0]],'Better data-driven decisions':[[.6,1,.4],[2,1,3,1,2,2,0,0]],'Build AI products in-house':[[.2,.5,1],[1,1,2,1,2,3,3,3]],'Govern AI responsibly':[[1,.8,.2],[2,1,1,0,3,1,0,1]]};
  $('lensFn').innerHTML=Object.keys(LFN).map(k=>'<option>'+escW(k)+'</option>').join('');$('lensOut').innerHTML=Object.keys(LOUT).map(k=>'<option>'+k+'</option>').join('');
  let lensDeep=false;
  function paintLens(){const f=LFN[$<HTMLSelectElement>('lensFn').value],[Lv,w]=LOUT[$<HTMLSelectElement>('lensOut').value];let bs=0;const rows=MODS.map((m,i)=>{const c=Lv.map((l,j)=>{const v=Math.min(3,Math.round(w[i]*f[i]*l));if(j===2)bs+=v;return v});return{m,c}});lensDeep=bs>=7;
    $('heat').innerHTML='<span></span>'+LVLS.map(l=>'<span class="hh">'+l+'</span>').join('')+rows.map(r=>'<span class="hm'+(Math.max(...r.c)>=2?' key':'')+'">'+escW(r.m)+'</span>'+r.c.map(v=>'<i class="h'+v+'" title="'+['No need','Light','Moderate','High'][v]+'"></i>').join('')).join('');
    $('lensV').innerHTML=lensDeep?'<small>Lens reading</small><b>Deep technical capability</b><p>The need concentrates at Builder level. A Product Engineering POD builds it on a real problem, with your people in the team.</p><button class="opt" type="button" id="lensGo">See Product Engineering PODs →</button>':'<small>Lens reading</small><b>Broad AI fluency</b><p>The need sits at Aware and Practitioner level, across the whole team. Start with AI for Everyone, then add academy modules.</p><button class="opt" type="button" id="lensGo">Go to AI for Everyone ↑</button>';
    $('lensGo').onclick=()=>lensDeep?wfGo(2):toGlobe();window.FACTORY&&window.FACTORY.setTeam($<HTMLSelectElement>('lensFn').value)}
  ['lensFn','lensOut'].forEach(id=>$(id).onchange=paintLens);paintLens();setTimeout(paintLens,1500);
  const CONS=['AI Centres of Excellence','Curriculum pathway','Faculty development','Student PODs','Labs','Industry problem statements','ETAF™ validation','Talent pipeline'];
  const ACTS:[string,number[],string][]=[['University',[0,1,4],'Hosts the AI Centre of Excellence and labs, and co-owns the curriculum pathway.'],['Industry',[5,3,7],'Brings real problem statements, mentors Student PODs and hires from the talent pipeline.'],['EmpowerED',[1,2,3,6],'Designs the curriculum pathway, develops faculty, runs Student PODs and validates student work through ETAF™.'],['Government / Ecosystem',[0,4,7],'Backs centres of excellence and labs, and links the talent pipeline to regional priorities.']];
  let act=0,con=-1;
  $('actBtns').innerHTML=ACTS.map((a,i)=>'<button class="opt" type="button" data-act="'+i+'">'+escW(a[0])+'</button>').join('');
  $('conBtns').innerHTML=CONS.map((c,i)=>'<button class="opt" type="button" data-con="'+i+'">'+escW(c)+'</button>').join('');
  function paintAct(){document.querySelectorAll<El>('[data-act]').forEach(b=>b.classList.toggle('on',+b.dataset.act! ===act));document.querySelectorAll<El>('[data-con]').forEach(b=>{const i=+b.dataset.con!;b.classList.toggle('lead',ACTS[act][1].includes(i));b.classList.toggle('sel',i===con)});$('actV').innerHTML='<small>'+escW(ACTS[act][0])+' contributes</small><p>'+escW(ACTS[act][2])+'</p>';window.FACTORY&&(window.FACTORY.setCampus(ACTS[act][1],con),window.FACTORY.setActor(act))}
  document.querySelectorAll<El>('[data-act]').forEach(b=>b.onclick=()=>{act=+b.dataset.act!;con=-1;paintAct()});
  document.querySelectorAll<El>('[data-con]').forEach(b=>b.onclick=()=>{const i=+b.dataset.con!;con=con===i?-1:i;if(con===3&&window.FACTORY)window.FACTORY.podCross();paintAct()});
  paintAct();setTimeout(paintAct,1500);
  $('campReplay').onclick=()=>window.FACTORY&&window.FACTORY.campusIn(true);
  let eSec=0,eMode=0;const eAct:Record<string,number>={c:1,i:1,g:1};
  $('secBtns').innerHTML=ECO.sect.map((s,i)=>'<button class="opt" type="button" data-sec="'+i+'">'+s+'</button>').join('');
  function ecoLinks(){const N=ECO.nodes,idx=N.map((n,i)=>i).filter(i=>eAct[N[i][0]]&&N[i][3].includes(eSec));if(eMode===1)return idx;const cap:Record<string,number>={c:1,i:2,g:1};return idx.filter(i=>cap[N[i][0]]-->0)}
  function paintEco(){document.querySelectorAll<El>('[data-sec]').forEach(b=>b.classList.toggle('on',+b.dataset.sec! ===eSec));document.querySelectorAll<El>('[data-ea]').forEach(b=>b.classList.toggle('on',!!eAct[b.dataset.ea!]));document.querySelectorAll<El>('[data-em]').forEach(b=>b.classList.toggle('on',+b.dataset.em! ===eMode));
    const Lk=ecoLinks(),cnt=(t:string)=>Lk.filter(i=>ECO.nodes[i][0]===t).length,nc=cnt('c');
    $('ecoStats').innerHTML=[[nc,'Campuses'],[cnt('i'),'Employers'],[cnt('g'),'Agencies'],[Lk.length?(eMode?nc*120:24):0,'Learners, first cohort']].map(([v,k])=>'<div><b>'+v+'</b><span>'+k+'</span></div>').join('');
    $('ecoLine').textContent=!Lk.length?'Switch on at least one actor to see the links.':eMode?'A regional hub links every campus, employer and agency working on '+ECO.sect[eSec]+'.':'A pilot POD starts small: one campus, two employers and one agency around a single '+ECO.sect[eSec]+' problem.';
    window.FACTORY&&window.FACTORY.setNet({sec:eSec,act:Object.assign({},eAct),mode:eMode,links:Lk})}
  document.querySelectorAll<El>('[data-sec]').forEach(b=>b.onclick=()=>{eSec=+b.dataset.sec!;paintEco()});
  document.querySelectorAll<El>('[data-ea]').forEach(b=>b.onclick=()=>{const k=b.dataset.ea!;eAct[k]=eAct[k]?0:1;paintEco()});
  document.querySelectorAll<El>('[data-em]').forEach(b=>b.onclick=()=>{eMode=+b.dataset.em!;paintEco()});
  paintEco();setTimeout(paintEco,1500);
  $('caseBtn').onclick=()=>openDrawer('case');
  const ENGN=['Individual Talent','Dedicated POD','Expert-on-Demand','Build–Operate–Transfer'];
  function selText(i:number){if(i===0)return'Engagement model: '+ENGN[eng]+' · Domain: '+dom+' · Band: '+band;if(i===1)return'Industry: '+$<HTMLSelectElement>('cfgInd').value+' · Problem type: '+$<HTMLSelectElement>('cfgType').value+' · Outcome: '+$<HTMLSelectElement>('cfgOut').value;if(i===2)return'Function: '+$<HTMLSelectElement>('lensFn').value+' · Outcome: '+$<HTMLSelectElement>('lensOut').value+' · Lens reading: '+(lensDeep?'Deep technical capability':'Broad AI fluency');if(i===3)return'Actor: '+ACTS[act][0]+' · Contributions: '+ACTS[act][1].map(k=>CONS[k]).join(', ')+(con>=0?' · Starting with: '+CONS[con]:'');return'Sector: '+ECO.sect[eSec]+' · Shape: '+(eMode?'Regional hub':'Pilot POD')+' · Actors: '+[['c','Campuses'],['i','Industry'],['g','Government']].filter(a=>eAct[a[0]]).map(a=>a[1]).join(', ')}
  function goForm(i:number,title:string,fromCmp?:boolean){const s=selText(i)+(fromCmp&&cmp.length>1?' · Compared with: '+cmp.filter(k=>k!==i).map(k=>WFAM[k]).join(', '):'');
    if(i===0){$('mSum').textContent=s;const f=$<HTMLFormElement>('modelForm');if(f){if(dom!=='All')f.domain.value=dom;if(band!=='All')f.band.value=band;f.shape.value=eng===1?'Squad':'Individual role'}openDrawer('model')}
    else if(i===1){wform(title||'Bring Us a Problem');$('wfSum').textContent=s}
    else{$('bfE').textContent=WFAM[i];$('bfT').textContent=title;$<HTMLTextAreaElement>('bfSel').value=s;$('bForm').hidden=false;$('bfDone').hidden=true;openDrawer('bform')}}
  markFormUnavailable($<HTMLFormElement>('bForm'));
  $('assessBtn').onclick=()=>goForm(2,'Assess My Workforce');$('acadBtn').onclick=()=>goForm(2,'Design a Corporate Academy');
  $('campBtn').onclick=()=>goForm(3,'Build a Campus Talent Factory');$('spodBtn').onclick=()=>{con=3;paintAct();window.FACTORY&&window.FACTORY.podCross();goForm(3,'Launch a Student POD')};
  $('sectBtn').onclick=()=>goForm(4,'Design a Sector Talent Program');$('hubBtn').onclick=()=>{eMode=1;paintEco();goForm(4,'Explore a Regional Talent Hub')};
  const NEXT_L=['Model My Requirement','Bring Us a Problem','Assess My Workforce','Build a Campus Talent Factory','Design a Sector Talent Program'];
  const sv=(id:string)=>$<HTMLSelectElement>(id).value;
  function wfControls(){return{eng,dom,band,ind:sv('cfgInd'),type:sv('cfgType'),out:sv('cfgOut'),lfn:sv('lensFn'),lout:sv('lensOut'),act,con,sec:eSec,em:eMode,ea:Object.assign({},eAct)}}
  const tray:SelectionTray=new SelectionTray({text:i=>selText(i),next:i=>NEXT_L[i],openBay:i=>{closeDrawer();if(mode==='tour'&&tour.route==='story'){setPath(pathOfBay(i),true);go({k:'bay',stop:(['talent','pods','teams','campus','region'] as const)[i]})}else wfGo(i+1);setTimeout(()=>{if(tourWf===i+1||wfAt===i+1)openStop('workforce',i+1)},reduce?200:1600)},openSummary:()=>openDrawer('wsum'),changed:()=>paintPicks()});
  function pathOfBay(i:number){return['workforce/verified-talent/','workforce/product-engineering/','workforce/capability/','workforce/campus/','workforce/ecosystem/'][i]}
  // Restore last visit's choices.
  {const c=tray.data.ctl as Record<string,unknown>,num=(v:unknown,d:number,max:number)=>typeof v==='number'&&v>=-1&&v<max?v:d,setSel=(id:string,v:unknown)=>{const el=$<HTMLSelectElement>(id);if(typeof v==='string'&&[...el.options].some(o=>o.value===v))el.value=v};
    eng=num(c.eng,0,4);if(typeof c.dom==='string'&&(c.dom==='All'||DOMS.includes(c.dom)))dom=c.dom;if(typeof c.band==='string'&&/^(All|Band [123])$/.test(c.band))band=c.band;
    document.querySelectorAll<El>('[data-eng]').forEach(x=>x.classList.toggle('on',+x.dataset.eng! ===eng));document.querySelectorAll<El>('[data-dom]').forEach(x=>x.classList.toggle('on',x.dataset.dom===dom));document.querySelectorAll<El>('[data-band]').forEach(x=>x.classList.toggle('on',x.dataset.band===band));
    setSel('cfgInd',c.ind);setSel('cfgType',c.type);setSel('cfgOut',c.out);setSel('lensFn',c.lfn);setSel('lensOut',c.lout);
    act=Math.max(0,num(c.act,0,ACTS.length));con=num(c.con,-1,CONS.length);eSec=Math.max(0,num(c.sec,0,ECO.sect.length));eMode=num(c.em,0,2)===1?1:0;
    if(c.ea&&typeof c.ea==='object')for(const k of ['c','i','g'])eAct[k]=(c.ea as Record<string,number>)[k]?1:0;
    applyFil(tray.data.aud);paintShelf();paintCfg();paintLens();paintAct();paintEco()}
  // Save whenever a bay control changes.
  {const WFC='[data-eng],[data-dom],[data-band],#cfgInd,#cfgType,#cfgOut,#lensFn,#lensOut,#actBtns [data-act],[data-con],[data-sec],[data-ea],[data-em],#spodBtn,#hubBtn',save=(e:Event)=>{if((e.target as Element).closest?.(WFC))setTimeout(()=>tray.saveControls(wfControls()),0)};document.addEventListener('click',save);document.addEventListener('change',save)}
  // "Add to my selection" in each bay (mirrored into the drawer like the other bay controls).
  [1,2,3,4,5].forEach(n=>{const acts=$('w'+n+'p').querySelector('.acts');const b=document.createElement('button');b.type='button';b.className='opt pick';b.dataset.pick=String(n-1);b.onclick=()=>tray.toggle(n-1);acts?.after(b)});
  function paintPicks(){document.querySelectorAll<El>('[data-pick]').forEach(b=>{const on=tray.has(+b.dataset.pick!);b.classList.toggle('on',on);b.textContent=on?'✓ In your selection':'+ Add to my selection'})}
  paintPicks();
  const NEXT=['Model My Requirement','Bring Us a Problem','Assess My Workforce','Build a Campus Talent Factory','Design a Sector Talent Program'],CMPR=['Best when','Engagement shape','What EmpowerED produces','What you contribute','Evidence / assurance'];
  const CMPD=[['You need verified people in roles now, without running a hiring cycle.','Individual talent, a dedicated POD, expert-on-demand or build–operate–transfer.','Deployment-ready talent matched to your roles.','Role requirements, onboarding and day-to-day direction.','An ETAF™ readiness passport for every unit.'],
    ['You have a real problem and want a working product or PoC.','A cross-functional POD taking the problem through six stages, Discover to Demo & Validate.','A product or PoC, capability evidence and a deployment pipeline.','The problem statement, access to data and a product owner.','Stage demos and ETAF™ evidence from the build.'],
    ['Your existing teams need AI capability in the roles they hold.','A corporate academy, L&D as a service or a Human + AI workforce programme.','Reskilled teams, mapped to the modules each function needs.','Team access, time for learning and the outcomes to target.','Baseline and post-programme capability assessment.'],
    ['You want a future talent supply built with a university.','A campus extension of EmpowerED: centre of excellence, curriculum pathway and Student PODs.','Industry-ready graduates and a talent pipeline.','Campus, faculty, labs or problem statements, depending on your role.','ETAF™ validation of student work.'],
    ['You are building capability across a sector or region.','A pilot POD or a regional hub linking campuses, industry and government.','A sector talent programme and a regional pipeline.','Sector priorities, convening power and programme sponsorship.','Programme reporting across linked partners.']];
  let cmp:number[]=[];
  function toggleCmp(i:number){const k=cmp.indexOf(i);if(k>=0)cmp.splice(k,1);else if(cmp.length<3)cmp.push(i);cmp.sort((a,b)=>a-b);paintCmp()}
  function paintCmp(){document.querySelectorAll<El>('.cmpRow').forEach(el=>{const i=+el.dataset.cmp!,on=cmp.includes(i),full=!on&&cmp.length>=3;el.innerHTML='<button class="opt'+(on?' on':'')+'" type="button" data-ct="'+i+'"'+(full?' disabled':'')+'>'+(on?'✓ In compare':full?'Compare full (3/3)':'+ Add to compare')+'</button>'+(cmp.length?'<button class="backBtn" type="button" data-cgo>View comparison ('+cmp.length+'/3) →</button>':'')});
    $('cmpBtns').innerHTML=WFAM.map((n,i)=>{const on=cmp.includes(i);return'<button class="opt'+(on?' on':'')+'" type="button" data-ct="'+i+'"'+(!on&&cmp.length>=3?' disabled':'')+'>0'+(i+1)+' · '+escW(n)+'</button>'}).join('');
    $('cmpT').innerHTML=!cmp.length?'<p class="cempty">Add up to three bays with “Add to compare” on any bay, or pick them above.</p>':'<div class="ctab" style="--n:'+cmp.length+'"><span class="cl" style="border-bottom:2px solid #C9A33A"></span>'+cmp.map(i=>'<div class="ch"><small>0'+(i+1)+'</small><b>'+escW(WFAM[i])+'</b><button type="button" data-ct="'+i+'" aria-label="Remove '+escW(WFAM[i])+'">×</button></div>').join('')+CMPR.map((r,k)=>'<span class="cl">'+r+'</span>'+cmp.map(i=>'<p>'+escW(CMPD[i][k])+'</p>').join('')).join('')+'<span class="cl">Next step</span>'+cmp.map(i=>'<div><button class="cta" type="button" data-nx="'+i+'">'+NEXT[i]+' <span>→</span></button></div>').join('')+'</div>';
    document.querySelectorAll<El>('[data-ct]').forEach(b=>b.onclick=()=>toggleCmp(+b.dataset.ct!));document.querySelectorAll<El>('[data-cgo]').forEach(b=>b.onclick=()=>wfGo(6));document.querySelectorAll<El>('[data-nx]').forEach(b=>b.onclick=()=>goForm(+b.dataset.nx!,NEXT[+b.dataset.nx!],true))}
  paintCmp();
  const podEls=[...document.querySelectorAll('#nodeBtns .opt')],loopEls=[...document.querySelectorAll('#loop span')];
  function wfFrame(F:FactoryApi,now:number,W:number,H:number){const on=mode==='tour'?tourWf>=0:route==='workforce'&&(mode==='hub'||mode==='fly');F.setWf(on);if(!on){F.pod(false);vis(bayTip,0);return}
    const atDock=(mode==='hub'||(mode==='tour'&&tourWf===0))&&wfAt===0&&wfArr;if(atDock&&W>900){const pr=$('w0p').getBoundingClientRect().right+30,p=F.project(32,2.5,-3.5);if(Number.isFinite(p.x)){if(p.x<pr)wfShift=Math.min(18,wfShift+.25);else if(p.x>pr+80&&wfShift>0)wfShift=Math.max(0,wfShift-.25)}}else if(W<=900)wfShift=0;F.setBays(atDock?bayHv:-1,wfAt===6?cmp:atDock&&wfFil!=='all'?FIL[wfFil]:[],wfAt===6&&cmp.length?[0,1,2,3,4].filter(i=>!cmp.includes(i)):[]);
    if(atDock&&bayHv>=0){const p=F.project(30.1,6,[-3.5,-8.5,-13.5,-18.5,-23.5][bayHv]);bayTip.style.transform='translate('+Math.min(Math.max(p.x-130,12),W-272)+'px,'+Math.max(p.y-bayTip.offsetHeight-14,72)+'px)';vis(bayTip,1);bayTip.style.pointerEvents='none'}else vis(bayTip,0);
    if(wfAt===1){const k=Math.floor(now/1300)%4;loopEls.forEach((l,i)=>l.classList.toggle('on',i===k))}
    if(wfAt===2){const tp=F.podTime(),g=F.podG();podEls.forEach((n,i)=>{n.classList.toggle('asm',tp<2.8+i*.3);n.classList.toggle('lit',tp>=2.8+i*.3)});const cs=g<0?-1:Math.round(g);document.querySelectorAll<El>('[data-wst]').forEach(b=>b.classList.toggle('on',+b.dataset.wst! ===cs))}}
  const sW=$('sceneW'),tW=$('textW'),svgW=$('svgW');let lastRW=-1,flowT0=null;
  const vis=(el:El,o:number)=>{el.style.opacity=String(o);el.style.visibility=o>.01?'visible':'hidden';el.style.pointerEvents=o>.5?'auto':'none'};
  const t0=performance.now();
  function step(now:number,snap:boolean){
    const tgt=scrollY;yS=(reduce||snap)?tgt:yS+(tgt-yS)*.16;if(Math.abs(tgt-yS)<.4)yS=tgt;
    const W=innerWidth,H=innerHeight,v=yS/H,F=window.FACTORY,intro=mode==='intro';
    const rA=reduce?1:Math.min(1,(now-t0)/1800);if(rA!==lastRA){svgA.style.setProperty('--r',String(rA));lastRA=rA}
    const oA=intro?1-sm(2,2.45,v):0;sA.style.opacity=String(oA);sA.style.visibility=oA>0?'visible':'hidden';
    if(oA>0){const tw=tA.scrollWidth,pa=Math.min(1,Math.max(0,v/2.1));tA.style.transform=reduce?'translate('+(W-tw)/2+'px,-50%)':'translate('+(W*.45-pa*(tw+W*.35))+'px,-50%)'}
    const oB=intro?sm(2,2.45,v)*(1-sm(3.3,3.8,v)):0;sB.style.opacity=String(oB);sB.style.visibility=oB>0?'visible':'hidden';
    const rB=reduce?1:sm(2.1,3,v);if(Math.abs(rB-lastRB)>.001){svgB.style.setProperty('--r',String(rB));lastRB=rB}
    const oTB=reduce?1:sm(2.35,2.8,v);tB.style.opacity=String(oTB);tB.style.transform='translate(-50%,'+(1-oTB)*24+'px)';
    tB2.style.opacity=String(reduce?1:sm(2.72,2.98,v));svgB.style.opacity=String(intro&&!reduce?1-sm(3.0,3.3,v):1);
    cv.style.opacity=String(intro?sm(3.3,3.8,v):1);
    hint.style.opacity=String(intro?1-sm(3.45,3.75,v):0);{const ph=$('podHint');if(ph)ph.style.opacity=String(intro&&pendLine?1-sm(4.1,4.28,v):0);const at=atPods();if(at&&!wasAtPods){podLock=true;podLastW=performance.now()}wasAtPods=at}
    const sRaw=(v-B1)/SEG;let s=-9,last=0,liftO=0,xfO=0;
    if(F){
      if(intro){if(!window.__storyShowing&&!entered)beginEntry()}
      else if(mode==='opening'){while(pendWorld.length)F.addWorld(pendWorld.shift()!);const tNow=performance.now(),dt=openLast?Math.min(.1,Math.max(0,(tNow-openLast)/1000)):0;openLast=tNow;const o=opening.frame(tNow,innerWidth<=760&&innerHeight>innerWidth?'phone':innerHeight<=500?'land':'desk');F.build(o.build);F.poseAt(o.pos,o.look);story.openingPose(o,o.pos,dt);if(o.reveal)F.render('route',0);F.renderOpening(o.stage.scene,o.stage.camera,o.reveal)}
      else if(mode==='gIn'||mode==='gOut'){const gi=mode==='gIn',raw=Math.min(1,(now-gT0)/(gi?(reduce?1400:GIN):2600)),t=reduce&&!gi?1:raw;if(gi&&reduce){liftO=1-Math.abs(raw*2-1);xfO=liftO;F.globeStep(raw<.5?0:1)}else{if(gi)liftO=sm(.04,.16,raw)*(1-sm(.8,.94,raw));F.globeStep(t)}F.render('globe',0);
        if(t>=1){if(mode==='gIn'){F.globeArrive();mode='globe';document.body.style.cursor='grab';if(pendSide>=0){const k=pendSide,v=pendView;pendSide=-1;pendView='path';openSide(k,v);if(v==='path'){lvl=2;paintLv()}}}else{F.globeReset();document.body.style.cursor='';const n=gNext,ret=gReturn;gNext=null;gReturn=null;paintGlobeBack();
          if(n){const p=n==='career'?'career/':'workforce/';setPath(p,true);go(routeFor(p)!.dest)}
          else if(ret){startTour(ret.route,ret.index);syncPath(pathOfStop(ret.route,ret.index))}
          else{enterLobby();setPath('',true)}}}}
      else if(mode==='globe'){F.globeHold();F.render('globe',0)}
      else if(mode==='tour'){const dt=Math.max(0,Math.min(.1,(now-(tourLast||now))/1000));if(now>tourLast||now<tourLast-5e3)tourLast=now;const fr=tour.update(dt);F.poseAt(fr.pos,fr.look);route=tour.route;
        s=tourCar>=0?tourCar:tourWf>=0?tourWf:-9;floorX=tourCar===5&&tourSettled?curStage:-1;F.render('route',0)}
      else{
        const st=F.stops(route!);last=st.length-1;let k=0;
        if(mode==='fly'){const t=reduce?1:Math.min(1,(now-flyT0)/(st[0]?2600:1600));flyE=t;k=st[0]?ease(t)*st[0]:-1-ease(t);if(t>=1){podFly=false;if(route==='workforce'){mode='hub';wfAt=0;wfFrom=null;if(podWf!=null){const n=podWf;podWf=null;requestAnimationFrame(()=>wfGo(n))}}else mode='route'}else if(scrollY>1)jump(0)}
        if(mode==='hub'){const t=reduce||!wfFrom?1:Math.min(1,(now-wfT0)/1800),e=ease(t),tg=wfPose(wfAt);let P,L;if(wfFrom&&t<1){P=lerp3(wfFrom.p,tg.p,e);P[1]+=Math.sin(Math.PI*e)*(wfAt===0||wfFrom.i===0?4:8);L=lerp3(wfFrom.l,tg.l,e)}else{P=tg.p;L=tg.l}lastPose={p:P,l:L,i:wfAt};wfArr=t>=1;F.poseAt(P,L);s=wfAt}
        if(mode==='route'){const vp=Math.max(0,v/SEG),hs=HOLD[route!];floorX=-1;if(hs&&vp>hs[0]){if(vp<hs[0]+hs[1]){s=hs[0];const u=(vp-hs[0])/hs[1];floorX=reduce?Math.round(u*5):dwell(u*5)}else s=vp-hs[1]}else s=vp;s=Math.min(last,s);
          if(floorX>=0)k=st[hs[0]]+floorX;else{const sc=reduce?Math.round(s):s,i=Math.min(last-1,Math.floor(sc)),f=sc-i,fe=reduce?(f<.5?0:1):sm(.12,.88,f),k0=(hs&&i===hs[0])?st[i]+5:st[i];k=k0+fe*(st[i+1]-k0)}}
        if(mode==='back'){const t=reduce?1:Math.min(1,(now-backT0)/2200);F.poseBack(t);F.render('route',0);if(t>=1)finishBack()}
        else{if(mode==='hub'){}else if(k<0)F.poseFly(route!,-1-k);else F.poseRoute(route!,k);if(mode==='fly'&&podFly&&!reduce)F.fromSnap(sm(0,.55,flyE));F.render('route',0)}
      }
    }
    let oW=0;if(false){if(mode==='fly')oW=reduce?1:sm(.45,1,(now-flyT0)/1600);else if(mode==='route')oW=1-sm(.3,.75,s)}
    sW.style.opacity=String(oW);sW.style.visibility=oW>0?'visible':'hidden';
    if(oW>0){const rW=reduce?1:Math.min(1,Math.max(0,(now-flyT0-700)/1400));if(rW!==lastRW){svgW.style.setProperty('--r',String(rW));lastRW=rW}const tw=tW.scrollWidth,fin=reduce?1:ease(Math.min(1,Math.max(0,(now-flyT0-700)/1100))),sc=mode==='route'?Math.max(0,s):0;tW.style.transform='translate('+(reduce?(W-tw)/2:(W-tw)/2+(1-fin)*W*.6-sc*(W+tw)*.7)+'px,-50%)'}
    if(F)wfFrame(F,now,W,H);
    const oCh=mode==='intro'&&F?sm(.1,.35,sRaw):0;
    vis(title,mode==='intro'?sm(-.1,.2,sRaw):0);ask.style.opacity=String(oCh);
    if(F&&F.outline&&!fl){const S=F.outline();svgF.innerHTML=S.map(()=>'<line pathLength="1" class="ln" style="--d:'+(Math.random()*.3).toFixed(3)+'"></line>').join('');fl=[...svgF.children].map((el,i)=>[el,S[i]])}
    const oF=intro&&F?sm(2.98,3.12,v)*(1-sm(3.7,4.1,v)):0;sF.style.opacity=String(oF);sF.style.visibility=oF>0?'visible':'hidden';
    if(oF>0&&fl){svgF.style.setProperty('--r',String(reduce?1:sm(3.0,3.45,v)));fl.forEach(([el,[a,b]])=>{const p=F!.project(...a),q=F!.project(...b);el.setAttribute('x1',p.x.toFixed(1));el.setAttribute('y1',p.y.toFixed(1));el.setAttribute('x2',q.x.toFixed(1));el.setAttribute('y2',q.y.toFixed(1))})}
    if(oCh>0){const c=([[-30,0,0],[30,0,0],[-30,16,0],[30,16,0],[30,16,-60]] as P3[]).map(a=>F!.project(...a)),xs=c.map(p=>p.x),ys=c.map(p=>p.y),l=Math.min(...xs),tp=Math.min(...ys);bldg.style.transform='translate('+l+'px,'+tp+'px)';bldg.style.width=(Math.max(...xs)-l)+'px';bldg.style.height=(Math.max(...ys)-tp)+'px'}
    vis(bldg,0);
    {const zw=$('zones');let o=0;if(oCh>0&&spOn){o=oCh;const p=F!.project(0,11.2,-4),w=zw.offsetWidth,x=Math.min(Math.max(p.x-w/2,12),W-w-12),y=Math.max(p.y-zw.offsetHeight,72);zw.style.transform='translate('+x+'px,'+y+'px)'}zw.style.opacity=String(o);zones.forEach((z,i)=>z.classList.toggle('on',o>0&&now-spT0>i*380))}
    doors.forEach(d=>{let o=0;if(o>0){const p=F!.project(...anchor(d));if(!p.vis)o=0;const dy=Math.max(p.y,64+d.offsetHeight+26);d.style.transform='translate('+p.x+'px,'+dy+'px) translate(-50%,calc(-100% - 18px))'}vis(d,o)});
    tags.forEach(t=>{let o=0;if(mode==='route'&&t.dataset.route===route){o=1-sm(.25,.45,Math.abs(s-(+t.dataset.stop!)));if(o>0){const p=F!.project(...anchor(t));if(!p.vis)o=0;const x=Math.min(Math.max(p.x,24),W-360),y=Math.min(Math.max(p.y,t.dataset.route==='workforce'?64+((t.lastChild as El).offsetHeight||245)+30:230),H-110);t.style.transform='translate('+x+'px,'+y+'px)'}}vis(t,o)});
    let oReg=0;curS=s;
    if(F&&F.setCrate){const car=route==='career'&&(mode==='route'||(mode==='tour'&&tourCar>=0));F.setCrate(car&&s>3.6?(floorX>=0?floorX:s<5?-1+sm(4.3,5,s):5):null);F.setWalk(car&&s>6.2);
      // ETAF gates stay dark unless the visitor plays the labelled example review; nothing implies a real pass.
      const etafCar=car||(mode==='tour'&&route==='story'&&tourCar>=0);if(etafCar&&Math.abs(s-6)<.45&&performance.now()<etafDemoUntil)F.etaf(true);else F.etaf(false);etafNote.hidden=!(performance.now()<etafDemoUntil&&etafCar&&Math.abs(s-6)<.8);
      const lit=F.etafLit();ppRows.forEach((r,i)=>r.classList.toggle('in',i<lit));
      const cs=floorX>=0?Math.round(floorX):s>5?5:0;if(cs!==curStage&&mode!=='tour'){curStage=cs;showStage(cs)}}
    vis(lpW,route==='career'&&(mode==='route'||mode==='fly')?1:0);if(route!=='career'&&!lpL.hidden){lpL.hidden=true;lpB.setAttribute('aria-expanded','false')}
    if(F&&F.setCareer){const cf=route==='career'?(mode==='fly'?1:(mode==='route'||(mode==='tour'&&tourCar>=0))?1-sm(2.3,2.8,s):0):0;F.setCareer(cf,hasResult,mode==='tour'?(W>=768&&cd.classList.contains('open')?.7:0):(((route==='career'&&(mode==='route'||mode==='fly'))||(route==='workforce'&&mode==='hub'))&&W>=768)?(cd.classList.contains('open')?1.2:1):0)}
    {const oc=0;
     if(oc>0){const pr=$(Math.abs(s-2)<Math.abs(s)?'cp2':'cp0').getBoundingClientRect(),wide=W>900,placed:CorPlace[]=[];
      cors.map(c=>{const p=F!.project(...anchor(c)),w=(c.firstChild as El).offsetWidth,hh=(c.firstChild as El).offsetHeight;return{c,p,w,hh}}).sort((a,b)=>a.p.x-b.p.x).forEach(t=>{let o=oc;if(!t.p.vis)o=0;
       let x=t.p.x,y=t.p.y;const minX=(wide?pr.right+12:10)+t.w/2,minY=(wide?64:pr.bottom+12)+t.hh+18;x=Math.min(Math.max(x,minX),W-10-t.w/2);y=Math.min(Math.max(y,minY),H-100);
       placed.push({t,o,x,y,l:x-t.w/2,r:x+t.w/2,tp:y-12-t.hh,b:y-12})});
      const clash=placed.some((a,i)=>placed.some((b,j)=>j>i&&a.l<b.r+8&&a.r>b.l-8&&a.tp<b.b+8&&a.b>b.tp-8));
      if(clash){const L=wide?pr.right+12:10;let cx=L,cy=wide?72:pr.bottom+12,rowH=0;const ord=['gate','launch','pro','accel'];
       placed.sort((a,b)=>ord.indexOf(a.t.c.dataset.k||'gate')-ord.indexOf(b.t.c.dataset.k||'gate')).forEach(q=>{if(cx+q.t.w>W-10&&cx>L){cx=L;cy+=rowH+8;rowH=0}q.x=cx+q.t.w/2;q.y=cy+q.t.hh+12;cx+=q.t.w+8;rowH=Math.max(rowH,q.t.hh)})}
      placed.forEach(q=>{q.t.c.classList.toggle('flow',clash);q.t.c.style.transform='translate('+q.x+'px,'+q.y+'px)';vis(q.t.c,q.o)})}
}
    if(F)b3Frame(F,W,H,s);
    stopFrame(now,s);
    BLOCKS.forEach(b=>{const o=((mode==='route'||mode==='hub')&&route===b.r)?1-sm(.2,.45,Math.abs(s-b.s)):0;vis(b.el,o)});
    hdrLogo.style.opacity=String(1-oReg);hdrLogo.style.pointerEvents=oReg>.5?'none':'auto';
    if(window.FACTORY)placeGallery(window.FACTORY);{const on=mode==='tour'&&tour.route==='evidence';galO.forEach(o=>o.visible=on)}
    tray.visible(!flatOpen&&!cd.classList.contains('open')&&mode!=='opening'&&mode!=='globe'&&mode!=='gIn'&&mode!=='gOut'&&(tourWf>=0||mode==='hub'||currentPath().startsWith('workforce/')));
    hdrBack.style.display=(((mode!=='intro'&&mode!=='gIn'&&mode!=='opening')&&!(mode==='tour'&&tour.index===0))||(flatOpen&&!flatAuto))?'inline-flex':'none';const cr=flatOpen?'EMPOWERED · TEXT VIEW':(mode==='globe'||mode==='gIn'||mode==='gOut')?'AI FOR EVERYONE':mode==='tour'?(tour.route==='career'?'CAREER':tour.route==='story'?'STORY':tour.route==='evidence'?'EVIDENCE':'WORKFORCE')+' · '+(TOURS[tour.route][tour.index]?.label||'').toUpperCase():'EMPOWERED';if(crumb.textContent!==cr)crumb.textContent=cr;
    vis(rail,(mode==='route'||mode==='fly'||mode==='globe'||mode==='hub')?1:0);
    const gl=mode==='globe',act=gl?(whoOpen?2:sel>=0?1:0):Math.round(Math.max(0,s));dots.forEach((d,i)=>{d.classList.toggle('on',i===act);d.classList.toggle('done',!gl&&i<act);if(i===act)d.setAttribute('aria-current','step');else d.removeAttribute('aria-current')});
    vis(lift,liftO);xf.style.opacity=String(xfO);
    const inG=mode==='globe';document.documentElement.classList.toggle('darkWorld',inG||mode==='gIn');vis(gTitle,inG?((side.classList.contains('open')||whoOpen)?0:1):0);gHint.style.opacity=String(inG&&!side.classList.contains('open')&&!whoOpen?1:0);
    if(inG&&F){const rs=[gTitle.getBoundingClientRect()];if(side.classList.contains('open'))rs.push(side.getBoundingClientRect());if(whoOpen)rs.push($('gWho').getBoundingClientRect());
      const placed:number[][]=[];F.nodes().map((p,i):[ScreenPoint,number]=>[p,i]).sort((a,b)=>+(b[1]===sel)-+(a[1]===sel)||b[0].face!-a[0].face!).forEach(([p,i])=>{const el=nodeEls[i],w=el.offsetWidth,h=el.offsetHeight,x=p.x+w+22>W-10?p.x-w-12:p.x+12,y=p.y-h/2;let o=p.vis&&p.face!>.12?Math.min(1,(p.face!-.12)*5):0;if(x<10||x+w>W-10||y<64||y+h>H-64)o=0;if(i!==sel)rs.forEach(r=>{if(x<r.right+8&&x+w>r.left-8&&y<r.bottom+8&&y+h>r.top-8)o=0});else o=0;if(sel>=0&&i!==sel)o*=.2;if(sel>=0&&gView==='work')o=0;if(o>0){if(placed.some(r=>x<r[2]+6&&x+w>r[0]-6&&y<r[3]+6&&y+h>r[1]-6))o=0;else placed.push([x,y,x+w,y+h])}el.style.transform='translate('+x+'px,'+y+'px)';vis(el,o)});
      if(sel>=0&&ringO&&gView==='path'){const p=F.nodes()[sel];placeW(F,ringO,F.gNode(sel),0);vis(ring,p.face!>0?1:0)}else vis(ring,0);if(radO){if(whoOpen){placeW(F,radO,F.gFront(),1);vis(rad,1)}else vis(rad,0)}}
    else{nodeEls.forEach(e=>vis(e,0));vis(ring,0);vis(rad,0)}
  }
  let b3=false,BDS:PlacedBoard[]=[],PHS:Ctl[]=[],ringO:CSS3DObject|null=null,radO:CSS3DObject|null=null,ctlKey:string|null=null,curCtl:Ctl[]=[],sheetB:PlacedBoard|null=null,b3Act:PlacedBoard|null=null;
  const ctl=$('ctl'),sheet=$('sheet'),rad=$('radial'),qs=(x:string)=>document.querySelector<El>(x),ex=(x:unknown)=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'),txt=(el:Element|null)=>el?el.textContent.replace(/^\s*\d+\s*·\s*/,'').trim():'';
  const BD:Board[]=[
   {r:'career',s:0,h:'Your career path starts with where you are.',p:'EmpowerED assesses your current capability first, then recommends the path that fits.',mv:['#cp0 [data-drawer="how"]']},
   {r:'career',s:1,h:'Start where you are.',p:'The Entry Assessment maps your baseline capability, your gaps, the role direction that fits you, and how ready you are today. No score is shown until it is complete.',mv:['#aScan .acts','#handoff']},
   {r:'career',s:2,h:'Your path unlocks after the assessment.',mv:['#cp2 label.tgl','#cpLocked'],x:[['View sample result','result']]},
   {r:'career',s:3,h:'Build your foundation. Become job-ready.',pts:['Portfolio development','Interview preparation','Placement assistance (no guarantee)'],mv:['#stDet','#cp3 .acts']},
   {r:'career',s:4,place:{pos:[10.7,8.2,-39],ww:3},h:'Specialise in a role. Build real-world capability.',p:'Each pod builds depth in one role. Select a pod to see what you build there.',mv:['#cp4 .note','#cp4 .acts']},
   {r:'career',s:5,h:'Build for real.',p:'Gain industry experience. Accelerate your career.',pts:['POD assignments','6+ months industry exposure','1:1 expert coaching'],mv:['#stgDet','#cp5 .note','#cp5 .acts'],track:1},
   {r:'career',s:6,h:'Evidence in. Readiness out.',p:'Evidence from Career Launch, Career Pro and the Product Engineering floor arrives at the assurance core. A gate lights only when its evidence arrives.',mv:['#cp6 .acts'],x:[['View readiness passport','pp']]},
   {r:'career',s:7,h:'Leave EmpowerED ready.',pts:['Career Launch: placement assistance, no guarantee','Career Pro: role-aligned placement support','Career Accelerate: targeted premium-role opportunities'],mv:['#cp7 .c3 .note','#cp7 .acts','#cp7 .backBtn']},
   {r:'workforce',s:0,h:'What do you need EmpowerED to produce?',p:'Click a bay sign to enter. The floor signs at the entrance change emphasis only; every bay stays open.'},
   {r:'workforce',s:1,h:'Verified capability, on demand.',pts:['Build before demand','Verify before deployment','Supply and consume'],mv:['#engLine','#loop','#w1p p.note:not(#engLine)','#w1p .acts','#w1p .cmpRow']},
   {r:'workforce',s:2,h:'Bring us a problem.',p:'A problem crate rolls onto the floor. A cross-functional POD assembles around it and takes it through six stages.',pts:['Product / PoC','Talent capability evidence','Deployment pipeline'],mv:['#w2p .acts','#podReplay','#w2p .cmpRow'],x:[['Configure a POD','cfg']],track:1},
   {r:'workforce',s:3,place:{pos:[-12.4,3.6,-9.8],ww:3.2,face:[-5.27,4.87,-2.9],twf:.28},keep:[[[-26.6,0,-19],[-22,5.1,-4.9]]],h:'Upgrade the team you already have.',p:'Teams enter the reskilling line in the roles they hold today and leave with AI capability built into them.',pts:['Corporate Academies','L&amp;D as a Service','Human + AI Workforce'],mv:['#w3p .acts','#w3p .cmpRow'],x:[['Open the capability lens','lens']]},
   {r:'workforce',s:4,h:'Build the future talent supply.',p:'Choose an actor on a plinth at the courtyard entrance to see what it brings.',mv:['#w4p .acts','#campReplay','#w4p .cmpRow']},
   {r:'workforce',s:5,h:'Regional and sector capability building.',p:'One pilot POD or regional hub links campuses, industry and government around a sector priority. Numbers are ILLUSTRATIVE.',mv:['#w5p .legend','#ecoStats','#ecoLine','#caseBtn','#w5p .acts','#w5p .cmpRow']},
   {r:'workforce',s:6,h:'Which model fits?',p:'Add up to three bays with “Add to compare” on any bay board, then open the table.',x:[['Open the comparison','cmp']]}];
  const STOPC:Record<string,StopCopy[]>={career:[
    ['The intake','Your career path starts with where you are. EmpowerED assesses your current capability first, then recommends the path that fits.',['Entry Assessment first','Path matched to you','No score until complete'],'How the assessment works'],
    ['Entry assessment','The Entry Assessment maps your baseline capability, your gaps, the role direction that fits you, and how ready you are today.',['Baseline capability','Capability gaps','Readiness today'],'Open the Entry Assessment'],
    ['Your path','Career Launch, Career Pro and Career Accelerate stay locked until the Entry Assessment recommends the one that fits you.',['Career Launch','Career Pro','Career Accelerate'],'See your path options'],
    ['Build your foundation','Become job-ready. Inspect each station in Foundation Hall to see the kind of work you practise there.',['Portfolio development','Interview preparation','Placement assistance (no guarantee)'],'Explore the stations'],
    ['Specialise in a role','Each pod builds depth in one role. Select a pod to see what you build there.',['One role per pod','Role-specific projects','Track list being confirmed'],'Explore the pods'],
    ['Build in a POD','An industry problem arrives from the Workforce side. The squad owns the engineering; a mentor guides. Scroll to follow it across the floor.',['POD assignments','6+ months industry exposure','1:1 expert coaching'],'Follow the six stages'],
    ['ETAF™ assurance','Evidence from Career Launch, Career Pro and the Product Engineering floor arrives at the assurance core. A gate lights only when its evidence arrives.',['Evidence from every floor','Gates light on evidence','Readiness passport'],'View readiness passport'],
    ['Leave ready','Every path ends at the opportunity dock, with support matched to the path you took.',['Launch: placement assistance','Pro: role-aligned support','Accelerate: premium roles'],'Talk to Career Team']],
   workforce:[
    ['The dock','What do you need EmpowerED to produce? Choose a bay to enter. Filters change emphasis only; every bay stays open.',['5 bays','Filter by who you are','Every bay stays open'],'Choose a bay'],
    ['Verified talent','Verified capability, on demand. Talent is built before demand and verified before deployment.',['Build before demand','Verify before deployment','Supply and consume'],'Engagement models'],
    ['Bring us a problem','A problem crate rolls onto the floor. A cross-functional POD assembles around it and takes it through six stages.',['Product / PoC','Talent capability evidence','Deployment pipeline'],'Configure a POD'],
    ['Upgrade your team','Teams enter the reskilling line in the roles they hold today and leave with AI capability built into them.',['Corporate Academies','L&D as a Service','Human + AI Workforce'],'Open the capability lens'],
    ['Campus talent factory','A campus plugs into EmpowerED as an extension. Choose an actor to see what it brings.',['Campus extension','Student PODs','Future talent supply'],'Meet the campus actors'],
    ['Ecosystem at scale','One pilot POD or regional hub links campuses, industry and government around a sector priority. Numbers are illustrative.',['Campuses','Industry','Government'],'Design a sector programme'],
    ['Which model fits?','Add up to three bays with “Add to compare”, then open the table.',['Up to 3 bays','Side by side','Add from any bay'],'Open the comparison']]};
  const DRS:[string,string,string,string[]][]=[['result','Your Path','Sample result',['#cpResult']],['pp','ETAF™ Assurance','Readiness passport',['#pp']],['cfg','Product Engineering PODs','POD configurator · ILLUSTRATIVE',['#w2p .cfg','#cfgPrev']],['lens','Workforce Capability','Capability lens · ILLUSTRATIVE',['#w3p .cfg','#heat','#lensV']],['cmp','Compare','Which model fits?',['#cmpBtns','#cmpT']]];
  function fire(e:Ctl){if(e.fn)e.fn();else{const x=e.src&&e.src();x&&x.click()}}
  function stateOf(x:El|null|undefined){return x?((x as HTMLInputElement).type==='checkbox'?(x as HTMLInputElement).checked:(x.classList.contains('on')||x.classList.contains('sel'))):false}
  function build3D(F:FactoryApi){b3=true;
    DRS.forEach(([k,e,h,sels])=>{const sec=document.createElement('section');sec.dataset.d=k;sec.hidden=true;sec.innerHTML='<div class="eyebrow">'+e+'</div><h3>'+h+'</h3>';sels.forEach(x=>{const n=qs(x);if(n)sec.appendChild(n)});cd.appendChild(sec)});
    const CP=(r:string,st:number):P3=>r==='career'?F.routeWP('career',st)[0]:wfPose(st).p;
    BDS=BD.map((b):PlacedBoard=>{const sec=document.createElement('section');sec.dataset.d='S'+b.r+b.s;sec.hidden=true;sec.innerHTML='<div class="eyebrow">'+(LABELS[b.r][b.s]||'')+'</div><h3>'+b.h+'</h3>'+(b.p?'<p class="sp">'+b.p+'</p>':'')+'<div class="sctl" role="group" aria-label="Controls at this stop"></div>';cd.appendChild(sec);const w=document.createElement('div');w.className='b3';w.innerHTML='<div class="bd">'+(b.noSign?'':'<div class="hs" aria-hidden="true"><b>'+b.h+'</b></div>')+'<div class="scr">'+(b.p?'<p class="bt" aria-hidden="true">'+b.p+'</p>':'')+(b.pts?'<ul class="bp" aria-hidden="true">'+b.pts.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')+'<div class="mv"></div></div></div>';
      const mv=sec;(b.mv||[]).forEach(x=>{const n=qs(x);if(n)mv.appendChild(n)});(b.x||[]).forEach(([tt,d])=>{const bt=document.createElement('button');bt.type='button';bt.className='cta ghost';bt.dataset.open=d;bt.innerHTML=tt+' <span>→</span>';bt.onclick=()=>openDrawer(d);mv.appendChild(bt)});
      const o=F.css(w,b.place&&b.place.par),wp2=b.r==='workforce'?wfPose(b.s):null,pose:P3[]=wp2?[wp2.p,wp2.l]:F.routeWP('career',b.s);if(b.place)F.aim(o,b.place.pos,b.place.face||pose[0],1,0,b.place.ww,440);else F.fitBoard(o,pose[0],pose[1],440);o.visible=false;return Object.assign(b,{w,bd:w.firstChild,o,pose,bx:o.position.x,px:pose[0][0]})});
    $('srCopy').innerHTML=BD.map(b=>'<section><h2>'+b.h+'</h2>'+(b.p?'<p>'+b.p+'</p>':'')+(b.pts?'<ul>'+b.pts.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')+'</section>').join('');
    const add=(e:Ctl)=>{try{if(!e.noObj){let el=e.el;if(!el){const btn=!!(e.src||e.fn);el=document.createElement(btn?'button':'div');if(btn){(el as HTMLButtonElement).type='button';el.tabIndex=-1;el.setAttribute('aria-hidden','true')}el.className=e.cls||'pc';el.innerHTML=e.html||ex(e.label)}
      el.classList.add('p3');if(el.tagName==='BUTTON')el.onclick=()=>fire(e);if(e.ww)el.style.width=e.pxW+'px';e.el=el;const o=F.css(el,e.par);F.aim(o,e.pos!,e.face||e.cam,e.z||1,e.flat,e.ww,e.pxW);o.visible=false;e.o=o}PHS.push(e)}catch(err){console.warn('3D control skipped',e.label,err)}return e};
    const grp=(g:Ctl,sel:string)=>{const box=document.createElement('div');box.className=g.cls!;box.innerHTML=g.html||'';add(Object.assign({},g,{el:box}));[...document.querySelectorAll<El>(sel)].forEach(b=>{const bt=document.createElement('button');bt.type='button';bt.tabIndex=-1;bt.setAttribute('aria-hidden','true');bt.className=g.sw?'sw':'chip';bt.innerHTML=(g.sw?'<i></i>':'')+ex(b.textContent);const e:Ctl={el:bt,src:()=>b,label:b.textContent!,tg:1,at:g.at,noObj:1};bt.onclick=()=>fire(e);box.appendChild(bt);PHS.push(e)})};
    const c0=CP('career',0);
    cors.forEach(c=>{const k=c.dataset.k||'gate';add({el:c,pos:anchor(c),cam:c0,z:.8,at:[['career',0],['career',2]],src:()=>c.querySelector('[data-go-assess],[data-path]'),label:({gate:'Assessment Gate',launch:'Career Launch',pro:'Career Pro',accel:'Career Accelerate'} as Record<string,string>)[k]})});
    ([['Baseline',6.6,-1],['Gaps',7.5,1],['Role direction',8.5,-1],['Readiness',8.5,1]] as [string,number,number][]).forEach(([n,y,sd])=>add({label:n,cls:'rtag',pin:1,pos:[-21+sd*1.8,y,-40.3],cam:CP('career',1),z:.9,at:[['career',1]],upd:e=>e.el!.classList.toggle('lit',Math.abs(F.scanY()-y)<.4)}));
    add({noObj:1,label:'Preview a sample result',src:()=>$('sampleT'),tg:1,at:[['career',2]]});
    [[-10.8,-45.4],[-5.8,-46.4],[-2.8,-43.8],[-10.4,-39.2],[-3.4,-39]].forEach(([x,z],i)=>{const g=()=>qs('#stBtns [data-st="'+i+'"]');add({label:txt(g()),pos:[x,8.9,z],cam:CP('career',3),z:.85,at:[['career',3]],src:g})});
    [0,1,2,3,4,5,6].forEach(i=>{const a=(-33+i*41/6)*Math.PI/180,g=()=>qs('#podBtns [data-pod="'+i+'"]');add({label:txt(g()),cls:'pc sign',pin:1,pos:[7+9.9*Math.sin(a),8.5,-31.5-9.9*Math.cos(a)],cam:CP('career',4),ww:1.15,pxW:160,at:[['career',4]],src:g})});
    [22,15.6,9.2,2.8,-3.6,-10].forEach((x,i)=>{const cs=()=>qs('#stgBtns [data-stg="'+i+'"]');add({label:(i+1)+' · '+txt(cs()),cls:'pc floor',pin:1,pos:[x,.05,-28.3],flat:1,ww:4.8,pxW:280,cam:CP('career',5),at:[['career',5],['workforce',2]],src:()=>route==='workforce'?qs('[data-wst="'+i+'"]'):cs()})});
    {const c6=CP('career',6),RR=[4,3.7,3.6,3.6,3.7,4];F.gates().forEach(([gx,gz],i)=>{const g=()=>qs('#srBtns [data-sr="'+i+'"]'),dx=gx-21,dz=gz+43.8,L=Math.hypot(dx,dz)||1,fc=dx/L*(c6[0]-gx)+dz/L*(c6[2]-gz)>0,r=RR[i]||3.6;add({label:txt(g()),cls:'pc gsign',noObj:fc?0:1,pos:[21+dx/L*r,6.2,-43.8+dz/L*r],cam:c6,ww:.9,pxW:130,at:[['career',6]],src:g})})}
    [0,1,2,3,4].forEach(i=>add({noObj:1,label:txt(qs('#bayBtns [data-bay="'+i+'"]')),src:()=>qs('#bayBtns [data-bay="'+i+'"]'),at:[['workforce',0]]}));
    [['ent','Enterprise'],['uni','University'],['gov','Government']].forEach(([k,n],i)=>add({label:n,cls:'pc stand',pos:[32.5+i*2.6,1.2,-1.5],cam:CP('workforce',0),z:.85,at:[['workforce',0]],tg:1,src:()=>qs('[data-fil="'+k+'"]'),fn:()=>{const x=qs('[data-fil="'+k+'"]')!;(x.classList.contains('on')?qs('[data-fil="all"]')!:x).click()}}));
    grp({cls:'pgrp v',html:'<span class="gl">ENGAGEMENT MODEL</span>',pos:[20.5,5.6,-1.2],cam:CP('workforce',1),z:.6,sw:1,at:[['workforce',1]]},'#engBtns [data-eng]');
    grp({cls:'pgrp strip',pos:[19.42,3.9,-5.75],face:[40,3.9,-5.75],ww:6.2,pxW:640,at:[['workforce',1]]},'#domBtns [data-dom],#bandBtns [data-band]');
    UNITD.forEach((u,i)=>{const r=Math.floor(i/4),c=i%4,y=.44+r*1.2,z=-3.3-c*1.5;add({html:'<b>'+u.id+'</b><span>'+ex(u.dom)+'</span><span>'+u.band+'</span><span>'+u.state+'</span>',cls:'utag',fix:1,pos:[19.99,y,z],face:[40,y,z],ww:.98,pxW:100,at:[['workforce',1]],cond:()=>route==='workforce',upd:(e,a)=>{e.el!.style.opacity=String((a?1:.3)*(u.off?.22:1));const o=e.o;if(o){const x=e as {bx?:number};if(x.bx===undefined)x.bx=o.position.x;o.position.x+=((x.bx+(u.grp?.55:0))-o.position.x)*.2}}})});
    [1,2,3,4,5].forEach(n=>add({noObj:1,label:'Add to my selection',tg:1,src:()=>qs('[data-pick="'+(n-1)+'"]'),at:[['workforce',n]]}));
    add({noObj:1,label:'Replay',fn:()=>$('podReplay').click(),at:[['workforce',2]]});
    add({noObj:1,label:'Capability lens',fn:()=>openDrawer('lens'),at:[['workforce',3]]});
    const CP4=CP('workforce',4),APOS:P3[]=[[-54,11.6,-29.6],[-37,2.6,-10.6],[-45,11.2,-17.6],[-67,3.2,-7]];
    [-60,-56,-52,-48].forEach((x,i)=>{const g=()=>qs('#actBtns [data-act="'+i+'"]');add({label:txt(g()),cls:'pc stand',pos:[x,1.75+(i%2)*.95,-14.3],cam:CP4,z:.9,par:'campus',tg:1,at:[['workforce',4]],src:g,cond:()=>F.campusOn()})});
    {const cb=document.createElement('div');cb.className='scr cbd';cb.appendChild($('actV'));add({el:cb,pos:APOS[0],cam:CP4,z:1.4,par:'campus',pin:1,at:[['workforce',4]],cond:()=>F.campusOn(),upd:e=>{if(e.k!==act){e.k=act;F.aim(e.o!,APOS[act],CP4,1.4)}}})}
    grp({cls:'pgrp',html:'<span class="gl">SECTOR PRIORITY</span>',pos:[4,28.1,-12.6],flat:1,cam:CP('workforce',5),z:1,par:'net',at:[['workforce',5]],cond:()=>F.netA()>.3},'#secBtns [data-sec]');
    grp({cls:'pgrp',html:'<span class="gl">ACTORS · SHAPE</span>',pos:[4,28.1,-17],flat:1,cam:CP('workforce',5),z:1,par:'net',at:[['workforce',5]],cond:()=>F.netA()>.3},'#eaBtns [data-ea],#emBtns [data-em]');
    [-3.5,-8.5,-13.5,-18.5,-23.5].forEach((z,i)=>add({label:txt(qs('#bayBtns [data-bay="'+i+'"]')),html:'+ COMPARE',pos:[30.1,3.9,z],face:[60,3.9,z],cam:CP('workforce',6),z:.8,tg:1,at:[['workforce',6]],src:()=>qs('#cmpBtns [data-ct="'+i+'"]')}));
    ringO=F.css(ring,'world');radO=F.css(rad,'world');vis(rad,0)}
  let stShown:string|null=null,stOp=0,stFade=0,drwCtl:Ctl[]=[],stShift=0,stLast=0,stW=0,stH=0;
  const stopL=$('stopL'),sAct=stopL.querySelector<El>('.sAct')!;
  function stopFill(key:string|null){if(!key)return;const r=key.replace(/\d+$/,''),i=+key.match(/\d+$/)![0],d=STOPC[r][i];
    const cat=r==='workforce'&&stCat==='For students'?'For organisations':stCat;stopL.querySelector('.sCat')!.textContent=cat;stopL.querySelector('.sTtl')!.textContent=d[0];stopL.querySelector('.sPar')!.textContent=d[1];
    [...stopL.querySelectorAll('.sChips li')].forEach((li,k)=>li.textContent=d[2][k]||'');sAct.firstChild!.textContent=d[3];sAct.onclick=()=>openStop(r,i)}
  function openStop(r:string,i:number){const k=r+i,sec=cd.querySelector('[data-d="S'+k+'"]');if(!sec)return;const box=sec.querySelector('.sctl')!;box.innerHTML='';
    drwCtl=PHS.filter(e=>(e.src||e.fn)&&e.at!.some(([rr,st])=>rr+st===k));drwCtl.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e.label!;b.onclick=()=>fire(e);if(e.tg)b.setAttribute('aria-pressed','false');e.db=b;box.appendChild(b)});
    sec.querySelector('.eyebrow')!.textContent=(r==='workforce'&&stCat==='For students'?'For organisations':stCat)+' · '+(LABELS[r][i]||'');openDrawer('S'+k)}
  function stopFrame(now:number,s:number){let key:string|null=null,o=0;
    if(route&&STOPC[route]&&(mode==='route'||mode==='hub')){const st=mode==='hub'?wfAt:Math.round(Math.max(0,s));if(STOPC[route][st]){key=route+st;o=(mode==='hub'?wfArr:Math.abs(s-st)<.3)?1:0}}
    const set=(v:number)=>{if(v===stOp)return;stOp=v;stopL.style.opacity=String(v);stopL.classList.toggle('on',v>0);stopL.setAttribute('aria-hidden',v>0?'false':'true');sAct.tabIndex=v>0?0:-1};
    if(key!==stShown){if(stOp>0){set(0);stFade=now}else if(now-stFade>320){stopFill(key);stShown=key}}else set(o);
    const F=window.FACTORY,C=F&&F.cam&&F.cam();if(!C)return;const W=innerWidth,H=innerHeight;let want=0;
    if(key){const a=stopL.querySelector('.sTop')!.getBoundingClientRect().bottom,b=stopL.querySelector('.sBot')!.getBoundingClientRect().top;want=Math.round(H/2-(a+b)/2)}
    stShift+=(want-stShift)*.12;if(Math.abs(want-stShift)<.5)stShift=want;
    if(stShift!==stLast||W!==stW||H!==stH){stLast=stShift;stW=W;stH=H;if(Math.abs(stShift)<.5)C.clearViewOffset();else C.setViewOffset(W,H,0,stShift,W,H);C.updateProjectionMatrix()}}
  function placeW(F:FactoryApi,o:CSS3DObject,pos:THREE.Vector3,left:number){const C=F.cam();o.position.copy(pos);if(left){const fw=C.position.clone();C.getWorldDirection(fw);fw.cross(C.up).normalize();o.position.addScaledVector(fw,-o.position.distanceTo(C.position)*.26)}o.lookAt(C.position);o.scale.setScalar(o.position.distanceTo(C.position)*.001036*.95)}
  function buildCtl(key:string){ctl.innerHTML='';curCtl=key==='glv'?[...document.querySelectorAll<El>('#gRing [data-lv]')].map(b=>({label:b.textContent!.replace(/^\d+/,''),src:()=>b,tg:1})):key==='gpw'?[...document.querySelectorAll<El>('[data-pw]')].map(b=>({label:'AI for '+b.textContent,src:()=>b,tg:1})):key?PHS.filter(e=>(e.src||e.fn)&&e.at!.some(([r,st])=>r+st===key)):[];
    curCtl.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e.label!;b.onclick=()=>fire(e);if(e.tg)b.setAttribute('aria-pressed','false');e.rb=b;ctl.appendChild(b)})}
  function b3Frame(F:FactoryApi,W:number,H:number,s:number){if(!b3){if(!F.css)return;build3D(F)}
    const C=F.cam(),cp=C.position,fw=cp.clone(),wp=cp.clone();C.getWorldDirection(fw);
    const inScene=!!route&&(mode==='route'||mode==='hub'||mode==='fly'||mode==='back'||mode==='tour'),mob=W<768;
    const on=(r:string,st:number)=>mode==='tour'?tourSettled&&(r==='career'?tourCar===st:tourWf===st):inScene&&route===r&&Math.abs(s-st)<.3&&(mode==='route'||(mode==='hub'&&wfArr));
    const show=(o:CSS3DObject,el:El,a:boolean,ok:boolean,r:string)=>{if(!inScene||mob||ok===false||(!a&&r&&r!==route)){o.visible=false;return false}o.getWorldPosition(wp);wp.sub(cp);const d=wp.length();if(d<2||d>(a?90:45)||wp.dot(fw)/d<.3){o.visible=false;return false}o.visible=true;el.style.opacity=a?'1':'.3';el.classList.toggle('act',a);el.classList.toggle('off',!a);if(el.inert!==!a)el.inert=!a;return true};
    let act=null as PlacedBoard|null;
    BDS.forEach(b=>{const a=on(b.r,b.s);if(a)act=b;b.o.visible=false});
    PHS.forEach(e=>{if(!e.o)return;const a=e.at!.some(([r,st])=>on(r,st));if(show(e.o,e.el!,a,a&&(e.cond?e.cond():true),e.at![0][0])&&e.upd)e.upd(e,a)});
    if(act&&!mob&&((mode==='route'&&Math.abs(s-Math.round(s))<.05)||(mode==='hub'&&wfArr)||(mode==='tour'&&tourSettled))){
      const sl=$('stopL'),L=12,T=sl.querySelector('.sTop')!.getBoundingClientRect().bottom+10,B=sl.querySelector('.sBot')!.getBoundingClientRect().top-10,rt=fw.clone().cross(C.up).normalize(),up=rt.clone().cross(fw).normalize(),kk=2*Math.tan(C.fov*Math.PI/360)/H*.5;
      {const r=act!.w.getBoundingClientRect();if(false&&r.height&&(r.bottom>B+1||r.top<T-1||r.right>W-11||r.left<11)){const f=Math.min(1,(B-T)/r.height,(W-24)/r.width);act!.o.scale.multiplyScalar(1-(1-f)*.5);const h2=r.height*f,w2=r.width*f,c0=(r.top+r.bottom)/2,c1=Math.min(Math.max(c0,T+h2/2),B-h2/2),x0=(r.left+r.right)/2,x1=Math.min(Math.max(x0,12+w2/2),W-12-w2/2);act!.o.getWorldPosition(wp);const k=wp.distanceTo(cp)*kk;act!.o.position.addScaledVector(up,-(c1-c0)*k).addScaledVector(rt,(x1-x0)*k)}}
      const R=W-12;
      const rectOf=(e:Ctl)=>(e.el!.classList.contains('cor')&&e.el!.firstElementChild?e.el!.firstElementChild:e.el!).getBoundingClientRect();
      const live=PHS.filter(e=>e.o&&e.o.visible&&e.el!.classList.contains('act')),obs:Rect[]=[],hit=(x:number,y:number,w:number,h:number)=>obs.some(q=>x<q.r+6&&x+w>q.l-6&&y<q.b+6&&y+h>q.t-6);
      live.filter(e=>e.pin||e.fix).forEach(e=>{const r=rectOf(e);if(!r.width)return;const out=r.bottom>B||r.right>R||r.left<L||r.top<T;if(e.fix)e.el!.style.visibility=out?'hidden':'';if(!(e.fix&&out))obs.push({l:r.left,t:r.top,r:r.right,b:r.bottom})});
      (act.keep||[]).forEach(([p,q])=>{let l=1e9,tp=1e9,rr=-1e9,bb=-1e9;for(let i=0;i<8;i++){const s=F.project(i&1?q[0]:p[0],i&2?q[1]:p[1],i&4?q[2]:p[2]);l=Math.min(l,s.x);rr=Math.max(rr,s.x);tp=Math.min(tp,s.y);bb=Math.max(bb,s.y)}obs.push({l,t:tp,r:rr,b:bb})});
      if(false){const r0=act!.w.getBoundingClientRect();if(r0.width){if(act!.tw===undefined)act!.tw=Math.min(W-24,Math.max(300,W*(act!.place!.twf||.34)));const tw=act!.tw!,g=tw/r0.width;if(Math.abs(g-1)>.01)act!.o.scale.multiplyScalar(1+(g-1)*.5)}const r=act!.w.getBoundingClientRect(),w=r.width,h=r.height;if(w){let best:number[]|null=null,bd=1e9;for(let a=-14;a<=14;a++)for(let b=-10;b<=10;b++){const x=r.left+a*20,y=r.top+b*16;if(x<L||x+w>W-12||y<T||y+h>B)continue;const d=a*a*400+b*b*256;if(d<bd&&!hit(x,y,w,h)){bd=d;best=[x,y]}}
        if(!best)act!.tw=Math.max(260,act!.tw!*.97);if(best){const dx=best![0]-r.left,dy=best![1]-r.top;if(Math.abs(dx)>.5||Math.abs(dy)>.5){act!.o.getWorldPosition(wp);const k=wp.distanceTo(cp)*kk;act!.o.position.addScaledVector(rt,dx*k).addScaledVector(up,-dy*k)}obs.push({l:best![0],t:best![1],r:best![0]+w,b:best![1]+h})}else obs.push({l:r.left,t:r.top,r:r.right,b:r.bottom})}}
      live.filter(e=>!e.pin&&!e.fix).forEach(e=>{const r=rectOf(e),w=r.width,h=r.height;if(!w)return;
        const cx=Math.min(Math.max(r.left,L),Math.max(L,R-w)),cy=Math.min(Math.max(r.top,T),Math.max(T,B-h));let best:number[]|null=null,bd=1e9;
        for(let a=-10;a<=10;a++)for(let b=-10;b<=10;b++){const x=cx+a*18,y=cy+b*14;if(x<L||x+w>R||y<T||y+h>B)continue;const d=a*a*324+b*b*196;if(d<bd&&!hit(x,y,w,h)){bd=d;best=[x,y]}}
        if(!best){if(e.sc0===undefined)e.sc0=e.o!.scale.x;if(e.o!.scale.x>e.sc0*.5)e.o!.scale.multiplyScalar(.97);best=[cx,cy]}const dx=best[0]-r.left,dy=best[1]-r.top;obs.push({l:best[0],t:best[1],r:best[0]+w,b:best[1]+h});
        if(Math.abs(dx)>.5||Math.abs(dy)>.5){e.o!.getWorldPosition(wp);const k=wp.distanceTo(cp)*kk;e.o!.position.addScaledVector(rt,dx*k).addScaledVector(up,-dy*k)}})}
    const sb=null as PlacedBoard|null;if(sb!==sheetB){if(sheetB)sheetB.w.appendChild(sheetB.bd!);if(sb)sheet.appendChild(sb.bd!);sheetB=sb}
    if(sb){const rt=rail.getBoundingClientRect().top,ct=ctl.childElementCount?ctl.getBoundingClientRect().top:rt;sheet.style.bottom=Math.round(H-Math.min(rt,ct)+8)+'px'}vis(sheet,sb?1:0);
    const key=mode==='globe'?(whoOpen?'gpw':sel>=0&&gView==='path'?'glv':''):act?act.r+act.s:'';if(key!==ctlKey){ctlKey=key;buildCtl(key)}
    vis(ctl,curCtl.length&&mode==='globe'?1:0);
    if(act!==b3Act){if(act)act.tw=undefined;b3Act=act;if(act)$('srNow').textContent=act.h}}
  const mirror=(b:El,x:El|null|undefined)=>{if(!x)return;b.classList.toggle('sug',x.classList.contains('sug'));b.style.order=x.style.order;if(x.dataset.pick&&b.textContent!==x.textContent)b.textContent=x.textContent};
  setInterval(()=>{drwCtl.forEach(e=>{if(!e.db)return;const x=e.src&&e.src(),v=stateOf(x);e.db.classList.toggle('on',v);if(e.tg)e.db.setAttribute('aria-pressed',String(v));mirror(e.db,x)});curCtl.forEach(e=>{if(!e.rb)return;const x=e.src&&e.src(),v=stateOf(x);e.rb.classList.toggle('on',v);if(e.tg)e.rb.setAttribute('aria-pressed',String(v));mirror(e.rb,x)});
    PHS.forEach(e=>{if(!e.src||!e.el||e.el.classList.contains('cor'))return;const x=e.src();if(!x)return;e.el.classList.toggle('sel',stateOf(x));e.el.classList.toggle('lead',x.classList.contains('lead'))});
    document.querySelectorAll<El>('[data-open="result"]').forEach(b=>b.hidden=!hasResult)},200);
  addEventListener('resize',()=>{const F=window.FACTORY;if(!b3||!F)return;BDS.forEach(b=>{if(b.place)return;F.fitBoard(b.o,b.pose[0],b.pose[1],440);b.bx=b.o.position.x})});
  // ---- Company tour -------------------------------------------------------------
  /** Career tour stops 0..5 sit on the career camera curve at these waypoints. */
  const CK=[0,2,8,11,19,22];
  /** The career route stop (drawer and in-scene controls) shown at each career tour stop. */
  const CEQ=[-1,0,3,5,6,7,-1,-1];
  /** Career route stop index -> tour stop. */
  const CTS=[1,1,2,2,3,3,4,5];
  let tourWf=-1,tourCar=-1,tourSettled=false,tourLast=0;
  const FX=()=>window.FACTORY!;
  const COMPANY:[P3,P3]=[[22,10,48],[0,6,-8]];
  /** Deploy looks back at the ETAF gate from the city side (brand.ts builds the gate and walkers). */
  const DEPLOY:[P3,P3]=[[6,4.4,-88],[0,5.4,-64]];
  const icon=(i:number):P3=>{const p=window.FACTORY?.brandIcons()[i]||[0,6,18];return[p[0],p[1]-1.4,p[2]]};
  const wfP=(i:number):[P3,P3]=>{const w=wfPose(i);return[w.p,w.l]};
  const open=(r:string,i:number)=>()=>{openStop(r,i)};
  const company:TourStop={id:'company',label:'Company',eyebrow:'THE COMPANY',title:'One company. Every possibility.',copy:'Develop. Engineer. Verify. Deploy. Choose your path through one connected talent company, home of the AI Talent Factory.',pose:()=>COMPANY,
    hotspots:[{at:icon(0),label:'Build Career',run:()=>{startTour('career',0);tour.travel(1)}},{at:icon(1),label:'Build Workforce',run:()=>{startTour('workforce',0);tour.travel(1)}},{at:icon(2),label:'AI for Everyone',run:()=>toGlobe()}]};
  const showroom:TourStop={id:'showroom',label:'Showroom',eyebrow:'SHOWROOM',title:'The right capability for you.',copy:'Verified talent, product PODs, workforce academies, campus talent factories and regional programmes, side by side.',pose:()=>wfP(1),
    action:{label:'Open the talent shelf',run:open('workforce',1)},hotspots:[{at:[19.5,2.2,-5.6],label:'Verified talent shelf',run:open('workforce',1)},{at:[30.5,4.5,-13.5],label:'Compare models',run:open('workforce',6)}]};
  // ---- Evidence & Impact: the gallery tour (four exhibit groups, all illustrative until evidence is approved) ----
  const GX:[string,string,[string,string][]][]=[
    ['Career evidence','From work to proof',[['Evidence Passport · sample','Built the booking API. Reviewed by a mentor, linked to the Build stage.'],['Entry Assessment · sample result','Recommended path, strengths and the gaps worth closing.'],['Readiness Passport · sample','Role fit, flags and eligibility, shown after ETAF™ review.']]],
    ['Product POD work','A problem, taken through six stages',[['Problem brief · sample','Users, goals and constraints, agreed before work starts.'],['Delivery board','Discover → Design → Build → Test & Secure → Deploy & Operate → Demo & Validate.'],['Demo','A working product shown to the client at Demo & Validate.']]],
    ['Workforce & campus','How programmes are shaped',[['Capability lens · report outline','Function, desired outcome, module heat map and the lens reading.'],['Campus partnership map','University, industry, EmpowerED and government, with responsibilities to agree.'],['Regional hub model','From one pilot POD to a hub around a sector priority.']]],
    ['Case studies','Approved evidence coming soon',[['Malaysia · Ecosystem at Scale','Being prepared. Shared once it is approved.'],['Your organisation','A slot for the next case study.'],['How evidence is approved','Real outcomes appear only after the organisation involved approves them. Until then, examples are labelled illustrative.']]],
  ];
  const galEls=GX.map(([h,s,rows],i)=>{const el=document.createElement('div');el.className='evx'+(i===3?' evCase':'');el.style.width='620px';el.innerHTML='<span class="ill">'+(i===3?'COMING SOON':'ILLUSTRATIVE')+'</span><h3>'+escG(h)+'</h3><p class="evS">'+escG(s)+'</p><ol>'+rows.map(([t,d])=>'<li><b>'+escG(t)+'</b><span>'+escG(d)+'</span></li>').join('')+'</ol>';return el});
  let galO:CSS3DObject[]=[];
  function placeGallery(F:FactoryApi){if(galO.length)return;const fr=F.gallery();galO=galEls.map((el,i)=>{const o=F.css(el);const f=fr[i];F.aim(o,f.at,f.face,1,0,2.9,620);o.visible=false;return o})}
  // Each exhibit sits right of centre, clear of the tour card on the left.
  const GPOSE:[P3,P3][]=[[[22.5,3.4,31],[22.5,2.1,14]],[[18.8,2.25,15.4],[18.8,2.05,11]],[[24.2,2.25,15.4],[24.2,2.05,11]],[[21.3,2.25,16.5],[17,2.05,16.5]],[[23.7,2.25,14.5],[28,2.05,14.5]]];
  const evidenceStops:TourStop[]=[
    {id:'gallery',label:'Gallery',eyebrow:'EVIDENCE & IMPACT',title:'What we can show, and how.',copy:'A small gallery of how EmpowerED work becomes evidence. Everything inside is a labelled illustration until approved evidence is published.',pose:()=>GPOSE[0],action:{label:'View as a page',run:()=>openFlat(false,'fEvidence')}},
    {id:'g-career',label:'Career',eyebrow:'EVIDENCE · CAREER',title:'From work to proof.',copy:'What you make collects in your Evidence Passport. After ETAF™ review it becomes your Readiness Passport.',pose:()=>GPOSE[1],action:{label:'See an example passport',run:open('career',6)}},
    {id:'g-pods',label:'PODs',eyebrow:'EVIDENCE · PRODUCT PODS',title:'A problem, taken through six stages.',copy:'A brief, a delivery board and a demo: the kind of evidence a POD engagement produces.',pose:()=>GPOSE[2],action:{label:'Explore Product Engineering PODs',run:open('workforce',2)}},
    {id:'g-work',label:'Workforce',eyebrow:'EVIDENCE · WORKFORCE & CAMPUS',title:'How programmes are shaped.',copy:'Outlines of a capability lens report, a campus partnership map and the regional hub model.',pose:()=>GPOSE[3],action:{label:'Open the capability lens',run:()=>openDrawer('lens')}},
    {id:'g-cases',label:'Case studies',eyebrow:'EVIDENCE · CASE STUDIES',title:'Approved evidence, coming soon.',copy:'Case studies appear here once the organisations involved approve them. Malaysia is being prepared.',pose:()=>GPOSE[4],action:{label:'Case study: Malaysia',run:()=>openDrawer('case')}},
  ];
  const TOURS:Record<TourRoute,TourStop[]>={
    evidence:evidenceStops,
    story:[],
    career:[company,
      {id:'intake',label:'Intake',eyebrow:'INTAKE',title:'Start where you are.',copy:'Your Entry Assessment maps baseline capability, gaps, role direction and readiness. Your starting point determines your recommended path.',pose:()=>FX().routePose('career',CK[1]),
        action:{label:'Explore the assessment',run:open('career',1)},hotspots:[{at:[-3,3.4,-14],label:'Entry Assessment',run:open('career',1)},{at:[4,3.4,-14],label:'How the intake works',run:open('career',0)}]},
      {id:'develop',label:'Develop',eyebrow:'DEVELOP',title:'Build capability with direction.',copy:'Career Launch builds foundations. Career Pro deepens a specialisation. Career Accelerate connects capability to industry product experience.',pose:()=>FX().routePose('career',CK[2]),
        action:{label:'Explore Foundation Hall',run:open('career',3)},hotspots:[{at:[-7,8.8,-43],label:'Foundation Hall stations',run:open('career',3)},{at:[-11,8.8,-40],label:'Your path',run:open('career',2)}]},
      {id:'engineer',label:'Engineer',eyebrow:'ENGINEER',title:'Real teams. Real products.',copy:'Build in a cross-functional POD, guided by an industry mentor. Discover, Design, Build, Test & Secure, Deploy & Operate, Demo & Validate.',pose:()=>FX().routePose('career',CK[3]),
        action:{label:'Explore engineering PODs',run:open('career',5)},hotspots:[{at:[21.6,2.4,-28.4],label:'Six POD stages',run:open('career',5)},{at:[18,5.2,-33],label:'Career Pro pods',run:open('career',4)}]},
      {id:'verify',label:'Verify',eyebrow:'VERIFY',title:'Evidence in. Readiness out.',copy:'ETAF™, our readiness framework, checks assessments, project work and reviewed delivery. After that review, your Evidence Passport becomes your Readiness Passport: evidence of what you can actually do.',pose:()=>FX().routePose('career',CK[4]),
        action:{label:'Explore the Readiness Passport',run:open('career',6)},hotspots:[{at:[21,9.2,-43.8],label:'ETAF™ assurance core',run:open('career',6)},{at:[17.5,8.6,-41.5],label:'Play an example review',run:()=>playEtafDemo()}]},
      {id:'deploy',label:'Deploy',eyebrow:'DEPLOY',title:'Show what you can do.',copy:'Verified talent meets companies and products go live. Placement support depends on your track; an interview or hire remains the employer’s decision.',pose:()=>DEPLOY,
        action:{label:'Explore opportunity pathways',run:open('career',7)},hotspots:[{at:[0,6.4,-72],label:'ETAF™ gate · opportunity pathways',run:open('career',7)}]},
      showroom,
      {id:'world',label:'World',eyebrow:'AI FOR EVERYONE',title:'AI for every profession.',copy:'From this company to a connected world. Explore practical AI across industries and professions.',pose:():[P3,P3]=>[[6,46,58],[0,0,-30]]}],
    workforce:[company,
      {id:'dock',label:'Dock',eyebrow:'WORKFORCE · DOCK',title:'What do you need EmpowerED to produce?',copy:'Five bays, one company. Filters change emphasis only; every bay stays open.',pose:()=>wfP(0),action:{label:'Choose a bay',run:open('workforce',0)},hotspots:[{at:[32,3,-4],label:'Choose a bay',run:open('workforce',0)}]},
      {id:'talent',label:'Talent',eyebrow:'VERIFIED TALENT · TAAS',title:'Verified capability, on demand.',copy:'Talent is built before demand and verified before deployment. Reserve, activate, scale and release.',pose:()=>wfP(1),action:{label:'Explore verified talent',run:open('workforce',1)},hotspots:[{at:[19.5,2.2,-5.6],label:'Talent shelf',run:open('workforce',1)}]},
      {id:'pods',label:'PODs',eyebrow:'PRODUCT ENGINEERING PODS',title:'Bring us a problem.',copy:'A cross-functional POD assembles around your problem and takes it through six stages.',pose:()=>wfP(2),action:{label:'Design my POD',run:open('workforce',2)},hotspots:[{at:[14.5,4.6,-33],label:'See a POD at work',run:()=>{enterLobby();story.chooseAt('founder',story.indexOfRoom('founder','engineer'));mission.defaultFor('workforce')}}]},
      {id:'teams',label:'Teams',eyebrow:'WORKFORCE CAPABILITY',title:'Upgrade the team you already have.',copy:'Teams enter in the roles they hold today and leave with AI capability built into them.',pose:()=>wfP(3),action:{label:'Explore the capability lens',run:open('workforce',3)},hotspots:[{at:[-21.9,2.6,-14],label:'Reskilling line',run:open('workforce',3)}]},
      {id:'campus',label:'Campus',eyebrow:'CAMPUS TALENT FACTORY',title:'Build the future talent supply.',copy:'A campus plugs into EmpowerED as an extension. Choose an actor to see what it brings.',pose:()=>wfP(4),action:{label:'Explore the campus',run:open('workforce',4)},hotspots:[{at:[-50,3.5,-23],label:'Campus actors',run:open('workforce',4)}]},
      {id:'region',label:'Region',eyebrow:'ECOSYSTEM AT SCALE',title:'Regional and sector capability.',copy:'One pilot POD or regional hub links campuses, industry and government around a sector priority.',pose:()=>wfP(5),action:{label:'Explore the ecosystem',run:open('workforce',5)}},
      {...showroom,pose:()=>wfP(6),title:'Which model fits?',copy:'Compare verified talent, PODs, workforce capability, campus and ecosystem programmes side by side.',action:{label:'Open the comparison',run:open('workforce',6)},hotspots:[{at:[30.5,4.5,-13.5],label:'Compare models',run:open('workforce',6)}]}]};
  // ---- Story mode (story/guide.ts, story/routes.ts): the guide walks the visitor's character through the company ----
  /** Career route stop (scene highlights) and workforce stop (bays, campus) lit for each story room. */
  const ROOMEQ:Partial<Record<RoomId,number>>={pro:4,intake:0,develop:3,engineer:5,delivery:5,verify:6,deploy:7};
  const ROOMWF:Partial<Record<RoomId,number>>={dock:0,talent:1,teams:3,apply:3,campus:4,scope:4};
  const ROOMS:Record<RoomId,RoomDef>={
    entrance:{label:'Welcome'},
    intake:{label:'Intake',hotspots:[{at:[9.5,2.2,-11],label:'Entry Assessment',run:open('career',1)}]},
    pro:{label:'Specialise',hotspots:[{at:[7,9,-40.5],label:'Specialisation pods',run:open('career',4)}]},
    // Develop: the project bench (the record task) and four optional area close-ups.
    develop:{label:'Develop',hotspots:[{at:[-10.4,7.9,-39.3],label:'Project record',run:()=>mission.act('records','check')},...DEVELOP_AREAS.map((a,i)=>({at:[a.at[0],8.4,a.at[2]] as P3,label:a.name,run:()=>mission.act('records','area:'+i)}))]},
    engineer:{label:'Engineer',hotspots:[{at:[14.5,3.2,-32.4],label:'The project',run:()=>mission.act('pod','view:machine')},...POD_PLACE.at.map((p,i)=>({at:[p[0],2.25,p[2]] as P3,label:['Data work','Hands-on work','System build','User screen','Deploy & access'][i],run:()=>mission.act('pod','p:'+i)}))]},
    delivery:{label:'Delivery',hotspots:[{at:[2.8,4.1,-35],label:'Stage boards',run:open('career',5)}]},
    verify:{label:'Verify',hotspots:[{at:[21,9.2,-43.8],label:'ETAF™ assurance core',run:open('career',6)}]},
    deploy:{label:'Deploy',hotspots:[{at:[0,6.4,-72],label:'ETAF™ gate',run:open('career',7)}]},
    dock:{label:'Dock',hotspots:[{at:[32,3,-8.5],label:'The five bays',run:open('workforce',0)}]},
    talent:{label:'Talent',hotspots:[{at:[19.5,2.2,-5.6],label:'Talent shelf',run:open('workforce',1)}]},
    teams:{label:'Teams',hotspots:[{at:[-24.3,3.4,-8.8],label:'Reskilling line',run:open('workforce',3)}]},
    apply:{label:'Applied work',hotspots:[{at:[-24.3,3.4,-8.8],label:'Apply station',run:open('workforce',3)}]},
    campus:{label:'Campus',hotspots:[{at:[-50,3.5,-23],label:'Campus actors',run:open('workforce',4)}]},
    scope:{label:'Scope',hotspots:[{at:[-50,3.5,-23],label:'Campus scope',run:open('workforce',4)}]},
    plaza:{label:'AI for Everyone'},
    preview:{label:'Your route'},pTask:{label:'A familiar task'},pDemo:{label:'Practical example'},pPath:{label:'Learning path'},pNext:{label:'Next step'}};
  const STORYANCH:Record<PathId,string>={student:'fCareer',founder:'fWork',hr:'fWork',university:'fWork',professional:'fGlobe'};
  const CATS:Record<PathId,string>={student:'For students',founder:'For startups',hr:'For organisations',university:'For universities',professional:'For professionals'};
  let pendSide=-1,pendView:'work'|'path'='path';
  /** The POD mission at the Engineer stop (src/pod). */
  const mission=new PodMission({factory:()=>window.FACTORY,focus:(p,room)=>setRoomFocus((room??'engineer') as RoomId,p),
    goRoom:room=>{if(mode!=='tour'||tour.route!=='story'||!story.audience)return;const i=story.indexOfRoom(story.audience,room as RoomId);if(i>=0){story.scrollToActivity();tour.travel(i)}},
    enquire:label=>openDrawer('ph',label,'Product Engineering PODs')});let podAt=-1,roomAt='';const ROOMHOOK=['develop','pro','verify','deploy'];
  // Text on the 3D trace panel and alert screen follows the language.
  const paintPodLabels=()=>window.FACTORY?.podLabels(podLabels());i18n.on(paintPodLabels);i18n.on(()=>mission.syncDev());
  // A labelled example of an ETAF review: gates light one by one as evidence is reviewed, then go dark again.
  let etafDemoUntil=0;
  const etafNote=document.createElement('p');etafNote.id='etafNote';etafNote.hidden=true;etafNote.setAttribute('role','status');etafNote.innerHTML='<b>Example review</b> Gates light as each piece of evidence is reviewed. This is an illustration, not a real result.';document.body.appendChild(etafNote);
  function playEtafDemo(){etafDemoUntil=performance.now()+(reduce?4000:9000);window.FACTORY?.etaf(false)}
  const pendWorld:Object3D[]=[];
  const story:Story=new Story({
    project:(x,y,z)=>FX().project(x,y,z),
    addWorld:(o)=>{if(window.FACTORY)window.FACTORY.addWorld(o);else pendWorld.push(o)},
    setStops:(stops,goTo)=>{tour.setStops('story',stops);if(mode==='tour'&&tour.route==='story')tour.jump(goTo);else startTour('story',goTo)},
    travel:(i)=>tour.travel(i),
    board:(el)=>{const F=window.FACTORY;if(!F)return null;const o=F.css(el);o.visible=false;return{place:(at,face,w)=>F.aim(o,at,face,1,0,w,440),show:(on)=>{o.visible=on}}},
    open:(key,c)=>{if(key==='etaf:demo'){playEtafDemo();return}if(key==='globe:work'){story.hide();pendSide=PROFESSION_NODE[Math.max(0,c.profession)]??0;pendView='work';toGlobe();return}const [r,i]=key.split(':');openStop(r,+i)},
    detailOpen:()=>cd.classList.contains('open')||flatOpen,
    explore:()=>{story.hide();startTour('career',0)},
    onAudience:(a)=>{stCat=a?CATS[a]:'For students';if(a)mission.defaultFor(a);const au=a?({hr:'ent',university:'uni',founder:'st'} as Record<string,string>)[a]:undefined;if(au){applyFil(au);tray.setAudience(au)}},
    journey:(j)=>{if(mode==='tour'&&tour.route==='story')syncPath(j==='workforce'?'workforce/':'')},
    gallery:()=>{setPath('evidence-impact/',true);go({k:'evidence'})},activity:(id)=>mission.activity(id),region:()=>{mission.defaultFor('region');applyFil('gov');tray.setAudience('gov');setPath('workforce/ecosystem/',true);go({k:'bay',stop:'region'})},
    fov:()=>window.FACTORY?.cam().fov??50,
    reduced:()=>motion.reduced,
    setReduced:(on)=>motion.set(on),
  },ROOMS,makeRoutes({
    openStop:(r,i)=>openStop(r,i),
    talk:(t,e)=>openDrawer('ph',t,e),
    freeTour:(r)=>{story.hide();startTour(r,1)},
    campusForm:(t)=>goForm(3,t),
    globe:(node)=>{story.hide();pendSide=node;toGlobe()},
  }),PROFESSIONS);
  (TOURS as Record<TourRoute,TourStop[]>).story=story.entranceStops();
  // After "Exit tour", one button brings the visitor back to the guided route where they left it.
  // "Your journey" (with its chapter list) is the one way back into the guided route; no separate resume button.
  const tour=new Tour({
    project:(x,y,z)=>FX().project(x,y,z),
    paused:()=>cd.classList.contains('open')||flatOpen||menuOpen||!!window.__storyShowing,
    frame:(r,v,settled,dt)=>{if(r==='story'){while(pendWorld.length&&window.FACTORY)window.FACTORY.addWorld(pendWorld.shift()!);story.update(v,settled,dt)}else story.hide()},
    between:(r,i,e)=>{if(r==='story')return story.camAt(i,e);if(r!=='career')return null;if(i<4)return FX().routePose('career',CK[i]+(CK[i+1]-CK[i])*e);
      if(i===4){const [p0,l0]=FX().routePose('career',CK[4]),[p1,l1]=DEPLOY,c:P3=[10,26,-58],u=1-e,q=(k:number)=>u*u*p0[k]+2*u*e*c[k]+e*e*p1[k];return[[q(0),q(1),q(2)],[l0[0]+(l1[0]-l0[0])*e,l0[1]+(l1[1]-l0[1])*e,l0[2]+(l1[2]-l0[2])*e]]}
      return null},
    onRoute:(r)=>{closeDrawer();route=r},
    onStop:(r,i,settled)=>{const F=window.FACTORY;if(!F)return;
      if(!settled&&cd.classList.contains('open'))closeDrawer();
      tourSettled=settled;const sroom=r==='story'?story.roomAt(i):undefined;if(settled&&sroom==='engineer'&&podAt!==i){podAt=i;paintPodLabels();mission.enter()}else if(sroom!=='engineer'){if(podAt>=0)mission.leave();podAt=-1}
      // Develop, Specialise, Verify and Deploy set up their activity on arrival and tidy it on leaving.
      {const hooked=!!sroom&&ROOMHOOK.includes(sroom),tidy=()=>{if(roomAt.startsWith('pro'))F.specPod(-1);if(roomAt.startsWith('verify'))mission.leaveVerify()};
       if(settled&&hooked&&roomAt!==sroom+i){tidy();roomAt=sroom+i;({develop:()=>mission.enterDevelop(),pro:()=>mission.enterSpecialise(),verify:()=>mission.enterVerify(),deploy:()=>mission.enterDeploy()} as Record<string,()=>void>)[sroom!]()}
       else if(!hooked&&roomAt){tidy();roomAt=''}}tourCar=r==='career'?CEQ[i]:r==='story'?(sroom?ROOMEQ[sroom]??-1:-1):-1;tourWf=r==='story'?(sroom?ROOMWF[sroom]??-1:-1):r==='career'?(TOURS.career[i]?.id==='showroom'?1:-1):r==='evidence'?-1:(i>=1?i-1:-1);
      if(tourWf>=0&&tourWf!==wfAt){wfAt=tourWf;setBayHv(-1);F.pod(wfAt===2);if(wfAt===2)F.podJump(-1.62);F.wfStop(wfAt);if(wfAt===3||wfAt===4)F.campusIn()}
      if(tourWf<0&&wfAt!==0){wfAt=0;F.pod(false)}
      wfArr=settled;
      if(tourCar===5&&settled)F.setCrate(curStage);
      if(settled&&TOURS[r][i]?.id==='world')toGlobe();
      if(settled)syncPath(pathOfStop(r,i))}},TOURS as Record<TourRoute,TourStop[]>,track);
  /** Site path for a tour stop (guided story or free tour). */
  function pathOfStop(r:TourRoute,i:number):string{
    if(r==='story')return story.pathAt(i);
    if(r==='evidence')return 'evidence-impact/';
    const id=TOURS[r][i]?.id??'';
    if(r==='career')return ({intake:'career/assessment/',develop:'career/launch/',engineer:'career/accelerate/',verify:'career/assurance/',deploy:'career/opportunities/',showroom:'workforce/verified-talent/',world:'ai-for-everyone/'} as Record<string,string>)[id]??'';
    return ({dock:'workforce/',talent:'workforce/verified-talent/',pods:'workforce/product-engineering/',teams:'workforce/capability/',campus:'workforce/campus/',region:'workforce/ecosystem/',showroom:'workforce/'} as Record<string,string>)[id]??'';
  }
  /** A new place adds a history entry (so Back returns to it); arriving after Back or Forward only corrects the address. */
  let entered=false,popping=false;
  const passport=new Passport(p=>{const r=routeFor(p);if(r)go(r.dest)},currentPath,()=>closeMenu());
  function syncPath(path:string){if(!entered||flatOpen)return;passport.visit(path);if(popping){popping=false;setPath(path,false);return}setPath(path,path!==currentPath())}
  // ---- The 3D opening, the lobby and routing ----
  const opening=new Opening(o=>{if(window.FACTORY)window.FACTORY.addWorld(o);else pendWorld.push(o)},()=>lobbyPose(),()=>{const F=window.FACTORY;return F?{note:n=>F.opNote(n),select:i=>F.podSelect(i),run:(c,r)=>F.podRun(c,r),reset:()=>{F.podReset();F.podMission(0)}}:null});
  let openLast=0;
  const openedKey='ee-opened';
  const opened=()=>{try{return sessionStorage.getItem(openedKey)==='1'}catch{return true}};
  function playOpening(){closeMenu();closeDrawer();closeFlat();if(mode==='globe'||mode==='gIn'||mode==='gOut'){window.FACTORY?.globeReset();document.body.style.cursor=''}tour.stop();story.hide();tour.setStops('story',story.reset());openLast=0;mode='opening';
    opening.start(end=>{try{sessionStorage.setItem(openedKey,'1')}catch{/* storage blocked */}
      // Construction completes as soon as a destination is chosen; the project returns to the visitor's own choice.
      window.FACTORY?.build(1);mission.sync();
      if(end==='career'){enterLobby();story.startAt('student','intake')}
      else if(end==='workforce'){resetToIntro('workforce',1)}
      else if(end==='ai'){enterLobby();toGlobe();gReturn=null;paintGlobeBack()}
      else if(end==='path'){const r=routeFor(currentPath())??routeFor('')!;if(r.dest.k==='home')enterLobby();else go(r.dest)}
      else enterLobby()},tour.reduce)}
  /** The lobby: the guide's three-journey question on the plaza. */
  function enterLobby(){if(mode==='tour'&&tour.route==='story'&&!story.audience){tour.jump(0);return}tour.setStops('story',story.reset());resetToIntro('story',0)}
  /** Open a destination (from the address bar, the menu or Back). */
  function go(d:Dest){closeMenu();passport.close();closeDrawer();closeFlat();
    switch(d.k){
      case 'home':if(!opened())playOpening();else enterLobby();break;
      case 'journey':enterLobby();if(d.j==='career')story.chooseAt('student',1);else if(d.j==='ai')story.chooseAt('professional',1);else story.askWorkforce();break;
      case 'career':{enterLobby();story.chooseAt('student',story.indexOfRoom('student',d.room));const pnl=d.panel;if(pnl){const [r,i]=pnl.split(':');setTimeout(()=>openStop(r,+i),900)}break}
      case 'bay':{const i=TOURS.workforce.findIndex(x=>x.id===d.stop);resetToIntro('workforce',Math.max(1,i));break}
      case 'globe':resetToIntro('career',0);toGlobe();gReturn=null;paintGlobeBack();break;
      case 'page':enterLobby();openFlat(false,d.anchor);break;
      case 'evidence':resetToIntro('evidence',0);break;
    }}
  /** First frame with the 3D ready: open the place in the address, resume this tab's tour, or play the opening. */
  function beginEntry(){entered=true;mission.sync();paintPodLabels();
    if(location.hash==='#skip-3d'||location.hash==='#skip'){enterLobby();openFlat(false,'fTop');return}
    const legacy=legacyHashPath();if(legacy!==null)setPath(legacy,false);
    const path=currentPath(),sv=story.savedState();
    if(sv&&path&&sv.path===path){enterLobby();story.resumeSaved();return}
    go(currentRoute().dest)}
  onPathChange(path=>{if(!window.FACTORY)return;
    // Back/Forward during the opening leaves it for the requested place (the home address stays in it).
    if(mode==='opening'){if(path)opening.finish('path');return}
    // Back and Forward within the guided route step between its stops.
    if(path&&mode==='tour'&&tour.route==='story'&&story.audience){const k=story.indexNear(path,tour.index);if(k>=0){popping=true;tour.travel(k);return}}
    popping=true;const r=routeFor(path)??routeFor('')!;if(r.dest.k==='home')enterLobby();else go(r.dest)});
  function TOURS_ALL(){return TOURS as Record<TourRoute,TourStop[]>}
  function startTour(r:TourRoute,at:number){closeDrawer();mode='tour';route=r;tour.start(r,at)}
  // Scrolling back up while on the globe returns to the company.
  addEventListener('wheel',e=>{if(mode==='globe'&&e.deltaY<-30&&!(e.target as Element).closest?.('#gSide,#gWho,#gList,aside'))leaveGlobe(null)},{passive:true});

  // __hold (dev/review only) freezes the loop so a composed camera pose can be captured.
  function loop(now:number){requestAnimationFrame(loop);if((window as {__hold?:boolean}).__hold)return;step(now,false)}
  requestAnimationFrame(loop);
  window.__step=()=>step(performance.now()+99999,true);
  addEventListener('scroll',()=>{if(document.hidden)window.__step!()},{passive:true});
  // No enquiry endpoint is configured. Keep the fields intact and never claim a submission.
  function markFormUnavailable(form:HTMLFormElement){
    const submit=form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent=form.id==='regForm'||form.dataset.f==='reg'?'Online registration unavailable':'Online enquiries unavailable'}
    if(!form.querySelector('.availabilityNote')){const note=document.createElement('p');note.className='availabilityNote';note.setAttribute('role','status');note.textContent='Online submission is not available yet. Nothing entered here will be sent. Please return when contact details are published.';form.appendChild(note)}
    form.addEventListener('submit',event=>event.preventDefault());
  }
  for(const id of ['regForm','modelForm','probForm'])markFormUnavailable($<HTMLFormElement>(id));
  function openMenu(){passport.close();tray.close();menu.hidden=false;menuOpen=true;menuBtn.setAttribute('aria-expanded','true');[...menu.querySelectorAll<El>('button')].find(b=>b.offsetParent)?.focus()}
  function closeMenu(){if(!menuOpen)return;const f=menu.contains(document.activeElement);menu.hidden=true;menuOpen=false;menuBtn.setAttribute('aria-expanded','false');if(f)menuBtn.focus()}
  menuBtn.onclick=()=>menuOpen?closeMenu():openMenu();
  addEventListener('pointerdown',e=>{if(menuOpen&&!(e.target as Element).closest('#menu,#menuBtn'))closeMenu()});
  function resetToIntro(r:TourRoute='story',at=0){if(side.classList.contains('open'))closeSide();if(whoOpen)closeWho();if(mode==='globe'||mode==='gIn'||mode==='gOut'){window.FACTORY&&window.FACTORY.globeReset();document.body.style.cursor='';gReturn=null;paintGlobeBack()}gNext=null;pending=null;startTour(r,at)}
  const HASH:Record<string,string>={career:'career',workforce:'workforce',globe:'ai-for-everyone',evidence:'evidence',skip:'skip-3d'},ANCH:Record<string,string>={career:'fCareer',workforce:'fWork',globe:'fGlobe',evidence:'fEvidence',skip:'fTop'};
  let flatTour:{route:TourRoute;index:number}|null=null;
  function openFlat(auto:boolean,anchor:string){
    if(!flatOpen)flatTour=mode==='tour'?{route:tour.route,index:tour.index}:null;
    flat.hidden=false;flatOpen=true;flat.tabIndex=-1;flat.setAttribute('aria-label','EmpowerED standard page');if(auto)flatAuto=true;
    $('fNote').hidden=!flatAuto;$('fBack').hidden=flatAuto;closeMenu();story.hide();document.documentElement.style.overflow='hidden';
    requestAnimationFrame(()=>{const el=anchor&&$(anchor);flat.scrollTop=el?el.offsetTop-84:0;flat.focus({preventScroll:true})});
  }
  function closeFlat(){
    if(flatAuto||!flatOpen)return;
    flat.hidden=true;flatOpen=false;document.documentElement.style.overflow='';
    const saved=flatTour;flatTour=null;
    if(saved&&mode==='tour'&&tour.route===saved.route)tour.jump(saved.index);
    if(mode==='tour')syncPath(pathOfStop(tour.route,tour.index));
    requestAnimationFrame(()=>{if(mode==='tour'&&tour.route==='story')story.restoreFocus(null);else menuBtn.focus({preventScroll:true})});
  }
  function paintLight(){const b=menu.querySelector<El>('[data-go="light"]');if(b){b.setAttribute('aria-pressed',String(quality.light));b.innerHTML='Lighter 3D <span>'+(quality.light?'On':'Off')+'</span>'}}
  paintLight();quality.on(paintLight);
  function paintMotion(){const b=menu.querySelector<El>('[data-go="motion"]');if(b){b.setAttribute('aria-pressed',String(motion.reduced));b.innerHTML='Reduce motion <span>'+(motion.reduced?'On':'Off')+'</span>';translateDom(b)}}
  paintMotion();motion.on(paintMotion);
  // Language: English or Tamil (draft). The switch shows the other language's name in its own script.
  function paintLang(){const ta=i18n.lang==='ta',b=$('langBtn'),m=menu.querySelector<El>('[data-go="lang"]');b.textContent=ta?'English':'தமிழ்';b.lang=ta?'en':'ta';b.setAttribute('aria-label',ta?'Switch to English':'தமிழுக்கு மாறவும்');if(m)m.innerHTML=(ta?'<span lang="en">English</span>':'<span lang="ta">தமிழ்</span>')+' <span>→</span>';
    ['menu','hdrBack','menuBtn'].forEach(id=>translateDom($(id)))}
  $('langBtn').onclick=()=>i18n.set(i18n.lang==='ta'?'en':'ta');paintLang();i18n.on(paintLang);
  function nav(k:string){if(k==='lang'){i18n.set(i18n.lang==='ta'?'en':'ta');return}if(k==='light'){quality.set(!quality.light);return}if(k==='motion'){motion.set(!motion.reduced);return}
    if(k==='free'){closeMenu();if(!window.FACTORY)return;story.hide();resetToIntro('career',0);return}closeMenu();if(k==='opening'){setPath('',true);playOpening();return}
    if(k==='skip'||flatAuto||!window.FACTORY){history.replaceState(history.state,'',location.pathname+location.search+'#skip-3d');const inStory=mode==='tour'&&tour.route==='story'&&!!story.audience;$('fBack').textContent=inStory?'← Back to your guided tour':'← Back to the 3D company';openFlat(false,inStory&&k==='skip'?STORYANCH[story.audience!]:ANCH[k]);return}
    // From a tour or guided stop, the globe remembers where the visitor was, so both Back buttons return there.
    if(k==='globe'&&window.FACTORY&&mode==='tour'){toGlobe();return}
    const p=({career:'career/',workforce:'workforce/',globe:'ai-for-everyone/',evidence:'evidence-impact/'} as Record<string,string>)[k];if(p===undefined)return;setPath(p,true);go(routeFor(p)!.dest)}
  menu.querySelectorAll<El>('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go!));
  document.querySelectorAll<El>('.logo').forEach(a=>a.onclick=e=>{e.preventDefault();closeMenu();closeFlat();setPath('',true);enterLobby()});
  const esc=(s:string)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as Record<string,string>)[c]);
  (function buildFlat(){
    const pan=(sel:string)=>[...document.querySelectorAll(sel)].map(el=>{const h2=el.querySelector('h2'),p=el.querySelector('.lede2'),sv=[...el.querySelectorAll('.svc,.flow')].map(x=>'<div class="svc">'+x.innerHTML+'</div>').join('');return '<li><span class="chip">'+el.querySelector('.eyebrow')!.textContent+'</span>'+(h2?'<h4>'+h2.innerHTML+'</h4>':'')+(p?'<p>'+p.innerHTML+'</p>':'')+sv+'</li>'}).join('');const car=pan('.cp:not(.wm)');
    const wf=pan('.cp.wm');
    const inds=INDS.filter(d=>!d.ph).map(d=>'<li><h4>'+esc(d.name)+'</h4><p class="gl">'+esc(d.line)+'</p><ol>'+d.uses.map(u=>'<li>'+esc(u)+'</li>').join('')+'</ol></li>').join('');
    const reg=$('regForm').outerHTML.replace(' id="regForm"',' data-f="reg"');
    
    flat.innerHTML='<div class="fw"><div class="fbar"><p class="fnote" id="fNote" hidden>The 3D view is not available on this device, so EmpowerED is shown as a page.</p><button class="backBtn" id="fBack" type="button">← Back to the 3D company</button></div>'
     +'<section id="fTop"><h1>EmpowerED Careers</h1><p class="fsub">Home of the AI Talent Factory. Develop capability. Engineer for real. Verify readiness. Deploy with confidence.</p><p>Product Engineering · ETAF™ · Enterprise Deployment</p><p class="fbig">Learning ≠ Getting Hired</p><p class="fbig">What can you actually do?</p><p>Enterprise-ready capability, built through real engineering.</p><h3>What are you here to build?</h3><nav class="fjump" aria-label="Sections"><a href="#fStory">From pressure to proven capability →</a><a href="#fCareer">Build My Career →</a><a href="#fWork">Build My Workforce →</a><a href="#fGlobe">AI for Everyone →</a><a href="#fEvidence">Evidence &amp; Impact →</a></nav></section>'
     +'<section id="fStory"><h2>From pressure to proven capability</h2><p>A business needs AI capability. A graduate needs experience. An engineer needs a practical way forward. Real business work, led and reviewed by experts, brings them together.</p><ol>'+BEATS.map(b=>'<li><h4>'+esc(b.cap)+'</h4><p>'+esc(b.line)+'</p>'+(b.done?'<p>'+esc(b.done)+'</p>':'')+(b.note?'<p class="note">'+esc(b.note)+'</p>':'')+'</li>').join('')+'</ol><p>The Career route then has six stops: Intake, Develop, Specialise, Engineer, Verify and Deploy.</p></section>'
     +'<section id="fCareer"><h2>Build My Career</h2><ol>'+car+'</ol><p>Before an assessment result exists, every career path starts with the Entry Assessment.</p><h3>Register for the Weekend Assessment Drive</h3>'+reg+'</section>'
     +'<section id="fWork"><h2>Build My Workforce</h2><ol>'+wf+'</ol></section>'
     +'<section id="fGlobe"><h2>AI for Everyone</h2><p>AI for every profession. Explore how AI is reshaping the work people already do.</p><ol class="finds">'+inds+'</ol></section>'
     +'<section id="fEvidence"><h2>Evidence &amp; Impact</h2><p>Approved evidence, case studies and outcomes are being prepared. Examples shown on this site are labelled as illustrative.</p></section></div>';
    flat.querySelectorAll<El>('.fjump a').forEach(a=>a.onclick=e=>{e.preventDefault();const el=$(a.getAttribute('href')!.slice(1));flat.scrollTo({top:el.offsetTop-84,behavior:reduce?'auto':'smooth'})});
    $('fBack').onclick=closeFlat;
    flat.querySelectorAll<El>('.enq').forEach(b=>b.onclick=()=>{const cb=flat.querySelector<HTMLInputElement>('form[data-f="partner"] input[data-k="'+b.dataset.offer!+'"]');if(cb)cb.checked=true;flat.scrollTo({top:$('fPartner').offsetTop-84,behavior:reduce?'auto':'smooth'})});
    flat.querySelectorAll<HTMLFormElement>('form').forEach(markFormUnavailable);
  })();
  const KEYS:Record<string,string>={career:
'career',workforce:'workforce','ai-for-everyone':'globe',globe:'globe',evidence:'evidence','skip-3d':'skip',skip:'skip'};
  function fromHash(){const k=KEYS[location.hash.slice(1)];if(!k)return;if(k==='skip'||k==='evidence'||window.FACTORY){nav(k);return}let n=0;const w=setInterval(()=>{if(window.FACTORY||++n>90){clearInterval(w);nav(k)}},100)}
  addEventListener('hashchange',()=>{if(!window.FACTORY)return;const p=legacyHashPath();if(p!==null){setPath(p,false);go(routeFor(p)!.dest)}else if(location.hash==='#skip-3d'||location.hash==='#skip')nav('skip')});
  const webglOK=(()=>{try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){return false}})();
  if(!webglOK)openFlat(true,routeAnchor());else setTimeout(()=>{if(!window.FACTORY)openFlat(true,routeAnchor())},10000);
  /** Without 3D, the standard page opens at the section for the address. */
  function routeAnchor():string{const d=currentRoute().dest;return d.k==='page'?d.anchor:d.k==='evidence'?'fEvidence':d.k==='career'||(d.k==='journey'&&d.j==='career')?'fCareer':d.k==='bay'||(d.k==='journey'&&d.j==='workforce')?'fWork':d.k==='globe'||(d.k==='journey'&&d.j==='ai')?'fGlobe':'fTop'}
  return {
    enterFromStory(intent='welcome'){
      if(!window.FACTORY)return;
      if(intent==='welcome'){
        // Explicit text deep links remain open. Starting/replaying the guided tour
        // always returns to the goal question, with saved progress still available.
        if(!flatOpen){tour.setStops('story',story.reset());resetToIntro('story',0)}
        requestAnimationFrame(()=>{if(!flatOpen&&mode==='tour'&&tour.route==='story')story.restoreFocus(null)});
        return;
      }
      closeFlat();closeDrawer();resetToIntro('story',0);
      if(intent==='skip'){openFlat(false,'fTop');return}
      if(intent==='globe'){toGlobe();return}
      if(intent==='workforce'){goForm(1,'Bring Us a Problem');return}
      if(intent==='contact'){openDrawer('ph','Talk to our team','EmpowerED Careers');return}
      story.choose('student');tour.jump(2);openDrawer('how');
    },
    beforeStory(){closeMenu();closeDrawer();closeFlat();if(mode==='globe'||mode==='gIn'||mode==='gOut')resetToIntro(tour.route,0)},
  };
}
