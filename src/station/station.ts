// Station: departure board, the three line rides, and story-intro handover/replay.
// Ported from the prototype's station script. The SVG line renderer and ride state
// machine are kept as-is; cross-module hooks go through the typed bridge on window.
import { storyIntroUrl } from '../config';
import { LANDMASK } from '../data/content';
import type { LineKey, StopCopy } from '../bridge';

type V3 = number[];
/** Per-group render state: opacity, z/x/y offsets, stroke override, clip-to-ZMAX. */
interface Grp { o: number; dz: number; dx?: number; dy?: number; st: string | null; w: number; clip: boolean }
/** Detail drawn on top of a face: a polygon, a line (`ln`) or a text label (`tx`). */
interface Kid { pts: V3[]; fill?: string; g?: string; ln?: number; op?: number; w?: number; dash?: string; st?: string; tx?: string; p?: V3; s?: number; A?: V3; B?: V3 }
interface Face { pts: V3[]; n: V3; fill: string; g: string; kids: Kid[]; bg?: boolean }
interface Box { nx: Face; px: Face; py: Face; nz: Face }
interface GLine { a: V3; b: V3; op: number; g: string }
interface Pin { el: HTMLElement; p: V3; g: string; m: string; ax: string; o: number; card: boolean; _s?: string }
interface RailOpts { g?: string; w?: number; dash?: string; st?: string; grow?: number }
interface Pose { c: number[]; cy: number; dz: number; pitch?: number }
interface Anim { from: Pose; to: Pose; t0: number; dur: number; done?: () => void; tick?: (u: number) => void }
/** A custom-line station card: heading, paragraph, optional [label, action, class] buttons. */
interface Stop { n: string; h: string; p: string; b?: string[][] }
/** A factory stop reference: [route, index] into `window.__stopC()`. */
type StopRef = [string, number];
interface RideLine { name: string; cat: string; custom: boolean; st: (Stop | StopRef)[] }

export function initStation(): void {
  var fr=document.getElementById('storyIntro') as HTMLIFrameElement,stn=document.getElementById('station') as HTMLElement;if(!fr||!stn)return;
  fr.src=storyIntroUrl();
  var de=document.documentElement,state='story',reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var locked=function(){return state!=='factory'};
  de.classList.add('introOn');try{history.scrollRestoration='manual'}catch(e){}scrollTo(0,0);
  var keep=function(el:Element){return el===fr||el===stn||el.tagName==='SCRIPT'||el.tagName==='STYLE'};
  var inertAll=function(){var on=locked();[].forEach.call(document.body.children,function(el:HTMLElement){if(!keep(el))el.inert=on})};
  var mo=new MutationObserver(inertAll);document.addEventListener('DOMContentLoaded',inertAll);inertAll();mo.observe(document.body,{childList:true});
  var block=function(e:Event){if(!locked())return;if(window.__rideInput)window.__rideInput(e);var inSt=e.target&&(e.target as Node).nodeType===1&&stn.contains(e.target as Node);e.stopImmediatePropagation();if(e.cancelable&&e.type!=='keyup'&&!(inSt&&e.type==='keydown'))e.preventDefault()};
  ['wheel','keydown','keyup','touchmove'].forEach(function(t){addEventListener(t,block,{capture:true,passive:false})});
  addEventListener('scroll',function(){if(state==='story'&&scrollY)scrollTo(0,0)},true);

  /* station line drawing */
  var svg=document.getElementById('stSvg') as HTMLElement,CY=430,FX=900,NEAR=.4,ZMAX=415,INK='#0F2B22',PAP='#F2EFE2',YEL='#F6DB2D',GOLD='#C9A33A',GA=76,GB=136;
  var faces:Face[]=[],lines:GLine[]=[],GV:Record<string,Grp>={},PINS:Pin[]=[],cg='base';
  function gv(g:string):Grp{return GV[g]||(GV[g]={o:1,dz:0,st:null,w:0,clip:false})}
  function Fc(pts:V3[],n:V3,fill?:string,g?:string):Face{var f:Face={pts:pts,n:n,fill:fill||PAP,g:g||cg,kids:[]};gv(f.g);return f}
  function box(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,fill?:string,g?:string):Box{var r={nx:Fc([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[-1,0,0],fill,g),px:Fc([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],[1,0,0],fill,g),py:Fc([[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]],[0,1,0],fill,g),nz:Fc([[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]],[0,0,-1],fill,g)};faces.push(r.nx,r.px,r.py,r.nz);return r}
  function dX(p:Face,x:number,y0:number,y1:number,z0:number,z1:number,f:string){p.kids.push({pts:[[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0]],fill:f})}
  function dZ(p:Face,z:number,x0:number,x1:number,y0:number,y1:number,f:string,g?:string){var k:Kid={pts:[[x0,y0,z],[x0,y1,z],[x1,y1,z],[x1,y0,z]],fill:f,g:g};p.kids.push(k);return k}
  function dP(p:Face,pts:V3[],f:string){p.kids.push({pts:pts,fill:f})}
  function dL(p:Face,a:V3,b:V3,o?:Partial<Kid>){var k:Kid={pts:[a,b],ln:1};if(o)for(var q in o)(k as unknown as Record<string,unknown>)[q]=(o as Record<string,unknown>)[q];p.kids.push(k);return k}
  function dT(p:Face,tx:string,at:V3,s:number,fill:string,g?:string){var k={tx:tx,p:at,s:s,fill:fill,g:g} as Kid;p.kids.push(k);return k}
  function GL(a:V3,b:V3,op:number,g?:string){lines.push({a:a,b:b,op:op,g:g||cg});gv(g||cg)}
  // ground
  [-260,-150,-90,-55,-32,-20,7,10,15,23,35,55,90,150,260].forEach(function(x){GL([x,0,1],[x,0,560],.22)});
  [9,13,19,27,38,54,76,106,150,210,300,420].forEach(function(z){GL([-300,0,z],[300,0,z],.22)});
  for(var z=1.5;z<300;z+=(z<100?2:6))GL([2.75,.06,z],[4.95,.06,z],.5,z>GA&&z<GB?'railGap':z>50?'trunk':'base');
  [3.1,4.6].forEach(function(x){GL([x,.15,.5],[x,.15,50],1);GL([x,.15,50],[x,.15,GA],1,'trunk');GL([x,.15,GA],[x,.15,GB],1,'railGap');GL([x,.15,GB],[x,.15,ZMAX],1,'trunk')});
  // platforms
  var SZ=[7,60,113,166,219,272];
  SZ.forEach(function(s,i){cg=i?'plats':'base';var z0=i?s-6:.5,z1=s+40,pl=box(-14,2.2,0,1,z0,z1);for(var z=z0+4;z<z1;z+=(z-z0<20?4:7))dL(pl.py,[-14,1,z],[2.2,1,z]);
    dL(pl.py,[1.55,1,z0],[1.55,1,z1]);dL(pl.py,[1.85,1,z0],[1.85,1,z1]);
    [12,24,36].forEach(function(o){var z=s+o;box(1.74,1.86,1,5.4,z,z+.12);box(1.35,2.25,5.3,5.5,z-.2,z+.32)})});
  cg='base';
  // factory
  [[-92,-58],[58,92]].forEach(function(w){box(w[0],w[1],0,13,436,470)});
  var hall=box(-58,58,0,24,428,470);
  for(var x=-58;x<58;x+=14.5)dP(hall.nz,[[x,24,428],[x+14.5,24,428],[x,31,428]],PAP);
  [-54,-46,-38,-30,24,32,40,48].forEach(function(x){dZ(hall.nz,428,x,x+5,9,17,PAP)});
  var tw=box(-16,16,0,38,415,450);dZ(tw.nz,415,-12,12,30,34,INK);dZ(tw.nz,415,-12,-4,14,24,PAP);dZ(tw.nz,415,4,12,14,24,PAP);dZ(tw.nz,415,1,6.6,0,9,INK);
  dZ(tw.nz,415,-8.6,-.6,3.2,5.6,INK,'esign');dT(tw.nz,'DEVELOP',[-4.6,4.4,415],1.15,YEL,'esign');
  dZ(tw.nz,415,8.2,16,3.2,5.6,INK,'esign');dT(tw.nz,'VERIFY',[12.1,4.4,415],1.15,YEL,'esign');
  [[[.6,0,415],[.6,9.6,415]],[[.6,9.6,415],[7,9.6,415]],[[7,9.6,415],[7,0,415]]].forEach(function(s){dL(tw.nz,s[0],s[1],{g:'door',st:GOLD,w:3.4,op:1})});
  // train
  gv('train').clip=true;
  function car(z0:number,lead:number){var c=box(2.7,5.0,.6,4.4,z0,z0+20,PAP,'train');
    dX(c.nx,2.7,1.42,1.7,z0,z0+20,INK);
    for(var k=0;k<5;k++)dX(c.nx,2.7,2.35,3.45,z0+2.4+k*3.2,z0+4.5+k*3.2,INK);
    dX(c.nx,2.7,.8,3.75,z0+.5,z0+1.7,PAP);dX(c.nx,2.7,.8,3.75,z0+18.3,z0+19.5,PAP);
    if(lead){dZ(c.nz,z0,3.0,4.7,2.4,3.7,INK);dZ(c.nz,z0,2.85,4.85,1.1,1.6,INK);dZ(c.nz,z0,3.05,3.5,1.24,1.46,YEL);dZ(c.nz,z0,4.2,4.65,1.24,1.46,YEL)}
    [[2,5],[15,18]].forEach(function(b){box(3.2,4.5,.25,.6,z0+b[0],z0+b[1],PAP,'train')})}
  car(7,1);box(3.3,4.4,1,3.8,27,27.8,INK,'train');car(27.8,0);
  // career line world
  var gapF=Fc([[-300,.02,GA],[-300,.02,GB],[300,.02,GB],[300,.02,GA]],[0,1,0],PAP,'gap');gapF.bg=true;faces.push(gapF);
  for(var c0=-130-GB;c0<=140-GA;c0+=3.2){var za=Math.max(GA,-130-c0),zb=Math.min(GB,140-c0);if(zb-za>.2)dL(gapF,[za+c0,.02,za],[zb+c0,.02,zb],{op:.3,w:1})}
  dL(gapF,[-300,.02,GA],[300,.02,GA],{op:1,w:1.6});dL(gapF,[-300,.02,GB],[300,.02,GB],{op:1,w:1.6});
  var TN:[string,number,string][]=[['Career Launch',-40,'dashL'],['Career Pro',3.85,'dashC'],['Career Accelerate',48,'dashR']];
  TN.forEach(function(d){[-.75,.75].forEach(function(o){dL(gapF,[3.85+o,.1,GA],[d[1]+o,.1,GB],{g:d[2],op:1,w:1.5,dash:'8 7'})})});
  var SEC=['Discover','Design','Build','Test &amp; Secure','Deploy &amp; Operate','Demo &amp; Validate'];
  SEC.forEach(function(n,k){var z0=GA+k*10,z1=z0+10,g='sec'+k;dL(gapF,[3.1,.15,z0],[3.1,.15,z1],{g:g,op:1,w:1.4});dL(gapF,[4.6,.15,z0],[4.6,.15,z1],{g:g,op:1,w:1.4});for(var z=z0+1;z<z1;z+=2)dL(gapF,[2.75,.1,z],[4.95,.1,z],{g:g,op:.6,w:1.1})});
  box(2.9,4.8,0,1.2,GA-1.4,GA-.6,PAP,'buffer');
  box(-3.2,-2.6,0,13,54.7,55.3,PAP,'arch');box(8.6,9.2,0,13,54.7,55.3,PAP,'arch');
  var ab=box(-3.2,9.2,13,15.2,54.6,55.4,INK,'arch');dT(ab.nz,'ENTRY ASSESSMENT',[3,14.1,54.6],1.0,YEL);
  var scanF=Fc([[-2.6,1,55],[-2.6,1.14,55],[8.6,1.14,55],[8.6,1,55]],[0,0,-1],GOLD,'scan');faces.push(scanF);gv('scan').st=GOLD;
  box(-17.6,-17.1,0,3.8,73.8,74.2,PAP,'esign');box(-7.9,-7.4,0,3.8,73.8,74.2,PAP,'esign');
  var eb=box(-19,-6,3.8,6.4,73.7,74.3,INK,'esign');dT(eb.nz,'EDUCATION-READY',[-12.5,5.1,73.7],1.2,YEL);
  box(18,18.6,0,4.2,138.2,138.8,PAP,'esign');box(39.4,40,0,4.2,138.2,138.8,PAP,'esign');
  var ib=box(16,42,4.2,9.4,138,139,INK,'esign');dT(ib.nz,'INDUSTRY-READY',[29,6.8,138],2.3,YEL);
  box(-14,2.2,0,1,GB+2,GB+82,PAP,'cfar');
  box(-1.6,-1,0,8.6,136.7,137.3,PAP,'gate');box(8.7,9.3,0,8.6,136.7,137.3,PAP,'gate');
  var gb=box(-1.6,9.3,7.2,9.2,136.6,137.4,PAP,'gate'),gTx=dT(gb.nz,'ETAF',[3.85,8.2,136.6],1.3,INK);
  [[-5,40],[-3.6,41.6],[-6.4,42.2],[-4.8,43.8]].forEach(function(p){box(p[0]-.38,p[0]+.38,1,2.55,p[1]-.26,p[1]+.26,PAP,'team');box(p[0]-.24,p[0]+.24,2.68,3.16,p[1]-.22,p[1]+.22,PAP,'team')});
  box(-9.4,-8.6,1,2.9,38.7,39.3,PAP,'team');box(-9.25,-8.75,3.02,3.52,38.78,39.22,PAP,'team');
  var EVZ=[-1.8,-10.6,-19.4];
  EVZ.forEach(function(zs,k){var g='evc'+k;gv(g).clip=true;var c=box(2.8,4.9,.6,3.7,zs,zs+8,PAP,g);dZ(c.nz,zs,3.2,4.5,1.5,3.1,PAP);dZ(c.nz,zs,3.2,4.5,2.2,2.4,INK);box(3.2,4.5,.25,.6,zs+1,zs+3,PAP,g);box(3.2,4.5,.25,.6,zs+5,zs+7,PAP,g);box(3.5,4.2,1.2,2.2,zs+8,zs+8.8,INK,g)});

  // build line world
  [[.8,1.4],[6.3,6.9]].forEach(function(x){[9.6,15.8].forEach(function(z){box(x[0],x[1],0,13.2,z,z+.6,PAP,'bgan')})});
  [9.6,15.8].forEach(function(z){box(.6,7.1,12.4,13.4,z-.1,z+.7,INK,'bgan')});
  box(3.2,4.5,11.4,12.4,12.2,13.6,INK,'bgan');
  var cabF=Fc([[3.8,3.6,12.9],[3.8,11.4,12.9],[3.9,11.4,12.9],[3.9,3.6,12.9]],[0,0,-1],INK,'bcab');faces.push(cabF);
  ['fcar','crate','lid','prod'].forEach(function(g){gv(g).clip=true});
  var fc=box(2.7,5.0,.6,1.1,7,19,PAP,'fcar');dX(fc.nx,2.7,.75,.95,7.3,18.7,INK);
  [[1.5,4],[12.5,15]].forEach(function(b){box(3.2,4.5,.25,.6,7+b[0],7+b[1],PAP,'fcar')});
  var cr=box(2.55,5.15,1.1,3.5,9,17,PAP,'crate');
  dL(cr.nz,[2.55,1.45,9],[5.15,1.45,9],{op:.5});dL(cr.nz,[2.55,3.15,9],[5.15,3.15,9],{op:.5});
  for(var z=10.6;z<17;z+=1.6)dL(cr.nx,[2.55,1.1,z],[2.55,3.5,z],{op:.5});
  dT(cr.nz,'YOUR PRODUCT',[3.85,2.6,9],.3,INK);dT(cr.nz,'IDEA',[3.85,2.03,9],.3,INK);
  box(2.45,5.25,3.5,3.75,8.9,17.1,PAP,'lid');
  var pf=box(2.25,5.45,1.1,5.5,10.6,11.2,INK,'prod');
  dZ(pf.nz,10.6,2.4,5.3,1.3,5.35,PAP);dZ(pf.nz,10.6,2.4,5.3,4.95,5.35,INK);dZ(pf.nz,10.6,2.52,2.68,5.07,5.23,YEL);
  [4.55,4.25,3.95,3.65].forEach(function(y,k){dL(pf.nz,[2.55,y,10.6],[k?3.15:3.35,y,10.6],{op:.7,w:1.4})});
  dZ(pf.nz,10.6,3.6,4.3,4.05,4.75,PAP);dZ(pf.nz,10.6,4.45,5.15,4.05,4.75,PAP);dZ(pf.nz,10.6,3.6,5.15,1.5,3.9,PAP);
  var cv=[[3.75,1.8],[4.05,2.3],[4.35,2.1],[4.65,2.9],[5.0,3.5]];for(var k=0;k<4;k++)dL(pf.nz,[cv[k][0],cv[k][1],10.6],[cv[k+1][0],cv[k+1][1],10.6],{op:1,w:2,st:GOLD});
  var BCN=['Product / BA','AI / ML','Data','Full Stack','Cloud','Cyber'];
  BCN.forEach(function(n,k){var g='bc'+k,z0=20+k*7.6;gv(g).clip=true;var c=box(2.7,5.0,.6,4.0,z0,z0+7,PAP,g);dX(c.nx,2.7,1.3,1.55,z0,z0+7,INK);for(var j=0;j<2;j++)dX(c.nx,2.7,2.3,3.3,z0+1+j*3,z0+2.9+j*3,INK);box(3.2,4.5,.25,.6,z0+1,z0+2.6,PAP,g);box(3.2,4.5,.25,.6,z0+4.4,z0+6,PAP,g);box(3.5,4.2,1.2,2.0,z0-.6,z0,INK,g)});
  var SGZ=[80,92,104,116,128,140],SGB:Box[]=[];
  SGZ.forEach(function(z,k){var l=k%2===0,g='bsg'+k,px=l?-1.2:8.5;box(px,px+.4,0,3,z+.05,z+.25,PAP,g);SGB.push(box(l?-2.8:6.9,l?.4:10.1,3,4.1,z,z+.3,PAP,g))});
  var dk=box(5.5,17,0,1,300,346,PAP,'bdock');for(var z=304;z<346;z+=4)dL(dk.py,[5.5,1,z],[17,1,z]);dL(dk.py,[5.85,1,300],[5.85,1,346]);
  box(7,7.5,1,4.6,342,342.5,PAP,'bdock');box(15,15.5,1,4.6,342,342.5,PAP,'bdock');
  var yb=box(5.6,16.9,4.6,8,341.8,342.6,INK,'bdock');dT(yb.nz,'DEPLOYMENT DOCK',[11.25,7.2,341.8],.65,PAP);dT(yb.nz,'YOUR COMPANY',[11.25,5.8,341.8],1.1,YEL);
  var BPT:number[][]=[];for(var k=0;k<6;k++){var xt=7+k*1.6,zt=306+k*4.4,g='bp'+k;BPT.push([xt,zt]);box(xt-.38,xt+.38,1,2.55,zt-.26,zt+.26,PAP,g);box(xt-.24,xt+.24,2.68,3.16,zt-.22,zt+.22,PAP,g)}
  cg='base';
  // workforce line world
  var wgF=Fc([[-300,.03,1],[-300,.03,560],[300,.03,560],[300,.03,1]],[0,1,0],'none','wgnd');wgF.bg=true;faces.push(wgF);gv('wgnd').st='none';
  function wRails(Pp:V3[],o:RailOpts){o=o||{};var ks:Kid[]=[];for(var i=0;i<Pp.length-1;i++){var a=Pp[i],b=Pp[i+1],ox=b[2]-a[2],oz=-(b[0]-a[0]),L=Math.hypot(ox,oz)||1;ox*=.75/L;oz*=.75/L;
    [1,-1].forEach(function(s){var A=[a[0]+ox*s,a[1],a[2]+oz*s],B=[b[0]+ox*s,b[1],b[2]+oz*s],k=dL(wgF,A,o.grow?A.slice():B,{g:o.g,op:1,w:o.w||1.5,dash:o.dash,st:o.st});k.A=A;k.B=B;ks.push(k)})}return ks}
  function bez(a:number[],c:number[],b:number[],n:number){var o:V3[]=[];for(var i=0;i<=n;i++){var u=i/n,v=1-u;o.push([v*v*a[0]+2*u*v*c[0]+u*u*b[0],0,v*v*a[1]+2*u*v*c[1]+u*u*b[1]])}return o}
  var WJ=[3.85,50],WBR=[[[-30,92],[-102,170],[-102,326]],[[-8,95],[-50,200],[-50,352]],[[16,95],[20,200],[20,300]],[[40,92],[60,120],[60,140]]];
  WBR.forEach(function(B){wRails(bez(WJ,[3.85,72],B[0],10).concat(bez(B[0],B[1],B[2],14).slice(1)),{dash:'8 7'})});
  var SKY:V3[]=[];for(var i=0;i<=26;i++){var u=i/26;SKY.push([60+80*u,75*u*u*(3-2*u),140+290*u])}wRails(SKY,{dash:'8 7'});
  for(var i=1;i<26;i++){var p=SKY[i];dL(wgF,[p[0]-1.1,p[1],p[2]],[p[0]+1.1,p[1],p[2]],{op:.5})}
  WBR.forEach(function(B){var x=B[0][0],z=B[0][1];box(x+2.8,x+3.2,0,4.6,z,z+.4,PAP,'wsg');box(x-2.6,x+3.4,3.0,4.6,z-.1,z+.3,INK,'wsg')});
  var of=box(-96,-80,0,14,330,346,PAP,'woff');for(var y=2.6;y<13;y+=2.6)for(var x=-94.6;x<-81;x+=3)dZ(of.nz,330,x,x+1.8,y,y+1.4,PAP);dZ(of.nz,330,-89.6,-86.4,0,2,INK);
  for(var k=0;k<5;k++){var px=-97.5+2.6*k,rg:V3[]=[];box(px-.38,px+.38,0,1.55,319.74,320.26,PAP,'wpp');box(px-.24,px+.24,1.68,2.16,319.78,320.22,PAP,'wpp');
    for(var j=0;j<20;j++){var an=j/20*2*Math.PI;rg.push([px+Math.cos(an)*.85,3.2,320+Math.sin(an)*.85])}faces.push(Fc(rg,[0,1,0],'none','wr'+k))}
  var cp=box(-46,-24,0,9,360,378,PAP,'wcam');for(var x=-44.5;x<-25;x+=3)dZ(cp.nz,360,x,x+2,1.6,4.2,PAP);dZ(cp.nz,360,-40,-30,5.4,7.8,INK);dT(cp.nz,'AI LAB',[-35,6.6,360],1.1,YEL);box(-44,-38,9,11,363,370,PAP,'wcam');
  box(-43,-37,0,1.1,350,352,PAP,'wcam');box(-42.4,-41.4,1.1,1.55,350.6,351.4,INK,'wcam');box(-38.6,-37.6,1.1,1.55,350.6,351.4,INK,'wcam');
  [[-44.2,351],[-35.8,351],[-41.4,353.6],[-38.6,353.6]].forEach(function(p){box(p[0]-.38,p[0]+.38,0,1.55,p[1]-.26,p[1]+.26,PAP,'wcam');box(p[0]-.24,p[0]+.24,1.68,2.16,p[1]-.22,p[1]+.22,PAP,'wcam')});
  var WLK=wRails([[-22.5,.15,358],[3.85,.15,413]],{g:'wlink',dash:'7 6',w:1.8,grow:1});
  var gvb=box(70,92,0,7,350,366,PAP,'wgov');for(var x=71.6;x<91;x+=2.8)dZ(gvb.nz,350,x,x+.8,0,6,INK);box(76,86,7,10,353,363,PAP,'wgov');
  var WRL=[[-80,338],[-24,369],[70,358]].map(function(e,k){return wRails([[3.85,.15,414],[e[0],.15,e[1]]],{g:'wrl'+k,st:GOLD,w:2.2,grow:1})});
  var GC=[140,120,470],GRr=48,gRot=0,GD:V3[]|null=null;
  function llv(la:number,lo:number):V3{la*=Math.PI/180;lo*=Math.PI/180;return[Math.cos(la)*Math.cos(lo),Math.sin(la),-Math.cos(la)*Math.sin(lo)]}
  function globeSVG(C:(p:V3)=>V3,pr:(q:V3)=>string,a:number,cam:V3){var q0=C(GC);if(q0[2]<NEAR+GRr)return'';var rr=FX*GRr/q0[2],sx=800+FX*q0[0]/q0[2],sy=CY-FX*q0[1]/q0[2],cs=Math.cos(gRot),sn=Math.sin(gRot);
    var vp=function(u:V3){u=[u[0]*cs+u[2]*sn,u[1],-u[0]*sn+u[2]*cs];var p=[GC[0]+u[0]*GRr,GC[1]+u[1]*GRr,GC[2]+u[2]*GRr];if(u[0]*(cam[0]-p[0])+u[1]*(cam[1]-p[1])+u[2]*(cam[2]-p[2])<=0)return null;var q=C(p);return q[2]>NEAR?pr(q):null};
    var d='',run=function(f:(u:number)=>V3,n:number){var on=false;for(var j=0;j<=n;j++){var s=vp(f(j/n));if(s){d+=(on?'L':'M')+s;on=true}else on=false}};
    for(var la=-75;la<=75;la+=15)run(function(u){return llv(la,u*360)},64);
    for(var lo=0;lo<180;lo+=15)run(function(u){var t=u*2*Math.PI,c=Math.cos(t),l=lo*Math.PI/180;return[c*Math.cos(l),Math.sin(t),-c*Math.sin(l)]},64);
    if(!GD){GD=[];var bb=atob(LANDMASK),ix=0;for(var la2=-84;la2<=84.01;la2+=2.4){var nn=Math.max(1,Math.round(150*Math.cos(la2*Math.PI/180)));for(var i=0;i<nn;i++){if((bb.charCodeAt(ix>>3)>>(ix&7))&1)GD.push(llv(la2,-180+(i+.5)*360/nn));ix++}}}
    var dd='';(GD||[]).forEach(function(u){var s=vp(u);if(s)dd+='M'+s+'h0'});
    return'<g opacity="'+a.toFixed(3)+'"><circle cx="'+sx.toFixed(1)+'" cy="'+sy.toFixed(1)+'" r="'+rr.toFixed(1)+'" fill="'+PAP+'" stroke="'+INK+'" stroke-width="1.6"/><path d="'+d+'" stroke="'+INK+'" stroke-opacity=".3" stroke-width="1" fill="none"/><path d="'+dd+'" stroke="'+INK+'" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>'}
  cg='base';

  function clipBy(ps:V3[],f:(p:V3)=>number){var o:V3[]=[],n=ps.length;for(var i=0;i<n;i++){var a=ps[i],b=ps[(i+1)%n],fa=f(a),fb=f(b);if(fa>=0)o.push(a);if((fa>=0)!==(fb>=0)){var u=fa/(fa-fb);o.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u])}}return o}
  function lp(a:V3,b:V3,u:number):V3{return[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]}
  function seg(a:V3,b:V3,f:(p:V3)=>number):V3[]|null{var fa=f(a),fb=f(b);if(fa<0&&fb<0)return null;if(fa<0)a=lp(a,b,fa/(fa-fb));else if(fb<0)b=lp(b,a,fb/(fb-fa));return[a,b]}
  var fz=function(p:V3){return p[2]-NEAR},fw=function(p:V3){return ZMAX-p[2]};
  function render(P:Pose){CY=P.cy;var pa=P.pitch||0,ca=Math.cos(pa),sa=Math.sin(pa),hy=Math.abs(pa)<1.2?CY-FX*Math.tan(pa):-9999;
    var cx=P.c[0],cy=P.c[1],cz=P.c[2],o=['<rect x="-400" y="-400" width="2400" height="1700" fill="'+PAP+'"/><line x1="-400" y1="'+hy.toFixed(1)+'" x2="2000" y2="'+hy.toFixed(1)+'" stroke="'+INK+'" stroke-opacity=".3" stroke-width="1.2"/>'];
    var W=function(p:V3,g:string){var G=gv(g),d=G.dz,x=G.dx||0,y=G.dy||0;return d||x||y?[p[0]+x,p[1]+y,p[2]+d]:p},C=function(p:V3){var x=p[0]-cx,y=p[1]-cy,z=p[2]-cz;return pa?[x,y*ca+z*sa,-y*sa+z*ca]:[x,y,z]};
    var pr=function(q:V3){return(800+FX*q[0]/q[2]).toFixed(1)+' '+(CY-FX*q[1]/q[2]).toFixed(1)};
    var poly=function(ps:V3[],g:string){ps=ps.map(function(p){return W(p,g)});if(gv(g).clip)ps=clipBy(ps,fw);if(ps.length<3)return null;ps=clipBy(ps.map(C),fz);return ps.length>=3?ps:null};
    var sg=function(a:V3,b:V3,g:string){a=W(a,g);b=W(b,g);if(gv(g).clip){var s0=seg(a,b,fw);if(!s0)return null;a=s0[0];b=s0[1]}return seg(C(a),C(b),fz)};
    var op=function(v:number){return v<.995?' opacity="'+v.toFixed(3)+'"':''};
    lines.forEach(function(l){var G=gv(l.g);if(G.o<.01)return;var s=seg(C(l.a),C(l.b),fz);if(s)o.push('<path d="M'+pr(s[0])+'L'+pr(s[1])+'" stroke="'+INK+'" stroke-opacity="'+(l.op*G.o).toFixed(3)+'" stroke-width="1.2" fill="none"/>')});
    var vis:{k:number;f:Face;ps:V3[]}[]=[];faces.forEach(function(f){var G=gv(f.g);if(G.o<.01)return;var p0=W(f.pts[0],f.g),n=f.n;if(n[0]*(cx-p0[0])+n[1]*(cy-p0[1])+n[2]*(cz-p0[2])<=0)return;var ps=poly(f.pts,f.g);if(!ps)return;var k=0;ps.forEach(function(q){k+=q[2]});vis.push({k:f.bg?1e9:k/ps.length,f:f,ps:ps})});
    vis.sort(function(a,b){return b.k-a.k});
    vis.forEach(function(v){var f=v.f,G=gv(f.g);o.push('<path d="M'+v.ps.map(pr).join('L')+'Z" fill="'+f.fill+'" stroke="'+(G.st||INK)+'" stroke-width="'+(G.w||1.5)+'" stroke-linejoin="round"'+op(G.o)+'/>');
      f.kids.forEach(function(d){var K=d.g?gv(d.g):null,a=G.o*(K?K.o:1);if(a<.01)return;
        if(d.ln){var s=sg(d.pts[0],d.pts[1],f.g);if(s)o.push('<path d="M'+pr(s[0])+'L'+pr(s[1])+'" stroke="'+((K&&K.st)||d.st||INK)+'" stroke-opacity="'+((d.op!=null?d.op:.55)*a).toFixed(3)+'" stroke-width="'+((K&&K.w)||d.w||1.1)+'"'+(d.dash?' stroke-dasharray="'+d.dash+'"':'')+' fill="none"/>');return}
        if(d.tx){var q=C(W(d.p!,f.g));if(q[2]<NEAR)return;var fs=FX*d.s!/q[2];if(fs<2.5)return;o.push('<text x="'+(800+FX*q[0]/q[2]).toFixed(1)+'" y="'+(CY-FX*q[1]/q[2]).toFixed(1)+'" font-family="Manrope,sans-serif" font-weight="800" font-size="'+fs.toFixed(1)+'" letter-spacing="'+(fs*.04).toFixed(2)+'" fill="'+d.fill+'" text-anchor="middle" dominant-baseline="central"'+op(a)+'>'+d.tx+'</text>');return}
        var ps=poly(d.pts,f.g);if(ps)o.push('<path d="M'+ps.map(pr).join('L')+'Z" fill="'+d.fill+'" stroke="'+((K&&K.st)||INK)+'" stroke-width="1.2" stroke-linejoin="round"'+op(a)+'/>')})});
    if(gv('wglobe').o>.01)o.push(globeSVG(C,pr,gv('wglobe').o,P.c));
    svg.innerHTML=o.join('');
  }
  // HTML labels pinned to the scene
  var pinsEl=document.createElement('div');pinsEl.id='crPins';pinsEl.setAttribute('aria-hidden','true');stn.insertBefore(pinsEl,document.getElementById('crCards'));
  var cardsEl=document.getElementById('crCards') as HTMLElement;
  function pin(html:string,p:V3,g:string,mv?:string,ax?:string,cls?:string,parent?:HTMLElement,tag?:string){var e=document.createElement(tag||'div');e.className='crPin'+(cls?' '+cls:'');e.innerHTML=html;(parent||pinsEl).appendChild(e);var Q:Pin={el:e,p:p,g:g,m:mv||'base',ax:ax||'c',o:-1,card:parent===cardsEl};PINS.push(Q);return Q}
  TN.forEach(function(d){pin('<b>'+d[0]+'</b><span>Recommended after assessment</span>',[d[1],1,GB+1],'tlab')});
  SEC.forEach(function(n,k){var l=k%2===0;pin(n,[l?1.6:6.1,.2,GA+k*10+5],'slab'+k,'base',l?'l':'r')});
  ['Assessments','Project work','Reviewed delivery'].forEach(function(n,k){pin(n,[3.85,4.3,EVZ[k]+4],'elab'+k,'evc'+k)});
  [['Career Launch','Build your foundation. Become job-ready.'],['Career Pro','Specialise in a role. Build real-world capability.'],['Career Accelerate','Gain industry experience. Accelerate your career.']].forEach(function(c,k){
    pin((k===1?'<em class="tag">Recommended for you</em>':'')+'<h3>'+c[0]+'</h3><p>'+c[1]+'</p>',[TN[k][1],0,GB],'card','base','c','crCard'+(k===1?' rec':''),cardsEl)});
  BCN.forEach(function(n,k){var l=k%2===0;pin('<b>'+n+'</b>',[l?2.5:5.2,3.2,20+k*7.6+3.5],'blab'+k,'bc'+k,l?'l':'r')});
  var SGP=SGZ.map(function(z,k){var l=k%2===0;return pin('<i></i>'+SEC[k],[l?-2.8:10.1,3.55,z],'bsl'+k,'base',l?'l':'r','bSg')});
  pin('Demo &amp; Validate',[3.85,5.5,10.6],'bbadge','prod','c','bBadge');
  BPT.forEach(function(p,k){pin('✓',[p[0],3.3,p[1]],'bvt'+k,'bp'+k,'c','bTick')});
  var wsgEl=document.getElementById('wfSg') as HTMLElement;
  ['Your team','Your students','Your region','Everyone'].forEach(function(n,k){var B=WBR[k][0],Q=pin(n+'<span aria-hidden="true">→</span>',[B[0]+.4,3.8,B[1]-.1],'wsgl','base','m','wSg',wsgEl,'button');(Q.el as HTMLButtonElement).type='button';Q.el.tabIndex=-1;Q.el.addEventListener('click',function(){travel(k+1)})});
  ([['AI Talent Factory',[0,38,440]],['Industry',[-88,14,338]],['Campus',[-35,11,369]],['Government',[81,10,358]]] as [string,V3][]).forEach(function(d){pin('<b>'+d[0]+'</b>',d[1],'wnl')});
  var pass=document.getElementById('crPass') as HTMLElement,passRows:(HTMLElement&{_on?:boolean})[]=[].slice.call(pass.querySelectorAll('li')),crT=document.getElementById('crTxt') as HTMLElement,crH=crT.querySelector('.crH') as HTMLElement,crP=crT.querySelector('.crP') as HTMLElement,crB=crT.querySelector('.crB') as HTMLElement;
  var sm=function(a:number,b:number,x:number){var u=Math.min(1,Math.max(0,(x-a)/(b-a)));return u*u*(3-2*u)};
  var eio=function(u:number){return u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2};
  var CAREER:Stop[]=[
    {n:'The gap',h:'Learning is not getting hired.',p:'Degrees and certificates show what you studied. Employers want to see what you can do.'},
    {n:'Start where you are',h:'Start where you are',p:'A short assessment finds your starting point.',b:[['Take the Entry Assessment','assess','pri']]},
    {n:'Your track',h:'Your track',p:''},
    {n:'Build in a POD',h:'Build in a POD',p:'A small team builds a real product for an industry problem. A mentor guides. You own the work.'},
    {n:'Verified',h:'Verified',p:'ETAF™, our readiness framework, checks your assessments, project work and reviewed delivery. What passes goes into your Readiness Passport: a verified record of what you can do that travels with you.'},
    {n:'Industry-ready',h:'Industry-ready',p:'Arrive with a portfolio, verified readiness and support toward the right role.',b:[['Take the Entry Assessment','assess','pri'],['Explore the Factory','factory','sec']]}];
  var BUILD:Stop[]=[
    {n:'Bring us a problem',h:'Bring us a problem',p:'Have a product to build or a problem to solve? Bring it to the Factory.',b:[['Bring Us a Problem','form','pri']]},
    {n:'Your POD assembles',h:'Your POD assembles',p:'A cross-functional team forms around your problem, guided by industry architects.'},
    {n:'Six stages',h:'Six stages',p:'The same POD lifecycle as the Career Line. One Factory, one way of building.'},
    {n:'Your product',h:'Your product',p:'A working product, prototype or solution, built and tested by your POD.'},
    {n:'Keep the team',h:'Keep the team',p:'The people who built your product are verified and ready to keep working with you. Hire proven capability, not CVs. That is Talent as a Service.',b:[['Bring Us a Problem','form','pri'],['Talk to Us About the Team','form','sec']]}];
  var WORK:Stop[]=[
    {n:'Junction',h:'Junction',p:'Who are you upskilling? One line, four branches.'},
    {n:'Your team',h:'Your team',p:'Upgrade the team you already have. From broad AI fluency to deep technical skills. Corporate Academies · L&D as a Service.',b:[['Assess My Workforce','wf2','pri']]},
    {n:'Your students',h:'Your students',p:'Bring the Factory to your campus. AI Centre of Excellence · Faculty development · Student PODs on real industry problems.',b:[['Build a Campus Talent Factory','wf3','pri']]},
    {n:'Your region',h:'Your region',p:'Connect a whole region. Universities, industry and verified talent, linked by POD networks and regional hubs.',b:[['Design a Sector Talent Program','wf4','pri']]},
    {n:'Everyone',h:'Everyone',p:'Not everyone needs to be an engineer. Everyone needs AI. Explore by profession.',b:[['Explore AI for Your Profession','globe','pri']]}];
  var LN:Record<string,RideLine>={career:{name:'Career Line',cat:'Students and professionals',custom:true,st:CAREER},
    build:{name:'Build Line',cat:'Startups and companies',custom:true,st:BUILD},
    workforce:{name:'Workforce Line',cat:'Governments, universities, organisations',custom:true,st:WORK}};
  var BP:Pose={c:[0,2.6,0],cy:430,dz:0},RP=function(i:number):Pose{return{c:[3.85,7.5,SZ[i]-22],cy:330,dz:SZ[i]-7}};
  var CP:Pose[]=[{c:[3.85,16,-15],cy:250,dz:0},{c:[3.85,22,-5],cy:205,dz:10},{c:[3.85,22,-5],cy:205,dz:10},{c:[3.85,24,-9],cy:190,dz:10},{c:[3.85,11,24.6],cy:300,dz:68},{c:[3.85,8,376],cy:330,dz:484}];
  var BPZ:Pose[]=[{c:[3.85,12,-16],cy:300,dz:0},{c:[3.85,16,24],cy:290,dz:40},{c:[3.85,20,46],cy:280,dz:127},{c:[3.85,6.8,196],cy:330,dz:200},{c:[9,9.5,283],cy:300,dz:285}],BS=60,BE=127;
  var WPZ:Pose[]=[{c:[3.85,12,18],cy:300,dz:0},{c:[-98,10,290],cy:330,dz:0},{c:[-46,11,316],cy:330,dz:0},{c:[-70,250,428],cy:450,dz:0,pitch:Math.PI/2},{c:[62,34,150],cy:470,dz:0}],linkU=0;
  var poseFor=function(i:number):Pose{return line&&line.custom?(line===LN.build?BPZ[i]:line===LN.workforce?WPZ[i]:CP[i]):RP(i)};
  var pose=BP,anim:Anim|null=null,rmode='board',line:RideLine|null=null,at=0,hintOn=false,cd:HTMLElement|null=null,cdHome:[Node,Node|null]|null=null,arrT=0,laid=false,coupled=false,gateLit=false,passOn=false,dirty=true,lastT=0,lowered=false,coupledB=false,openedB=false,openT=0,dwell=false;
  var bUI:HTMLElement[]=[].slice.call(stn.querySelectorAll('.stUI')),rUI:HTMLElement[]=[].slice.call(stn.querySelectorAll('.rUI')),ride=document.getElementById('stRide') as HTMLElement,hint=document.getElementById('stHint') as HTMLElement,map=document.getElementById('stMap') as HTMLElement,dotsEl=map.querySelector('.mDots') as HTMLElement,lbl=map.querySelector('.mLbl') as HTMLElement;
  function draw(p:Pose){render(p)}
  function mix(a:Pose,b:Pose,u:number):Pose{var p0=a.pitch||0;return{c:[a.c[0]+(b.c[0]-a.c[0])*u,a.c[1]+(b.c[1]-a.c[1])*u,a.c[2]+(b.c[2]-a.c[2])*u],cy:a.cy+(b.cy-a.cy)*u,dz:a.dz+(b.dz-a.dz)*u,pitch:p0+((b.pitch||0)-p0)*u}}
  function setV(els:HTMLElement[],v:number){els.forEach(function(e){e.style.opacity=String(v);e.style.visibility=v>0?'visible':'hidden'})}
  function go(to:Pose,dur:number,done?:()=>void):Anim{return anim={from:pose,to:to,t0:performance.now(),dur:reduce?0:dur,done:done}}
  function sceneUpdate(now:number,dt:number,snap?:boolean){
    var c=!!(line&&line===LN.career),b=!!(line&&line===LN.build),mv=!!anim,i=c?at:-1,st=c&&!mv&&rmode==='ride',lt=st?(reduce?99:(now-arrT)/1000):0,busy=false,k:number,G:Grp;
    var bi=b?at:-1,bst=b&&!mv&&rmode==='ride',blt=bst?(reduce?99:(now-arrT)/1000):0;
    var w=!!(line&&line===LN.workforce),wi=w?at:-1,wst=w&&!mv&&rmode==='ride',wlt=wst?(reduce?99:(now-arrT)/1000):0;
    var dsh=c&&(i===1||i===2)?1:0;
    var T:Record<string,number>={train:(b||w)?0:1,plats:(c||b||w)?0:1,railGap:(c||w)?0:1,trunk:w?0:1,gap:c?1:0,cfar:c?1:0,gate:c?1:0,esign:c?1:0,arch:c&&i<2?1:0,buffer:c&&i<3?1:0,scan:st&&i===1?1:0,
      dashL:dsh,dashC:dsh,dashR:dsh,tlab:0,card:st&&i===2?1:0,team:c&&i===3?1:0,door:c&&i===5?1:0};
    if(st&&i<3)laid=false;if(st&&i===3&&lt>.3+6*.55)laid=true;
    for(k=0;k<6;k++){var t0=.3+k*.55,on=0,now_=false;if(c&&i>3)on=1;else if(c&&i===3){if(laid)on=1;else if(lt>=t0){on=1;now_=lt<t0+.55}}
      T['sec'+k]=on;T['slab'+k]=st&&i===3&&on?1:0;G=gv('sec'+k);var ns=now_?GOLD:null;if(G.st!==ns){G.st=ns;G.w=now_?2.6:0;busy=true}}
    if(st&&i<4)coupled=false;if(st&&i===4&&lt>2.05)coupled=true;
    for(k=0;k<3;k++){var off=-60;if(c&&i>=4){if(coupled||i>4)off=0;else{var u=Math.min(1,Math.max(0,(lt-.3-k*.35)/1));off=-60*Math.pow(1-u,3)}}
      T['evc'+k]=c&&i>=4?1:0;T['elab'+k]=st&&i===4&&off>-1?1:0;G=gv('evc'+k);var nd=pose.dz+off;if(G.dz!==nd){G.dz=nd;busy=true}}
    G=gv('train');if(G.dz!==pose.dz){G.dz=pose.dz;busy=true}
    G=gv('dashC');var dcs=c&&i===2?GOLD:null;if(G.st!==dcs){G.st=dcs;G.w=dcs?2.8:0;busy=true}
    var lit=c&&(i===5||(i===4&&coupled));if(lit!==gateLit){gateLit=lit;G=gv('gate');G.st=lit?GOLD:null;G.w=lit?2.4:0;[gb.nx,gb.px,gb.py,gb.nz].forEach(function(f){f.fill=lit?INK:PAP});gTx.fill=lit?YEL:INK;busy=true}
    if(T.scan||gv('scan').o>.01){var y=.7+11*(.5+.5*Math.sin(lt*2.2-1.57));scanF.pts.forEach(function(p,j){p[1]=y+(j===1||j===2?.14:0)});busy=true}
    var po=st&&i===4&&lt>1.6;if(po!==passOn){passOn=po;pass.classList.toggle('on',po)}
    passRows.forEach(function(r,j){var on=st&&i===4&&lt>2.1+j*.3;if(r._on!==on){r._on=on;r.classList.toggle('on',on)}});
    if((st&&i===4&&lt<3.4)||(st&&i===3&&!laid))busy=true;
    if(bst&&bi===2&&dwell){var du=Math.min(1,blt/4.6);pose={c:pose.c,cy:pose.cy,dz:BS+(BE-BS)*eio(du)};if(du>=1)dwell=false;busy=true}
    var fdz=pose.dz,mvG=function(g:string,dz:number,dy?:number,dx?:number){var Q=gv(g);dy=dy||0;dx=dx||0;if(Q.dz!==dz||(Q.dy||0)!==dy||(Q.dx||0)!==dx){Q.dz=dz;Q.dy=dy;Q.dx=dx;busy=true}};
    T.fcar=b?1:0;T.bgan=b&&bi<=0?1:0;
    if(bst&&bi===0&&!lowered&&blt>2.4)lowered=true;
    var lowU=lowered||bi>0?1:(bst&&bi===0?sm(.4,2.4,blt):0),dyC=7*(1-lowU);
    T.bcab=b&&bi===0&&!lowered?1:0;
    if(T.bcab||gv('bcab').o>.01)cabF.pts.forEach(function(p,j){p[1]=j===1||j===2?11.4:3.75+dyC});
    if(bst&&bi<3)openedB=false;if(!openedB&&b&&(bi>3||(bst&&bi===3&&blt>.5))){openedB=true;openT=bi>3?-1e9:now}
    var oU=openedB?(reduce?1:Math.min(1,(now-openT)/1300)):0;
    T.crate=b?1-sm(.15,.7,oU):0;T.lid=b?1-sm(0,.5,oU):0;T.prod=b&&bi>=3?sm(.3,.75,oU):0;T.bbadge=bst&&bi===3&&oU>=1?1:0;
    mvG('fcar',fdz);mvG('crate',fdz,dyC);mvG('lid',fdz,dyC+2.6*sm(0,.6,oU));mvG('prod',fdz,-2.4*(1-sm(.25,1,oU)));
    if(bst&&bi<1)coupledB=false;if(bst&&bi===1&&blt>3.1)coupledB=true;
    for(k=0;k<6;k++){var bo=70;if(b&&bi>=1){if(coupledB||bi>1)bo=0;else{var bu=Math.min(1,Math.max(0,(blt-.3-k*.3)/1.2));bo=70*Math.pow(1-bu,3)}}
      T['bc'+k]=b&&bi>=1?1:0;T['blab'+k]=bst&&bi===1&&bo<1?1:0;mvG('bc'+k,fdz+bo)}
    var cz=13+fdz,cur=-1;for(k=0;k<6;k++)if(b&&cz>=SGZ[k]-3)cur=k;
    for(k=0;k<6;k++){var on2=b&&bi===2?1:0;T['bsg'+k]=on2;T['bsl'+k]=on2;var stt=k===cur?'cur':k<cur?'done':'',SP=SGP[k];
      if(SP._s!==stt){SP._s=stt;SP.el.classList.toggle('cur',stt==='cur');SP.el.classList.toggle('done',stt==='done');var fl=stt==='cur'?GOLD:stt==='done'?INK:PAP,SB=SGB[k];[SB.nx,SB.px,SB.py,SB.nz].forEach(function(f){f.fill=fl});busy=true}}
    T.bdock=b&&bi>=3?1:0;
    for(k=0;k<6;k++){var pu=bst&&bi===4?sm(0,1,(blt-.5-k*.28)/.9):0,BT=BPT[k];
      T['bp'+k]=pu>0?1:0;T['bvt'+k]=pu>=1?1:0;mvG('bp'+k,(23.5+7.6*k+fdz-BT[1])*(1-pu),-.4*(1-pu),(4.4-BT[0])*(1-pu))}
    T.wgnd=w?1:0;T.wsg=w?1:0;T.wsgl=wst&&wi===0?1:0;T.woff=w?1:0;T.wpp=w?1:0;T.wcam=w?1:0;T.wgov=w?1:0;T.wnl=wst&&wi===3?1:0;T.wglobe=wst&&wi===4?1:0;
    [].forEach.call(wsgEl.children,function(e:HTMLElement){var ti=T.wsgl?0:-1;if(e.tabIndex!==ti)e.tabIndex=ti});
    for(k=0;k<5;k++){T['wr'+k]=w&&wi===1?1:0;var rl=wst&&wi===1&&wlt>.5+k*.35;G=gv('wr'+k);var rs=rl?GOLD:null;if(G.st!==rs){G.st=rs;G.w=rl?3:1.3;busy=true}}
    if(wst&&wi<2)linkU=0;if(w&&wi>2)linkU=1;else if(wst&&wi===2)linkU=Math.max(linkU,sm(.4,2.4,wlt));T.wlink=w&&wi>=2?1:0;
    var grow=function(ks:Kid[],u:number){ks.forEach(function(q){var nb=lp(q.A!,q.B!,u);if(q.pts[1][0]!==nb[0]||q.pts[1][2]!==nb[2]){q.pts[1]=nb;busy=true}})};grow(WLK,linkU);
    for(k=0;k<3;k++){T['wrl'+k]=w&&wi>=3?1:0;grow(WRL[k],w&&wi>3?1:(wst&&wi===3?sm(.3+.45*k,1.3+.45*k,wlt):0))}
    if(gv('wglobe').o>.01){gRot+=dt*.15;busy=true}
    if(wst&&((wi===1&&wlt<2.5)||(wi===2&&wlt<2.6)||(wi===3&&wlt<2.6)))busy=true;
    if(bst&&((bi===0&&!lowered)||(bi===1&&!coupledB)||(bi===3&&oU<1)||(bi===4&&blt<3.6)))busy=true;
    for(var g in T){G=gv(g);var tv=T[g];if(G.o===tv)continue;if(snap||reduce)G.o=tv;else{var nv=G.o+(tv-G.o)*Math.min(1,dt*5);if(Math.abs(nv-tv)<.004)nv=tv;G.o=nv}busy=true}
    return busy}
  function pinsUpd(){var Wd=innerWidth,Ht=innerHeight,s=Math.max(Wd/1600,Ht/900),ox=(Wd-1600*s)/2,oy=(Ht-900*s)/2,ph=Wd<700;cardsEl.classList.toggle('col',ph);
    PINS.forEach(function(Q){var o=gv(Q.g).o;if(o<.02){if(Q.o!==0){Q.o=0;Q.el.style.opacity='0';Q.el.style.visibility='hidden'}return}
      if(Q.card&&ph)Q.el.style.transform='none';
      else{var M=gv(Q.m),q=[Q.p[0]+(M.dx||0)-pose.c[0],Q.p[1]+(M.dy||0)-pose.c[1],Q.p[2]+M.dz-pose.c[2]],pa=pose.pitch||0;if(pa)q=[q[0],q[1]*Math.cos(pa)+q[2]*Math.sin(pa),-q[1]*Math.sin(pa)+q[2]*Math.cos(pa)];if(q[2]<NEAR){Q.o=0;Q.el.style.visibility='hidden';return}
        var x=(800+FX*q[0]/q[2])*s+ox,y=(CY-FX*q[1]/q[2])*s+oy,tr=Q.ax==='m'?'translate(-50%,-50%)':Q.ax==='l'?'translate(calc(-100% - 10px),-50%)':Q.ax==='r'?'translate(10px,-50%)':Q.card?'translate(-50%,calc(-100% - 16px))':'translate(-50%,calc(-100% - 6px))';
        Q.el.style.position='absolute';Q.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) '+tr}
      Q.el.style.visibility='visible';Q.el.style.opacity=o.toFixed(3);Q.o=o})}
  function loop(now:number){requestAnimationFrame(loop);if(stn.hidden)return;var dt=Math.min(.1,(now-(lastT||now))/1000);lastT=now;
    if(anim){var A=anim,u=A.dur?Math.min(1,(now-A.t0)/A.dur):1;pose=mix(A.from,A.to,eio(u));if(A.tick)A.tick(u);dirty=true;if(u>=1){anim=null;arrT=now;A.done&&A.done()}}
    if(sceneUpdate(now,dt))dirty=true;
    if(dirty){dirty=false;draw(pose);pinsUpd()}}
  sceneUpdate(0,0,true);draw(BP);requestAnimationFrame(loop);
  window.__stFrame=function(u){pose=mix(BP,RP(0),u);dirty=true};
  addEventListener('resize',function(){dirty=true});
  function openIn(r:string,i:number){if(!window.__openStop)return;cd=document.getElementById('cDrawer');if(cd&&!cdHome){cdHome=[cd.parentNode as Node,cd.nextSibling];stn.appendChild(cd)}window.__setCat&&window.__setCat(line?line.cat:'');window.__openStop(r,i)}
  function openForm(t:string,gi?:number){if(gi?!window.__goForm:!window.__wform)return;cd=document.getElementById('cDrawer');if(cd&&!cdHome){cdHome=[cd.parentNode as Node,cd.nextSibling];stn.appendChild(cd)}if(gi)window.__goForm!(gi,t);else window.__wform!(t)}
  function sign(show:boolean){if(window.__guide){if(show&&line)window.__guide.stop(line===LN.career?'career':line===LN.build?'build':'workforce',at);else if(!show)window.__guide.hush()}
    if(!show){ride.style.transition='opacity .25s ease';ride.style.opacity='0';ride.classList.remove('on');(ride.querySelector('.sAct') as HTMLElement).tabIndex=-1;crT.classList.remove('on');[].forEach.call(crB.children,function(b:HTMLElement){b.tabIndex=-1});return}
    if(line!.custom){var c=line!.st[at] as Stop;crH.textContent=c.h;crP.textContent=c.p||'';crB.innerHTML='';
      (c.b||[]).forEach(function(b){var e=document.createElement('button');e.type='button';e.className=b[2];e.textContent=b[0];e.onclick=function(){if(b[1]==='factory')intoFactory();else if(b[1]==='form')openForm(b[0]);else if(b[1]==='globe')intoGlobe();else if(b[1].slice(0,2)==='wf')openForm(b[0],+b[1][2]);else openIn('career',1)};crB.appendChild(e)});
      crT.classList.add('on');return}
    var s=line!.st[at] as StopRef,D=window.__stopC&&window.__stopC(),d:StopCopy|undefined=D&&D[s[0]]&&D[s[0]][s[1]];if(!d)return;
    ride.querySelector('.sCat')!.textContent=line!.cat;ride.querySelector('.sTtl')!.textContent=d[0];ride.querySelector('.sPar')!.textContent=d[1];
    [].forEach.call(ride.querySelectorAll('.sChips li'),function(li:Element,k:number){li.textContent=d![2][k]||''});ride.querySelector('.sAct b')!.textContent=d[3];
    ride.style.visibility='visible';ride.style.transition='opacity .45s ease .05s';ride.style.opacity='1';ride.classList.add('on');(ride.querySelector('.sAct') as HTMLElement).tabIndex=0}
  function mapUI(){[].forEach.call(dotsEl.children,function(li:Element,k:number){var b=li.firstChild as Element;if(k===at)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});lbl.textContent=line!.name+' · '+(at+1)+' of '+line!.st.length;
    if(hintOn&&at>=1){hintOn=false;try{localStorage.setItem('empowered-ride-hint','1')}catch(e){}}hint.style.opacity=hintOn?'1':'0';hint.style.visibility=hintOn?'visible':'hidden'}
  function buildMap(){dotsEl.innerHTML='';var D=window.__stopC&&window.__stopC();line!.st.forEach(function(s,k){var R=s as StopRef,li=document.createElement('li'),b=document.createElement('button'),nm=line!.custom?(s as Stop).n:(D&&D[R[0]]&&D[R[0]][R[1]]?D[R[0]][R[1]][0]:'');b.type='button';b.innerHTML='<span></span>';b.setAttribute('aria-label','Station '+(k+1)+(nm?': '+nm:''));b.title=nm;b.onclick=function(){travel(k)};li.appendChild(b);dotsEl.appendChild(li)})}
  function startRide(k:string){if(rmode!=='board'||anim||!LN[k])return;line=LN[k];at=0;rmode='ride';laid=false;coupled=false;lowered=false;coupledB=false;openedB=false;dwell=false;map.classList.toggle('gold',line===LN.build);map.classList.toggle('dash',line===LN.workforce);linkU=0;
    try{hintOn=!localStorage.getItem('empowered-ride-hint')}catch(e){hintOn=true}
    buildMap();mapUI();setV(bUI,0);
    go(poseFor(0),1500,function(){setV([map],1);mapUI();sign(true)}).tick=function(u){setV(bUI,1-sm(0,.25,u))}}
  function travel(k:number){if(rmode!=='ride'||anim||k===at||k<0||k>=line!.st.length)return;var n=Math.abs(k-at),fw=k>at;sign(false);at=k;mapUI();var to=poseFor(k);dwell=false;if(line===LN.build&&k===2&&fw){to={c:to.c,cy:to.cy,dz:BS};dwell=true}
    go(to,line===LN.workforce?(k===3||n>1?3600:3000):line!.custom&&(k===line!.st.length-1||n>2)?4200:Math.min(3200,1500+600*(n-1)),function(){sign(true)})}
  function restoreCd(){if(cd&&cdHome){cd.classList.remove('open');cdHome[0].insertBefore(cd,cdHome[1]);cdHome=null}}
  ride.querySelector('.sAct')!.addEventListener('click',function(){var s=line&&line.st[at] as StopRef;if(s&&!line!.custom)openIn(s[0],s[1])});
  map.querySelector('.mChg')!.addEventListener('click',function(){changeLine()});
  function changeLine(){if(rmode!=='ride'||anim)return;window.__guide&&window.__guide.board();restoreCd();sign(false);setV(rUI,0);rmode='board';line=null;go(BP,1300,function(){setV(bUI,1);var b=stn.querySelector('.stRow') as HTMLElement|null;try{b&&b.focus({preventScroll:true})}catch(e){}}).tick=function(u){setV(bUI,sm(.6,1,u))}}
  function intoFactory(){if(rmode!=='ride'||anim)return;var k:LineKey=line===LN.career?'career':line===LN.build?'build':'workforce';restoreCd();sign(false);setV(rUI,0);rmode='leaving';
    if(window.__rideIn)window.__rideIn(k);var t0=performance.now(),D=reduce?0:800;(function f(now:number){var u=D?Math.min(1,(now-t0)/D):1;stn.style.opacity=String(1-sm(0,1,u));if(u<1)requestAnimationFrame(f);else finish()})(t0)}
  function intoGlobe(){if(rmode!=='ride'||anim)return;restoreCd();sign(false);setV(rUI,0);rmode='leaving';var t0=performance.now(),D=reduce?0:800;(function f(now:number){var u=D?Math.min(1,(now-t0)/D):1;stn.style.opacity=String(1-sm(0,1,u));if(u<1)requestAnimationFrame(f);else{finish();window.__toGlobe&&window.__toGlobe()}})(t0)}
  function finish(){anim=null;rmode='board';line=null;stn.hidden=true;state='factory';de.classList.remove('introOn');inertAll();try{document.body.focus()}catch(e){}}
  function next(d:number){if(rmode!=='ride'||anim)return;if(d>0&&at===line!.st.length-1)return intoFactory();travel(at+d)}
  var wLock=false,wLast=0,tY:number|null=null,tDone=false;
  window.__rideInput=function(e){if(state!=='station'||rmode!=='ride')return;var tg=e.target as Element|null;if(cd&&cdHome&&tg&&tg.nodeType===1&&cd.contains(tg)&&e.type!=='wheel')return;
    if(e.type==='wheel'){var we=e as WheelEvent,dd=Math.abs(we.deltaY)>=Math.abs(we.deltaX)?we.deltaY:we.deltaX,now=performance.now(),quiet=now-wLast>220;wLast=now;if(cd&&cdHome&&cd.classList.contains('open')&&cd.contains(tg))return;if(wLock&&quiet)wLock=false;if(wLock||!dd||anim)return;wLock=true;next(dd>0?1:-1);return}
    if(e.type==='keydown'){var ke=e as KeyboardEvent,k=ke.key,ctl=tg&&tg.closest&&tg.closest('button,a,input,textarea,select');if(tg&&tg.closest&&tg.closest('input,textarea,select'))return;var d=0;if(k==='ArrowDown'||k==='ArrowRight'||k==='PageDown'||(k===' '&&!ke.shiftKey&&!ctl))d=1;else if(k==='ArrowUp'||k==='ArrowLeft'||k==='PageUp'||(k===' '&&ke.shiftKey&&!ctl))d=-1;else if(k==='Escape'&&!(cd&&cd.classList.contains('open')))return changeLine();if(d){e.preventDefault();if(!ke.repeat)next(d)}}
    if(e.type==='touchstart'){tY=(e as TouchEvent).touches[0].clientY;tDone=false}
    if(e.type==='touchmove'&&tY!=null&&!tDone){var dy=tY-(e as TouchEvent).touches[0].clientY;if(Math.abs(dy)>40){tDone=true;next(dy>0?1:-1)}}};
  addEventListener('touchstart',function(e){window.__rideInput&&window.__rideInput(e)},{capture:true,passive:true});
  function showStation(){state='station';de.classList.add('introOn');inertAll();anim=null;rmode='board';line=null;laid=false;coupled=false;lowered=false;coupledB=false;openedB=false;dwell=false;restoreCd();stn.hidden=false;stn.style.opacity='1';setV(bUI,1);setV(rUI,0);sign(false);pose=BP;sceneUpdate(performance.now(),0,true);dirty=true}
  stn.addEventListener('click',function(e){var b=(e.target as Element).closest&&(e.target as Element).closest('.stRow') as HTMLElement|null;if(b&&e.isTrusted&&state==='station')startRide(b.dataset.line as string)});
  window.__showStation=function(){setTimeout(function(){if(state!=='factory')return;if(window.__factMode&&window.__factMode()!=='intro')return;showStation();try{stn.focus({preventScroll:true})}catch(e){}},0)};
  window.__stDbg={start:function(k){startRide(k)},go:function(k){travel(k)}};

  function enter(){if(state!=='story')return;showStation();window.__guide&&window.__guide.station();fr.style.pointerEvents='none';if(reduce)fr.style.transition='none';fr.style.opacity='0';
    setTimeout(function(){fr.remove();try{stn.focus({preventScroll:true})}catch(e){}},reduce?0:760)}
  window.__enterFactory=enter;
  window.__replayStory=function(){if(state==='story')return;window.__guide&&window.__guide.story();
    if(state==='factory'){window.__factoryReset&&window.__factoryReset()}else{restoreCd();showStation()}
    var old=document.getElementById('storyIntro');if(old)old.remove();
    fr=document.createElement('iframe');fr.id='storyIntro';fr.title='EmpowerED Careers story';fr.style.opacity='0';if(reduce)fr.style.transition='none';
    stn.parentNode!.insertBefore(fr,stn);state='story';de.classList.add('introOn');inertAll();scrollTo(0,0);
    fr.addEventListener('load',hook);fr.src=storyIntroUrl();
    var n=0,iv2=setInterval(function(){hook();if(++n>40||state!=='story')clearInterval(iv2)},250);
    var me=fr,began=false;me.style.transition='none';
    var fade=function(){if(began||me!==fr||state!=='story')return;began=true;var t0=0;
      (function f(now:number){if(me!==fr||state!=='story')return;if(!t0)t0=now;var u=reduce?1:Math.min(1,(now-t0)/700);me.style.opacity=String(u*u*(3-2*u));
        if(u<1)requestAnimationFrame(f);else{me.style.transition='';stn.hidden=true;try{me.focus()}catch(e){}}})(performance.now())};
    me.addEventListener('load',function(){setTimeout(function(){requestAnimationFrame(function(){requestAnimationFrame(fade)})},100)},{once:true});
    setTimeout(fade,4000)};
  document.addEventListener('click',function(e){var b=(e.target as Element).closest&&(e.target as Element).closest('.stStory');if(b&&state==='station')window.__replayStory!()});
  function hook(){var w!:Window;try{w=fr.contentWindow as Window;w.document}catch(e){return}if(!w||w.__hooked)return;w.__hooked=1;try{w.history.scrollRestoration='manual'}catch(e){}try{w.scrollTo(0,0)}catch(e){}
    var se=function(){var d=w.document;return d.scrollingElement||d.documentElement},
        atBottom=function(){var s=se();return s.scrollHeight>w.innerHeight+4&&s.scrollTop+w.innerHeight>=s.scrollHeight-2},
        bT=0,acc=0,ty:number|null=null,seen=false,lastDoc:HTMLElement|null=null;
    var arm=function(){var s=se();if(s.scrollTop<s.scrollHeight-2*w.innerHeight)seen=true;if(seen&&atBottom()){if(!bT){bT=performance.now();acc=0}}else{bT=0;acc=0}};
    var user=false;['wheel','touchstart','keydown','pointerdown'].forEach(function(ty){w.addEventListener(ty,function(e){if(e.isTrusted)user=true},{capture:true,passive:true})});
    w.addEventListener('scroll',function(){if(!user){var s=se();if(s.scrollTop>0){try{w.scrollTo(0,0)}catch(e){}seen=false;bT=0;acc=0;return}}arm()},{passive:true});
    var rs=setInterval(function(){if(state!=='story'){clearInterval(rs);return}var d=w.document;if(d.documentElement!==lastDoc){lastDoc=d.documentElement;try{w.scrollTo(0,0)}catch(e){}seen=false;bT=0;acc=0}},200);setTimeout(function(){clearInterval(rs)},15000);
    w.addEventListener('wheel',function(e){if(!e.isTrusted)return;arm();if(!bT||e.deltaY<=0){if(e.deltaY<0)acc=0;return}
      if(performance.now()-bT<400)return;acc+=e.deltaMode===1?e.deltaY*16:e.deltaY;if(acc>140)enter()},{passive:true});
    w.addEventListener('touchstart',function(e){if(!e.isTrusted)return;arm();ty=bT?e.touches[0].clientY:null},{passive:true});
    w.addEventListener('touchmove',function(e){if(e.isTrusted&&ty!=null&&performance.now()-bT>400&&ty-e.touches[0].clientY>70){ty=null;enter()}},{passive:true});
    w.addEventListener('keydown',function(e){if(!e.isTrusted)return;arm();var k=e.key;if(bT&&(k==='ArrowDown'||k==='PageDown'||k==='End'||(k===' '&&!e.shiftKey))){e.preventDefault();enter()}});
    w.addEventListener('click',function(e){var a=e.target&&(e.target as Element).closest&&(e.target as Element).closest('a');
if(a&&/Enter the Factory/i.test(a.textContent||'')){e.preventDefault();if(e.isTrusted)enter()}},true);
    try{w.focus()}catch(e){}}
  fr.addEventListener('load',hook);var tries=0,iv=setInterval(function(){hook();if(++tries>40||state!=='story')clearInterval(iv)},250);
}
