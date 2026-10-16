// The 3D EmpowerED Careers company building (formerly the AI Talent Factory): scene construction,
// camera poses and the window.FACTORY API. Company branding lives in brand.ts.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { POSES, HEAD, LANDMASK, INDS, ECO, type Pose } from '../data/content';
import type { P3, TalentUnit, EcoNet } from '../bridge';
import { buildBrand, drawLogo, whenLogo } from './brand';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Tone = 'ink' | 'fine' | 'faint' | 'gold';

/** A group of line work and fills that fades in as one (`r` is its reveal, 0..1). */
interface Area {
  name: string; u: THREE.IUniform<number>; L: Record<Tone, number[]> | null; mats: THREE.Material[]; r: number;
  /** intro reveal point */ at?: number;
  /** distance reveal: centre, fully shown within `full`, starts at `start` */ c?: THREE.Vector3; full?: number; start?: number;
  /** reveal by camera height */ hy?: [number, number];
  fixed?: number; manual?: number; parent?: THREE.Object3D; grow?: number;
  LU?: number[]; dimU?: THREE.IUniform<number>;
  _g?: THREE.MeshBasicMaterial; _y?: THREE.MeshBasicMaterial; _gl?: THREE.MeshBasicMaterial;
  /** per-colour materials for blocky people */ _vx?: Record<number, THREE.MeshBasicMaterial>;
}
interface BoxOpts { p?: THREE.Matrix4; rx?: number; ry?: number; rz?: number; solid?: 'none' | 'green' | 'gold'; tone?: Tone | null }
interface PlaneOpts { rx?: number; ry?: number; mat?: THREE.Material; fill?: boolean; tone?: Tone }
type RedrawTex = THREE.CanvasTexture & { redraw(): void };
interface Route { wp: [P3, P3][]; stops: number[]; pc?: THREE.CatmullRomCurve3; lc?: THREE.CatmullRomCurve3 }
interface GlobeEnd { p: THREE.Vector3; l: THREE.Vector3; s: number; q: THREE.Quaternion }
/** Mutable scene state shared between the FACTORY setters and render(). */
interface SceneState {
  fogB: number; actor: number; hlA: number[]; gsel: number; gdE: number; dist: number; wf: boolean; bayHv: number; baySel: number[]; stop: number;
  cam: { t0: number }; cc: { t0: number }; act: number[]; con: number; net: EcoNet; netA: number; bayDim: number[]; units: TalentUnit[];
  pod: { on: boolean; t0: number }; podGv: number; podLead: number[]; crate: number | null; ticks: number[]; walk: boolean; et: { on: boolean; t0: number };
  gl: { p: THREE.Vector3; i: number; t0: number } | null; car: number; sample: boolean; sh: number; shE: number; hover: string | null;
  spine: boolean; spT0: number; fs: number; gV: number; arcs: number; done: boolean; dir: string | null;
  focus: { q0: THREE.Quaternion; q1: THREE.Quaternion; t0: number } | null; panel: number; panelE: number; A: GlobeEnd | null; B: GlobeEnd | null;
  podK: number; podI: number; podTA: number; podAE: number; podT?: number; podB?: number; cp?: THREE.CatmullRomCurve3; cl?: THREE.CatmullRomCurve3;
}
/** Campus contribution marker (currently disabled, see CMK). */
interface CampusMark { rm: THREE.MeshBasicMaterial; dm: THREE.MeshBasicMaterial; sm3: THREE.MeshBasicMaterial; s: THREE.Mesh; a: number }

export function initFactory(): void {
const PAPER=new THREE.Color(0xF2EFE2),INK=new THREE.Color(0x1E4632),GOLD=new THREE.Color(0xC9A33A);
const TONES:Record<Tone,THREE.Color>={ink:INK,fine:INK.clone().lerp(PAPER,.45),faint:INK.clone().lerp(PAPER,.84),gold:GOLD};
const cv=document.getElementById('c') as HTMLCanvasElement;
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight,false);R.setClearColor(PAPER,1);
const S=new THREE.Scene();S.fog=new THREE.Fog(PAPER,45,190);
const C=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,600);
const CR=new CSS3DRenderer();CR.setSize(innerWidth,innerHeight);CR.domElement.id='c3d';CR.domElement.style.overflow='clip';document.body.insertBefore(CR.domElement,document.getElementById('hud'));const CAMEL=CR.domElement.firstChild!.firstChild as HTMLElement;
const V=(x?:number,y?:number,z?:number)=>new THREE.Vector3(x,y,z);
const AREAS:Area[]=[];
function area(name:string,o:Partial<Area>={}):Area{const a=Object.assign({name,u:{value:0},L:{ink:[],fine:[],faint:[],gold:[]},mats:[],r:0},o);AREAS.push(a);return a}
function seg(a:Area,t:Tone,p:THREE.Vector3,q:THREE.Vector3){a.L![t].push(p.x,p.y,p.z,q.x,q.y,q.z)}
function M(x:number,y:number,z:number,rx=0,ry=0,rz=0){return new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(1,1,1))}
const SC=(x:number,y:number,z:number)=>new THREE.Matrix4().makeScale(x,y,z);
const fillMat=new THREE.MeshBasicMaterial({color:PAPER,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
function amat(a:Area,color:THREE.ColorRepresentation,base=1,map:THREE.Texture|null=null){const m=new THREE.MeshBasicMaterial({color,map,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:base>=1,polygonOffset:true,polygonOffsetFactor:.5,polygonOffsetUnits:1});m.userData.base=base;a.mats.push(m);return m}
const Gm=(a:Area)=>a._g||(a._g=amat(a,INK)),Ym=(a:Area)=>a._y||(a._y=amat(a,GOLD)),GLm=(a:Area)=>a._gl||(a._gl=amat(a,GOLD,.14));
const factoryG=new THREE.Group();factoryG.matrixAutoUpdate=false;S.add(factoryG);let TG=factoryG;
function addMesh(geo:THREE.BufferGeometry,mat:THREE.Material,m:THREE.Matrix4){const o=new THREE.Mesh(geo,mat);o.matrixAutoUpdate=false;o.matrix.copy(m);TG.add(o);return o}
/** Static helper geometry (box, beam, cylinder, plane, panel): merged per material once the scene is built. */
function addS(geo:THREE.BufferGeometry,mat:THREE.Material,m:THREE.Matrix4){const o=addMesh(geo,mat,m);o.userData.b=1;return o}
const BOX=new THREE.BoxGeometry(1,1,1),CYL=new THREE.CylinderGeometry(1,1,1,32),PL=new THREE.PlaneGeometry(1,1);
const EDGES=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
function box(a:Area,x:number,y:number,z:number,w:number,h:number,d:number,o:BoxOpts={}){
  const m=(o.p?o.p.clone():new THREE.Matrix4()).multiply(M(x,y+h/2,z,o.rx||0,o.ry||0,o.rz||0)).multiply(SC(w,h,d));
  const s=o.solid;
  if(s!=='none')addS(BOX,s==='green'?Gm(a):s==='gold'?Ym(a):fillMat,m);
  const t=o.tone!==undefined?o.tone:(s==='green'||s==='gold'?null:'ink');
  if(t){const c:THREE.Vector3[]=[];for(let i=0;i<8;i++)c.push(V(i&1?.5:-.5,i&2?.5:-.5,i&4?.5:-.5).applyMatrix4(m));EDGES.forEach(([i,j])=>seg(a,t,c[i],c[j]))}
}
function beam(a:Area,p:THREE.Vector3,q:THREE.Vector3,t=.2,kind='green'){const d=q.clone().sub(p),len=d.length();addS(BOX,kind==='gold'?Ym(a):Gm(a),new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(V(1,0,0),d.normalize()),V(len,t,t)))}
function line(a:Area,t:Tone,p:P3,q:P3){seg(a,t,V(...p),V(...q))}
function poly(a:Area,t:Tone,pts:P3[],closed=false,m:THREE.Matrix4|null=null){const P=pts.map(p=>{const v=V(...p);return m?v.applyMatrix4(m):v});for(let i=0;i<P.length-(closed?0:1);i++)seg(a,t,P[i],P[(i+1)%P.length])}
function ring(a:Area,t:Tone,m:THREE.Matrix4,r:number,n=48){const P:P3[]=[];for(let i=0;i<n;i++){const k=i/n*Math.PI*2;P.push([Math.cos(k)*r,Math.sin(k)*r,0])}poly(a,t,P,true,m)}
const hring=(a:Area,t:Tone,x:number,y:number,z:number,r:number,n=48)=>ring(a,t,M(x,y,z,-Math.PI/2),r,n);
function cyl(a:Area,x:number,y:number,z:number,r:number,h:number,o:BoxOpts={}){const m=(o.p?o.p.clone():new THREE.Matrix4()).multiply(M(x,y,z,o.rx||0,o.ry||0,o.rz||0));addS(CYL,fillMat,m.clone().multiply(SC(r,h,r)));const t:Tone=o.tone||'ink';[-h/2,h/2].forEach(yy=>ring(a,t,m.clone().multiply(M(0,yy,0,-Math.PI/2)),r,40));for(let i=0;i<4;i++){const k=i*Math.PI/2+Math.PI/4;seg(a,'fine',V(Math.cos(k)*r,-h/2,Math.sin(k)*r).applyMatrix4(m),V(Math.cos(k)*r,h/2,Math.sin(k)*r).applyMatrix4(m))}}
function plane(a:Area,x:number,y:number,z:number,w:number,h:number,o:PlaneOpts={}){const m=M(x,y,z,o.rx||0,o.ry||0);const mat=o.mat||(o.fill?fillMat:null);if(mat)addS(PL,mat,m.clone().multiply(SC(w,h,1)));if(o.tone)poly(a,o.tone,[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]],true,m);return m}
/** Blocky people (art board): suits or casual learners, coloured per figure from its position. */
const VXC={suit:[0x1E4632,0x0F2B22],tops:[0xE9E2CC,0x8FBF9A,0xD9C27A,0xB9CBB8,0xF2EFE2],legs:[0x3E4A44,0x5B6B62,0x2E3A35],skin:[0xC89B7B,0xA87B5C,0xE0B898,0x7A5238],hair:[0x2B2018,0x1A1410,0x4A3424]};
const vmat=(a:Area,c:number)=>{const m=a._vx||(a._vx={});return m[c]||(m[c]=amat(a,c))};
/** Person boxes are queued per (target group, area, colour) and merged into one mesh each, so crowds stay cheap. */
const VXQ=new Map<string,{tg:THREE.Object3D;a:Area;c:number;ms:THREE.Matrix4[]}>();let vxId=0;const vxKey=new WeakMap<object,number>();
const vxq=(a:Area,c:number,m:THREE.Matrix4)=>{const id=(o:object)=>{let v=vxKey.get(o);if(v===undefined){v=++vxId;vxKey.set(o,v)}return v};const k=id(TG)+'/'+id(a)+'/'+c;let e=VXQ.get(k);if(!e){e={tg:TG,a,c,ms:[]};VXQ.set(k,e)}e.ms.push(m)};
function figure(a:Area,pose:Pose,x:number,y:number,z:number,ry=0,flip=1,h=1.75,t:Tone='ink'){
  const s=h/1.75;let hv=Math.sin(x*12.9898+z*78.233+y*3.71)*43758.5453;hv-=Math.floor(hv);
  const pick=(arr:number[],k:number)=>arr[Math.floor((hv*(k+1)*7.31)%1*arr.length)];
  const suit=hv<.5,top=suit?VXC.suit[0]:pick(VXC.tops,1),leg=suit?VXC.suit[1]:pick(VXC.legs,2),skin=pick(VXC.skin,3),hair=pick(VXC.hair,4);
  const base=M(x,y,z,0,ry+(pose==='sit'?(flip>0?Math.PI/2:-Math.PI/2):0)).multiply(SC(s,s,s));
  /** A box hanging from (dir -1) or standing on (dir 1) a pivot, rotated about x at the pivot. */
  const part=(px:number,py:number,pz:number,rx:number,w:number,len:number,d:number,c:number,dir=-1,start=0,edge:Tone|null=null)=>{
    const m=base.clone().multiply(M(px,py,pz,rx)).multiply(M(0,dir*(start+len/2),0)).multiply(SC(w,len,d));vxq(a,c,m);
    if(edge){const cs:THREE.Vector3[]=[];for(let i=0;i<8;i++)cs.push(V(i&1?.5:-.5,i&2?.5:-.5,i&4?.5:-.5).applyMatrix4(m));EDGES.forEach(([i,j])=>seg(a,edge,cs[i],cs[j]))}};
  const sit=pose==='sit',hip=sit?.47:.88,sh=hip+.57,hd=hip+.6;
  const legA=pose==='walk'?.42:0,armA=pose==='walk'?.38:0;
  if(sit){[-.12,.12].forEach(lx=>{part(lx,hip,0,-Math.PI/2,.2,.46,.22,leg);part(lx,hip,.46,0,.2,.47,.22,leg)})}
  else{part(-.12,hip,0,legA,.2,hip,.22,leg);part(.12,hip,0,-legA,.2,hip,.22,leg)}
  part(0,hip,0,0,.52,.6,.3,top,1,0,t);
  if(suit)part(0,hip+.32,.152,0,.13,.26,.02,0xF2EFE2,1);
  const armR=sit?-1:pose==='point'?-1.45:-armA,armL=sit?-1:armA;
  part(.335,sh,0,armR,.15,.5,.17,top);part(.335,sh,0,armR,.13,.1,.15,skin,-1,.5);
  part(-.335,sh,0,armL,.15,.5,.17,top);part(-.335,sh,0,armL,.13,.1,.15,skin,-1,.5);
  if(suit&&hv<.25&&!sit)part(.38,.62,0,0,.09,.3,.4,0x2B2018,-1);
  part(0,hd,0,0,.34,.34,.34,skin,1,0,t);
  part(0,hd+.33,0,0,.37,.08,.37,hair,1);part(0,hd+.06,-.16,0,.36,.3,.06,hair,1);
  [-.075,.075].forEach(ex=>part(ex,hd+.2,.172,0,.05,.05,.02,0x0F2B22,1));
}
const face=(x:number,z:number,c:number[])=>Math.atan2(c[0]-x,c[2]-z);
function chair(a:Area,x:number,y:number,z:number,dir:number){box(a,x,y+.4,z,.48,.05,.48,{tone:'fine'});line(a,'fine',[x,y,z],[x,y+.4,z]);line(a,'fine',[x-.28,y,z],[x+.28,y,z]);line(a,'fine',[x,y,z-.28],[x,y,z+.28]);const bx=x-dir*.25;line(a,'fine',[bx,y+.43,z-.2],[bx-dir*.04,y+1.05,z-.2]);line(a,'fine',[bx,y+.43,z+.2],[bx-dir*.04,y+1.05,z+.2]);line(a,'fine',[bx-dir*.04,y+1.05,z-.2],[bx-dir*.04,y+1.05,z+.2])}
function desk(a:Area,x:number,y:number,z:number,w=1.3,d=.9){box(a,x,y+.7,z,w,.05,d,{});[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([i,j])=>line(a,'fine',[x+i*(w/2-.05),y,z+j*(d/2-.05)],[x+i*(w/2-.05),y+.7,z+j*(d/2-.05)]))}
function monitor(a:Area,x:number,y:number,z:number,ry:number){box(a,x,y+.8,z,.7,.42,.04,{ry});line(a,'fine',[x,y+.75,z],[x,y+.8,z])}
function sitAt(a:Area,x:number,y:number,z:number,dir=1){figure(a,'sit',x,y,z,0,dir);chair(a,x+dir*.02,y,z,dir);desk(a,x+dir*1.05,y,z);monitor(a,x+dir*1.45,y,z,dir>0?-Math.PI/2:Math.PI/2)}
function dataPanel(a:Area,x:number,y:number,z:number,w:number,h:number,ry=0,kind='bars'){
  const m=M(x,y,z,0,ry);addS(PL,GLm(a),m.clone().multiply(SC(w,h,1)));
  poly(a,'gold',[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]],true,m);
  poly(a,'gold',[[-w/2+.12,h/2-.16,0],[-w/2+w*.42,h/2-.16,0]],false,m);
  if(kind==='bars'){const n=6;for(let i=0;i<n;i++){const st=(w-.4)/n,bw=st*.6,bx=-w/2+.2+i*st+bw/2,bh=(.2+((i*37)%10)/10*.6)*(h-.5);addS(PL,Ym(a),m.clone().multiply(M(bx,-h/2+.14+bh/2,.01)).multiply(SC(bw,bh,1)))}}
  else if(kind==='ring'){const r=h*.28,cm=m.clone().multiply(M(-w/2+r+.18,-.08,.01));ring(a,'gold',cm,r,32);ring(a,'gold',cm,r*.62,28);for(let i=0;i<3;i++)poly(a,'gold',[[-w/2+2*r+.35,.1-i*.2,0],[w/2-.15-(i%2)*.3,.1-i*.2,0]],false,m)}
  else{for(let i=0;i<4;i++)poly(a,'gold',[[-w/2+.12,h/2-.4-i*.2,0],[w/2-.2-(i%3)*.35,h/2-.4-i*.2,0]],false,m)}
}
const TEX:RedrawTex[]=[];
function ctex(w:number,h:number,draw:(x:CanvasRenderingContext2D,w:number,h:number)=>void):RedrawTex{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d')!;const t=new THREE.CanvasTexture(c) as RedrawTex;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=R.capabilities.getMaxAnisotropy();t.redraw=()=>{x.clearRect(0,0,w,h);draw(x,w,h);t.needsUpdate=true};t.redraw();TEX.push(t);return t}
document.fonts&&document.fonts.ready.then(()=>TEX.forEach(t=>t.redraw()));
const sp=(x:CanvasRenderingContext2D,v:string)=>{if('letterSpacing' in x)x.letterSpacing=v};
const signTex=ctex(2048,256,(x,w,h)=>{x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);drawLogo(x,150,h/2,190);x.fillStyle='#0F2B22';x.font='800 128px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'12px');x.fillText('EMPOWERED CAREERS',w/2+130,h/2+8)});whenLogo(signTex);
const roomSign=(n:string)=>ctex(512,128,(x,w,h)=>{x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.fillStyle='#F2EFE2';x.font='800 60px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');{const mw=x.measureText(n).width;if(mw>w-36)x.font='800 '+Math.floor(60*(w-36)/mw)+'px Manrope, sans-serif'}x.fillText(n,w/2,h/2+4)});
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const circuitTex=ctex(1024,560,(x,w,h)=>{seed=7;x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.strokeStyle='#C9A33A';x.fillStyle='#C9A33A';x.lineWidth=3;
  const chip:[number,number,number,number]=[430,190,170,160];x.lineWidth=5;x.strokeRect(...chip);x.lineWidth=2;x.strokeRect(chip[0]+22,chip[1]+22,chip[2]-44,chip[3]-44);x.lineWidth=3;
  for(let i=0;i<46;i++){const side=i%4;let px=side===0?chip[0]:side===1?chip[0]+chip[2]:chip[0]+10+rnd()*(chip[2]-20),py=side<2?chip[1]+10+rnd()*(chip[3]-20):side===2?chip[1]:chip[1]+chip[3];x.beginPath();x.moveTo(px,py);let hz=side<2;for(let k=0;k<3;k++){const L=40+rnd()*150;if(hz)px+=(side===0?-1:side===1?1:(rnd()<.5?-1:1))*L;else py+=(side===2?-1:side===3?1:(rnd()<.5?-1:1))*L;x.lineTo(px,py);hz=!hz}x.stroke();x.beginPath();x.arc(px,py,6,0,Math.PI*2);x.fill()}
  ([[90,70,110,70],[820,90,120,80],[110,400,130,90],[800,390,140,100]] as [number,number,number,number][]).forEach(r=>{x.lineWidth=4;x.strokeRect(...r)})});
const ST=[[22,10,48],[0,3.2,5],[0,8.2,-25],[-21,8.1,-31.5],[-7,8.1,-31.5],[7,8.1,-31.5],[21,8.1,-31.5],[-30,17,42]];
const ext=area('ext',{at:.35}),choice=area('choice',{at:.38}),atr=area('atr',{c:V(0,3,-14),full:24,start:34}),mez=area('mez',{c:V(0,8,-28),full:36,start:46}),rA=area('assess',{c:V(-21,8,-41),full:13.5,start:21}),rS=area('skill',{c:V(-7,8,-41),full:13.5,start:21}),rB=area('build',{c:V(7,8,-41),full:13.5,start:21}),rC=area('certify',{c:V(21,8,-41),full:13.5,start:21}),grd=area('grid',{fixed:1});
const GR=24,GC=V(0,-GR,-30),globeG=new THREE.Group();globeG.position.copy(GC);S.add(globeG);
const gA=area('globe',{manual:1,parent:globeG}),gRim=area('rim',{manual:1,parent:S}),gArc=area('arcs',{manual:1,parent:globeG,grow:1});

for(let x=-150;x<=150;x+=3)line(grd,'faint',[x,0,-170],[x,0,140]);
for(let z=-170;z<=140;z+=3)line(grd,'faint',[-150,0,z],[150,0,z]);

// EXTERIOR
plane(ext,-30,8,-30,60,16,{ry:Math.PI/2,fill:true});plane(ext,30,8,-30,60,16,{ry:Math.PI/2,fill:true});
// Back wall, with a real opening for the ETAF gate (6.4 wide, 5.1 tall) so people walk out through it, not through the wall.
plane(ext,-16.6,8,-60,26.8,16,{fill:true});plane(ext,16.6,8,-60,26.8,16,{fill:true});plane(ext,0,10.55,-60,6.4,10.9,{fill:true});plane(ext,0,16,-30,60,60,{rx:-Math.PI/2,fill:true});
box(ext,0,0,-30,60,16,60,{solid:'none'});
for(let z=-4;z>-60;z-=4){line(ext,'fine',[-30,0,z],[-30,16,z]);line(ext,'fine',[30,0,z],[30,16,z])}
line(ext,'fine',[-30,6,0],[-30,6,-60]);line(ext,'fine',[30,6,0],[30,6,-60]);
[-30,-20,-10,10,20,30].forEach(x=>box(ext,x,0,0,.5,16,.5,{solid:'green'}));
box(ext,0,15.7,0,60.5,.6,.5,{solid:'green'});box(ext,-18,5.8,0,24,.4,.4,{solid:'green'});box(ext,18,5.8,0,24,.4,.4,{solid:'green'});
box(ext,-6.3,0,0,.7,8.4,.7,{solid:'green'});box(ext,6.3,0,0,.7,8.4,.7,{solid:'green'});box(ext,0,8,0,13.3,.7,.7,{solid:'green'});
box(ext,0,8.7,2,16,.35,4,{});
for(let x=-27.5;x<=27.5;x+=2.5){if(Math.abs(Math.round(x)%10)===0&&Number.isInteger(x))continue;line(ext,'fine',[x,Math.abs(x)<6.5?8.7:0,0],[x,15.4,0])}
line(ext,'fine',[-30,11,0],[30,11,0]);
[-3,0,3].forEach(x=>line(ext,'fine',[x,0,-.1],[x,4.2,-.1]));line(ext,'fine',[-6,4.2,-.1],[6,4.2,-.1]);
plane(ext,0,12.4,.3,22,2.75,{mat:amat(ext,0xffffff,1,signTex),tone:'ink'});


// ATRIUM
box(atr,0,5.6,-41,60,.4,38,{});box(atr,0,5.15,-22.1,60,.45,.3,{solid:'green'});
[-24,-12,12,24].forEach(x=>{box(atr,x,0,-22.4,.45,5.2,.45,{solid:'green'});box(atr,x,0,-40,.4,5.6,.4,{})});
for(let i=0;i<16;i++)box(atr,0,i*.375,-6.5-i,5,.375,1,{tone:'fine'});
beam(atr,V(-2.65,0,-6),V(-2.65,6,-22),.3);beam(atr,V(2.65,0,-6),V(2.65,6,-22),.3);
beam(atr,V(-2.65,1.05,-5.6),V(-2.65,7.05,-21.6),.12);beam(atr,V(2.65,1.05,-5.6),V(2.65,7.05,-21.6),.12);
for(let i=0;i<=16;i+=2){const z=-6-i,y=i*.375;line(atr,'fine',[-2.65,y,z],[-2.65,y+1.05,z]);line(atr,'fine',[2.65,y,z],[2.65,y+1.05,z])}
line(atr,'gold',[-1.4,.02,4],[-1.4,.02,-6]);line(atr,'gold',[1.4,.02,4],[1.4,.02,-6]);
box(atr,-10,0,-8,5,1.1,1.3,{});box(atr,-11,1.1,-8.2,.7,.42,.04,{});figure(atr,'stand',-10,0,-9.1,face(-10,-9.1,ST[1]));
sitAt(atr,-22,0,-28,1);sitAt(atr,-16,0,-28,1);sitAt(atr,-22,0,-34,1);
dataPanel(atr,-7,3.4,-13,2.8,1.7,face(-7,-13,ST[1]),'bars');dataPanel(atr,7.5,3,-11,2.4,1.5,face(7.5,-11,ST[1]),'ring');
line(atr,'gold',[-7,2.55,-13],[-7,0,-13]);hring(atr,'gold',-7,.02,-13,.6);line(atr,'gold',[7.5,2.25,-11],[7.5,0,-11]);hring(atr,'gold',7.5,.02,-11,.5);
figure(atr,'walk',-4,0,-3,face(-4,-3,ST[1]));figure(atr,'walk',4.5,0,-8,face(4.5,-8,ST[1]),-1);figure(atr,'stand',9,0,-16,face(9,-16,ST[1]));figure(atr,'stand',-12.5,0,-17,face(-12.5,-17,ST[1]));
// Flat office ceiling grid (replaces the factory sawtooth trusses).
for(let z=-6;z>-60;z-=6)line(atr,'faint',[-30,15.2,z],[30,15.2,z]);for(let x=-30;x<=30;x+=6)line(atr,'faint',[x,15.2,-2],[x,15.2,-60]);
[-15,0,15].forEach(x=>[-10,-18].forEach(z=>{line(atr,'fine',[x,16,z],[x,12.5,z]);box(atr,x,12.2,z,.8,.3,.8,{solid:'gold'})}));

// MEZZANINE
beam(mez,V(-30,7.1,-22.1),V(-2.8,7.1,-22.1),.14);beam(mez,V(2.8,7.1,-22.1),V(30,7.1,-22.1),.14);
for(let x=-30;x<=30;x+=2){if(Math.abs(x)<2.8)continue;line(mez,'fine',[x,6,-22.1],[x,7.1,-22.1])}
line(mez,'fine',[-30,6.55,-22.1],[-2.8,6.55,-22.1]);line(mez,'fine',[2.8,6.55,-22.1],[30,6.55,-22.1]);
for(let x=-30;x<=30;x+=2)line(mez,'faint',[x,6.01,-22],[x,6.01,-34]);for(let z=-22;z>=-34;z-=2)line(mez,'faint',[-30,6.01,z],[30,6.01,z]);
([['INTAKE · ASSESSMENT',-21],['DEVELOP · LAUNCH',-7],['DEVELOP · PRO',7],['VERIFY · ETAF™',21]] as [string,number][]).forEach(([n,c])=>{
  [[c-6,-34],[c+6,-34],[c-6,-48],[c+6,-48]].forEach(([x,z])=>box(mez,x,6,z,.24,5,.24,{solid:'green'}));
  box(mez,c,10.9,-34,12.2,.24,.24,{solid:'green'});box(mez,c-6,10.9,-41,.24,.24,14,{solid:'green'});box(mez,c+6,10.9,-41,.24,.24,14,{solid:'green'});
  for(let k=1;k<6;k++){const x=c-6+2*k;if(Math.abs(x-c)<1.1)continue;line(mez,'fine',[x,6,-34],[x,10.9,-34])}
  line(mez,'fine',[c-6,9.6,-34],[c+6,9.6,-34]);line(mez,'ink',[c-1,6,-34],[c-1,9.6,-34]);line(mez,'ink',[c+1,6,-34],[c+1,9.6,-34]);
  for(let z=-36.8;z>-48;z-=2.8){line(mez,'fine',[c-6,6,z],[c-6,10.9,z]);line(mez,'fine',[c+6,6,z],[c+6,10.9,z])}
  plane(mez,c,8.5,-47.9,11.8,5,{fill:true,tone:'ink'});
  plane(mez,c,11.45,-33.8,3.4,.85,{mat:amat(mez,0xffffff,1,roomSign(n))});
});
figure(mez,'walk',-13.5,6,-27,face(-13.5,-27,ST[2]));figure(mez,'stand',13.5,6,-26.5,face(13.5,-26.5,ST[2]));

// ASSESS
{const c=-21,f=(x:number,z:number)=>face(x,z,ST[3]);
 cyl(rA,c,6.09,-41,1.7,.18);[[6.6,1.45],[7.5,1.62],[8.5,1.45]].forEach(([y,r])=>hring(rA,'gold',c,y,-41,r));
 for(let i=0;i<4;i++){const k=i*Math.PI/2+.4;line(rA,'gold',[c+Math.cos(k)*1.45,6.6,-41+Math.sin(k)*1.45],[c+Math.cos(k)*1.45,8.5,-41+Math.sin(k)*1.45])}
 poly(rA,'gold',[[c-2,6.01,-39],[c+2,6.01,-39],[c+2,6.01,-43],[c-2,6.01,-43]],true);
 figure(rA,'stand',c,6.18,-41,f(c,-41));
 box(rA,c-4.2,6,-38.5,1.6,1,.7,{});dataPanel(rA,c-4.2,8.1,-38.8,1.8,1.1,f(c-4.2,-38.8),'bars');
 sitAt(rA,c+2.6,6,-44,1);dataPanel(rA,c+3.6,9.1,-40,2.2,1.3,f(c+3.6,-40),'ring');dataPanel(rA,c-3,9.7,-45,1.8,1,0,'lines');}
// LAUNCH: Foundation Hall
{const c=-7,f=(x:number,z:number)=>face(x,z,ST[4]);
 plane(rS,-10.5,8.3,-47.8,3.4,1.9,{fill:true,tone:'ink'});[[8.9,1.6],[8.6,1.1],[8.3,1.4],[7.9,.8]].forEach(([y,w])=>line(rS,'fine',[-12,y,-47.75],[-12+w,y,-47.75]));poly(rS,'gold',[[-10,7.7,-47.75],[-9.6,8.2,-47.75],[-9.2,8,-47.75],[-8.9,8.8,-47.75]]);
 sitAt(rS,-12.3,6,-44.6,1);sitAt(rS,-10.1,6,-44.6,1);figure(rS,'point',-12.2,6,-46.9,f(-12.2,-46.9));hring(rS,'gold',-10.8,6.02,-45.4,1.6);
 desk(rS,-5.8,6,-46.6,2.6,.9);[-6.7,-5.8,-4.9].forEach(x=>monitor(rS,x,6.1,-46.9,0));dataPanel(rS,-5.8,9.3,-47.4,2.6,1.1,0,'bars');figure(rS,'stand',-5.1,6,-45.4,f(-5.1,-45.4));hring(rS,'gold',-5.8,6.02,-46.2,1.4);
 cyl(rS,-2.8,6.72,-43.8,.9,.06);line(rS,'fine',[-2.8,6,-43.8],[-2.8,6.7,-43.8]);figure(rS,'stand',-3.9,6,-43.2,f(-3.9,-43.2));figure(rS,'point',-1.8,6,-44.4,f(-1.8,-44.4),-1);figure(rS,'stand',-3,6,-45.1,f(-3,-45.1));hring(rS,'gold',-2.8,6.02,-43.8,1.5);
 box(rS,-10.4,6,-39,2.8,.8,.9,{});box(rS,-11.2,6.8,-39,.4,.3,.4,{});box(rS,-10.5,6.8,-38.9,.5,.2,.5,{solid:'gold'});box(rS,-9.7,6.8,-39.1,.3,.45,.3,{});figure(rS,'stand',-10.6,6,-40.1,f(-10.6,-40.1));hring(rS,'gold',-10.4,6.02,-39.4,1.6);
 box(rS,-3.4,6,-39.9,2.8,2,.06,{solid:'none',tone:'fine'});figure(rS,'sit',-4.2,6,-38.8,0,1);chair(rS,-4.18,6,-38.8,1);figure(rS,'sit',-2.6,6,-38.8,0,-1);chair(rS,-2.62,6,-38.8,-1);box(rS,-3.4,6,-38.8,.5,.7,.5,{tone:'fine'});hring(rS,'gold',-3.4,6.02,-39,1.5);
 line(rS,'gold',[-2,6.03,-41.5],[3,6.03,-41.5]);}
// PRO: specialisation pods
{const f=(x:number,z:number)=>face(x,z,ST[5]);
 const P=[...Array(7)].map((_,i)=>{const a=(-33+i*41/6)*Math.PI/180;return [7+10.5*Math.sin(a),-31.5-10.5*Math.cos(a)]});
 P.forEach(([x,z])=>{hring(rB,'gold',x,6.02,z,.5);hring(rB,'fine',x,6.02,z,.6)});
 {const [x,z]=P[0],L=[[6.7,7.2,7.7],[6.5,6.95,7.4,7.85],[6.95,7.45]];box(rB,x,6,z,.3,.3,.3,{});L.forEach((ys,j)=>ys.forEach(y=>{ring(rB,j===1?'gold':'ink',M(x-.6+j*.6,y,z),.1,16);if(j<2)L[j+1].forEach(y2=>line(rB,'fine',[x-.6+j*.6,y,z],[x+j*.6,y2,z]))}));}
 {const [x,z]=P[1];[6.25,6.75,7.25].forEach(y=>cyl(rB,x,y,z,.55,.4));hring(rB,'gold',x,7.47,z,.55);}
 {const [x,z]=P[2];box(rB,x,6,z,.9,1.7,.7,{});for(let y=6.3;y<7.6;y+=.3)line(rB,'fine',[x-.35,y,z+.36],[x+.35,y,z+.36]);ring(rB,'gold',M(x-.28,8.15,z),.28,24);ring(rB,'gold',M(x+.28,8.15,z),.28,24);}
 {const [x,z]=P[3];box(rB,x,6,z,.5,.6,.5,{});box(rB,x,6.6,z,.95,.75,.36,{});const S:P3[]=[];for(let i=0;i<=16;i++){const a=Math.PI*i/16;S.push([x+Math.cos(a)*.3,7.35+Math.sin(a)*.34,z])}poly(rB,'ink',S);ring(rB,'gold',M(x,7,z+.19),.08,12);line(rB,'gold',[x,6.92,z+.19],[x,6.78,z+.19]);}
 {const [x,z]=P[4];[-.15,0,.15].forEach((o,i)=>{box(rB,x+o,6.15+i*.45,z,1.3,.14,1,i===2?{solid:'gold'}:{});});[[-.5,-.35],[.5,-.35],[-.5,.35],[.5,.35]].forEach(([a,b])=>line(rB,'fine',[x+a,6,z+b],[x+a,7.1,z+b]));}
 {const [x,z]=P[5];plane(rB,x,7.35,z,1.9,1.1,{fill:true,tone:'ink'});[[-.6,7.6],[0,7.6],[.6,7.6],[0,7.1]].forEach(([dx,y],i)=>box(rB,x+dx,y-.1,z+.03,.34,.2,.02,i===3?{solid:'gold'}:{tone:'ink'}));line(rB,'fine',[x-.43,7.6,z+.04],[x-.17,7.6,z+.04]);line(rB,'fine',[x+.17,7.6,z+.04],[x+.43,7.6,z+.04]);line(rB,'fine',[x,7.5,z+.04],[x,7.2,z+.04]);line(rB,'fine',[x-.6,6,z],[x-.6,6.8,z]);line(rB,'fine',[x+.6,6,z],[x+.6,6.8,z]);}
 {const [x,z]=P[6];cyl(rB,x,6.15,z,.45,.3);beam(rB,V(x,6.3,z),V(x+.35,7.35,z),.1);beam(rB,V(x+.35,7.35,z),V(x-.4,7.85,z),.08);line(rB,'ink',[x-.4,7.85,z],[x-.6,7.6,z]);line(rB,'ink',[x-.4,7.85,z],[x-.2,7.6,z]);ring(rB,'gold',M(x+.35,7.35,z),.09,12);line(rB,'fine',[x+.65,6,z+.3],[x+.65,7.5,z+.3]);ring(rB,'gold',M(x+.65,7.6,z+.3),.1,12);ring(rB,'fine',M(x+.65,7.6,z+.3),.2,16);}
 ([[-22.75,'stand',1],[-2.3,'point',-1]] as [number,Pose,number][]).forEach(([d,p,h])=>{const a=d*Math.PI/180,x=7+11.4*Math.sin(a),z=-31.5-11.4*Math.cos(a);figure(rB,p,x,6,z,f(x,z),h)});}
// ETAF: assurance core
{const c=21,cz=-43.8;
 cyl(rC,c,6.15,cz,1.3,.3);cyl(rC,c,7.5,cz,.45,2.4);[6.9,7.7,8.5].forEach(y=>hring(rC,'gold',c,y,cz,.8));hring(rC,'gold',c,8.75,cz,.55);hring(rC,'fine',c,6.02,cz,3.1);
 plane(rC,c,10.2,-47.8,6.4,.8,{mat:amat(rC,0xffffff,1,ctex(1024,128,(x,w,h)=>{x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.fillStyle='#F2EFE2';x.font='800 60px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');x.fillText('ETAF™ ASSURANCE',w/2,h/2+4)}))});}
// CHOICE: paths and doors at the exterior
const lanePts=(pts:P3[])=>new THREE.CatmullRomCurve3(pts.map(p=>V(...p))).getSpacedPoints(70);
{const P=lanePts([[0,0,46],[1.2,0,30],[0,0,13],[0,0,4.5]]);for(let i=0;i<70;i++){const p=P[i],q=P[i+1],d=q.clone().sub(p).normalize(),n=V(-d.z,0,d.x).multiplyScalar(1.3);seg(choice,'gold',p.clone().add(n).setY(.03),q.clone().add(n).setY(.03));seg(choice,'gold',p.clone().sub(n).setY(.03),q.clone().sub(n).setY(.03));if(i%3===0)seg(choice,'gold',p.clone().setY(.03),p.clone().lerp(q,.6).setY(.03))}}
{const P=lanePts([[7,0,46],[12,0,30],[20,0,14],[24,0,3.4]]),pos:number[]=[],idx:number[]=[];for(let i=0;i<=70;i++){const p=P[i],d=P[Math.min(70,i+1)].clone().sub(P[Math.max(0,i-1)]).normalize(),n=V(-d.z,0,d.x).multiplyScalar(1.2);pos.push(p.x+n.x,.025,p.z+n.z,p.x-n.x,.025,p.z-n.z)}for(let i=0;i<70;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);factoryG.add(new THREE.Mesh(g,Gm(choice)))}
box(choice,24,0,1.6,9,1.2,3.2,{});
[20.3,27.7].forEach(x=>box(choice,x,.3,3.28,.5,.6,.16,{solid:'green'}));
plane(choice,24,3.2,.08,6,4,{fill:true,tone:'ink'});for(let y=1.6;y<5.2;y+=.4)line(choice,'fine',[21,y,.1],[27,y,.1]);
poly(choice,'ink',[[19.5,1.2,3.2],[16.8,0,3.2]]);poly(choice,'ink',[[19.5,1.2,.4],[16.8,0,.4]]);line(choice,'fine',[16.8,0,3.2],[16.8,0,.4]);
plane(choice,24,6.95,.35,3.6,.9,{mat:amat(choice,0xffffff,1,roomSign('TALENT DOCK'))});
{const bx=0,bz=-10,by=17.8,tp=by+7;
 box(choice,bx,by,bz,3,.4,3,{});
 [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([i,j])=>line(choice,'ink',[bx+i*1.2,by+.4,bz+j*1.2],[bx+i*.35,tp,bz+j*.35]));
 for(let k=0;k<5;k++){const y0=by+.4+k*1.3,y1=y0+1.3,w0=1.2-(k/5)*.85,w1=1.2-((k+1)/5)*.85;line(choice,'fine',[bx-w0,y0,bz+w0],[bx+w1,y1,bz+w1]);line(choice,'fine',[bx+w0,y0,bz+w0],[bx-w1,y1,bz+w1]);line(choice,'fine',[bx-w0,y0,bz-w0],[bx+w1,y1,bz-w1])}
 hring(choice,'ink',bx,tp,bz,.6);cyl(choice,bx,tp+.5,bz,.32,1);hring(choice,'gold',bx,tp+1.05,bz,.55);hring(choice,'gold',bx,tp+1.05,bz,1.3);hring(choice,'fine',bx,tp+1.05,bz,2.1);
 line(choice,'gold',[bx,tp+1.05,bz],[bx,tp+48,bz]);}
beam(choice,V(-6,.06,4.5),V(6,.06,4.5),.12,'gold');
// COMPANY BRANDING (brand.ts)
const brand=buildBrand({
  area:(n,o)=>area(n,o as Partial<Area>),
  box:(a,x,y,z,w,h,d,o)=>box(a as Area,x,y,z,w,h,d,o),
  line:(a,t,p,q)=>line(a as Area,t,p,q),
  plane:(a,x,y,z,w,h,o)=>plane(a as Area,x,y,z,w,h,o),
  amat:(a,c,b,m)=>amat(a as Area,c,b,m),
  ctex:(w,h,d)=>ctex(w,h,d),
  figure:(a,p,x,y,z,ry,fl,h)=>figure(a as Area,p,x,y,z,ry,fl,h),
  into:(g,fn)=>{const prev=TG;TG=g as THREE.Group;try{fn()}finally{TG=prev}},
  root:factoryG,cam:()=>C,
},innerWidth<=700||((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=4);
// GLOBE (AI for Everyone)
TG=globeG;
const llv=(la:number,lo:number)=>{la*=Math.PI/180;lo*=Math.PI/180;return V(Math.cos(la)*Math.cos(lo),Math.sin(la),-Math.cos(la)*Math.sin(lo))};
const gSphere=new THREE.Mesh(new THREE.SphereGeometry(GR*.992,64,40),fillMat);gSphere.visible=false;globeG.add(gSphere);
for(let lat=-75;lat<=75;lat+=15){const k=lat*Math.PI/180;ring(gA,'ink',M(0,GR*Math.sin(k),0,-Math.PI/2),GR*Math.cos(k),96)}
for(let lon=0;lon<180;lon+=15)ring(gA,'ink',M(0,0,0,0,lon*Math.PI/180),GR,96);
{const b=atob(LANDMASK),pts:number[]=[];let idx=0;for(let lat=-84;lat<=84.01;lat+=2.4){const n=Math.max(1,Math.round(150*Math.cos(lat*Math.PI/180)));for(let i=0;i<n;i++){const lon=-180+(i+.5)*360/n;if((b.charCodeAt(idx>>3)>>(idx&7))&1){const v=llv(lat,lon).multiplyScalar(GR*1.004);pts.push(v.x,v.y,v.z)}idx++}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));const pm=new THREE.PointsMaterial({color:TONES.ink,size:2.6,sizeAttenuation:false,transparent:true,opacity:0});pm.userData.base=.7;gA.mats.push(pm);globeG.add(new THREE.Points(g,pm))}
const BUILD:Record<string,(a:Area,P:THREE.Matrix4)=>void>={
 hospital(a,P){box(a,0,0,0,2,1.3,1.3,{p:P});box(a,1.4,0,0,.8,.8,1.1,{p:P,tone:'fine'});box(a,0,1.3,0,.7,.35,.7,{p:P,tone:'fine'});box(a,0,.66,.66,.52,.14,.03,{p:P,solid:'gold'});box(a,0,.48,.66,.14,.5,.03,{p:P,solid:'gold'})},
 factory(a,P){box(a,0,0,0,2.2,.9,1.3,{p:P});[.65,-.65].forEach(z=>poly(a,'ink',[[-1.1,.9,z],[-.7,1.3,z],[-.7,.9,z],[-.3,1.3,z],[-.3,.9,z],[.1,1.3,z],[.1,.9,z]],false,P));cyl(a,.75,1.1,0,.16,2.2,{p:P});ring(a,'gold',P.clone().multiply(M(.75,2.25,0,-Math.PI/2)),.22,16)},
 bank(a,P){box(a,0,0,0,2.2,.18,1.4,{p:P});[-.8,-.27,.27,.8].forEach(x=>box(a,x,.18,.55,.14,.9,.14,{p:P,tone:'fine'}));box(a,0,1.08,0,2.2,.16,1.4,{p:P});poly(a,'ink',[[-1.1,1.24,.7],[0,1.7,.7],[1.1,1.24,.7]],false,P);ring(a,'gold',P.clone().multiply(M(0,1.42,.72)),.13,16)},
 school(a,P){box(a,0,0,0,2.4,.9,1.2,{p:P});box(a,0,.9,0,.6,.7,.6,{p:P});poly(a,'ink',[[-.3,1.6,.3],[0,1.9,.3],[.3,1.6,.3]],false,P);poly(a,'fine',[[0,1.9,0],[0,2.4,0]],false,P);box(a,.16,2.22,0,.3,.16,.02,{p:P,solid:'gold'})},
 court(a,P){box(a,0,0,0,2,1.2,1.2,{p:P});box(a,0,1.2,0,2.1,.12,1.3,{p:P});poly(a,'ink',[[-1.05,1.32,.65],[0,1.72,.65],[1.05,1.32,.65]],true,P);poly(a,'gold',[[0,.25,.61],[0,.98,.61]],false,P);poly(a,'gold',[[-.42,.9,.61],[.42,.9,.61]],false,P);[-.42,.42].forEach(x=>poly(a,'gold',[[x,.9,.61],[x-.16,.58,.61],[x+.16,.58,.61]],true,P))},
 studio(a,P){box(a,0,0,0,1.9,1,1.3,{p:P});box(a,0,1,0,1.9,.16,1.3,{p:P,solid:'gold'});for(let k=-.7;k<.8;k+=.35)poly(a,'ink',[[k,1.16,.66],[k+.18,1.16,.66]],false,P);ring(a,'ink',P.clone().multiply(M(.35,.5,.66)),.3,24);ring(a,'fine',P.clone().multiply(M(.35,.5,.66)),.16,20);poly(a,'fine',[[-.6,.25,.66],[-.2,.25,.66],[-.2,.75,.66],[-.6,.75,.66]],true,P)},
 crane(a,P){box(a,-.5,0,0,1.2,.9,1,{p:P,tone:'fine'});poly(a,'ink',[[.7,0,0],[.7,2.6,0]],false,P);poly(a,'ink',[[.86,0,0],[.86,2.6,0]],false,P);for(let y=0;y<2.5;y+=.32)poly(a,'fine',[[.7,y,0],[.86,y+.32,0]],false,P);poly(a,'ink',[[-1,2.6,0],[1.7,2.6,0]],false,P);poly(a,'ink',[[-1,2.6,0],[.78,3,0],[1.7,2.6,0]],false,P);poly(a,'gold',[[-.55,2.6,0],[-.55,1.55,0]],false,P);box(a,-.55,1.35,0,.3,.2,.3,{p:P,solid:'gold'})},
 gov(a,P){box(a,0,0,0,2.2,.9,1.4,{p:P});cyl(a,0,1.15,0,.55,.5,{p:P});for(let j=0;j<5;j++){const k=j/5*Math.PI/2;ring(a,'ink',P.clone().multiply(M(0,1.4+Math.sin(k)*.55,0,-Math.PI/2)),.55*Math.cos(k),24)}poly(a,'gold',[[0,1.95,0],[0,2.4,0]],false,P);box(a,.14,2.25,0,.26,.14,.02,{p:P,solid:'gold'})},
 hotel(a,P){box(a,0,0,0,1.1,2.4,1,{p:P});for(let y=.5;y<2.2;y+=.35)poly(a,'fine',[[-.45,y,.51],[.45,y,.51]],false,P);[-.18,.18].forEach(x=>poly(a,'fine',[[x,.4,.51],[x,2.2,.51]],false,P));box(a,0,.6,.62,.8,.06,.3,{p:P,tone:'fine'});box(a,0,2.15,.52,.6,.12,.03,{p:P,solid:'gold'})}
};
const NF=llv(20,78),QF=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),NF),R0=QF.clone().invert(),SF=.06;
const NODES=INDS.map(d=>{const n=llv(d.lat,d.lon),q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),n);BUILD[d.kind](gA,new THREE.Matrix4().compose(n.clone().multiplyScalar(GR),q,V(1.35,1.35,1.35)));return{n,tip:n.clone().multiplyScalar(GR+2.2)}});
gArc.LU=[];NODES.forEach(nd=>{const N=48;let prev:THREE.Vector3|null=null;for(let i=0;i<=N;i++){const t=i/N,p=NF.clone().lerp(nd.n,t).normalize().multiplyScalar(GR+.25+2.4*Math.sin(Math.PI*t));if(prev){gArc.L!.gold.push(prev.x,prev.y,prev.z,p.x,p.y,p.z);gArc.LU!.push((i-1)/N,i/N)}prev=p}});
const GPOS=V(0,5,44),GLOOK=GC.clone().add(V(-9,1.5,0));
const selM=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),selR=new THREE.Mesh(new THREE.RingGeometry(1.5,1.95,48),selM);selR.visible=false;globeG.add(selR);
{const dv=GPOS.clone().sub(GC),d=dv.length();dv.normalize();const c=GC.clone().add(dv.clone().multiplyScalar(GR*GR/d)),rr=GR*Math.sqrt(1-(GR/d)**2)*1.003;ring(gRim,'ink',new THREE.Matrix4().compose(c,new THREE.Quaternion().setFromUnitVectors(V(0,0,1),dv),V(1,1,1)),rr,128)}
const CAMDIR=GPOS.clone().sub(GC).normalize();
const Rg=(()=>{const want=CAMDIR.clone().add(V(.08,.2,0)).normalize(),az=(v:THREE.Vector3)=>Math.atan2(v.x,v.z),el=(v:THREE.Vector3)=>Math.asin(v.y);const Qy=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),az(want)-az(NF)),n1=NF.clone().applyQuaternion(Qy),ax=n1.clone().cross(V(0,1,0)).normalize();return new THREE.Quaternion().setFromAxisAngle(ax,el(want)-el(n1)).multiply(Qy)})();
TG=factoryG;

// CAREER ACCELERATE: Product Engineering floor
const FX=[22,15.6,9.2,2.8,-3.6,-10],FZ=-31;
const pef=area('pef',{c:V(6,2,-31),full:34,start:48});
{const cs=[26,0,-22.8];
 plane(pef,8,4.55,-22.3,6,1.1,{mat:amat(pef,0xffffff,1,roomSign('ENGINEER · PRODUCT PODS'))});
 poly(pef,'ink',[[29.95,0,-29.2],[29.95,3.2,-29.2],[29.95,3.2,-32.8],[29.95,0,-32.8]]);for(let y=.4;y<3.2;y+=.4)line(pef,'fine',[29.93,y,-29.2],[29.93,y,-32.8]);
 plane(pef,29.9,3.9,-31,3.6,.8,{ry:-Math.PI/2,mat:amat(pef,0xffffff,1,roomSign('FROM WORKFORCE'))});
 line(pef,'gold',[30,.03,FZ-.45],[-12,.03,FZ-.45]);line(pef,'gold',[30,.03,FZ+.45],[-12,.03,FZ+.45]);
 ['DISCOVER','DESIGN','BUILD','TEST & SECURE','DEPLOY & OPERATE','DEMO & VALIDATE'].forEach((n,i)=>{const x=FX[i];hring(pef,'gold',x,.03,FZ,1.1);plane(pef,x,4.1,FZ-2.6,3.1,.72,{ry:face(x,FZ-2.6,[x+4,0,-22.8]),mat:amat(pef,0xffffff,1,roomSign(n))});line(pef,'fine',[x-1.2,4.46,FZ-2.6],[x-1.2,5.6,FZ-2.6]);line(pef,'fine',[x+1.2,4.46,FZ-2.6],[x+1.2,5.6,FZ-2.6])});
 const pf=(x:number,z:number,i:number)=>face(x,z,[FX[i]+4,0,-22.8]);
 {const x=22;plane(pef,x,2.2,-37,4.2,2.2,{fill:true,tone:'ink'});[[-1.5,2.8],[-.9,2.9],[-.3,2.6],[.5,2.9],[1.2,2.7],[-1.2,2],[-.4,1.8],[.8,2],[1.5,1.7]].forEach(([dx,y],k)=>box(pef,x+dx,y,-36.95,.36,.36,.02,k%3===0?{solid:'gold'}:{tone:'ink'}));figure(pef,'point',20.2,0,-35.2,pf(20.2,-35.2,0));figure(pef,'stand',23.4,0,-34.4,pf(23.4,-34.4,0),-1);figure(pef,'stand',24.6,0,-35.6,pf(24.6,-35.6,0),-1);}
 {const x=15.6;plane(pef,x,2.4,-37.4,5,2.6,{mat:amat(pef,0xffffff,1,circuitTex),tone:'ink'});figure(pef,'point',14.4,0,-35.4,pf(14.4,-35.4,1));figure(pef,'stand',17.4,0,-34.8,pf(17.4,-34.8,1),-1);}
 {const x=9.2;plane(pef,x,2.4,-37.6,4.8,2.4,{fill:true,tone:'ink'});for(let c=0;c<4;c++){line(pef,'fine',[x-2.4+c*1.2,1.3,-37.55],[x-2.4+c*1.2,3.5,-37.55]);for(let r=0;r<3;r++)box(pef,x-1.8+c*1.2,1.6+r*.62,-37.55,.8,.4,.02,r===0&&c===2?{solid:'gold'}:{tone:'fine'})}
  ([['CODE',5.2],['AI',7.6],['CLOUD',10],['CYBER',12.4]] as [string,number][]).forEach(([n,dx])=>{sitAt(pef,dx-1.05,0,-34.6,1);plane(pef,dx+.4,1.75,-34.6,1.1,.3,{ry:pf(dx,-34.6,2),mat:amat(pef,0xffffff,1,roomSign(n))})});}
 {const x=2.8;box(pef,x,0,FZ+1.5,.24,3,.24,{solid:'gold'});box(pef,x,0,FZ-1.5,.24,3,.24,{solid:'gold'});box(pef,x,2.9,FZ,.24,.24,3.2,{solid:'gold'});plane(pef,x,1.45,FZ,3,2.9,{ry:Math.PI/2,mat:GLm(pef)});figure(pef,'stand',1.2,0,-34.4,pf(1.2,-34.4,3));figure(pef,'point',4.4,0,-34.8,pf(4.4,-34.8,3),-1);}
 {[-5.2,-3.6,-2].forEach(x=>{box(pef,x,0,-36.6,1.1,2.5,.8,{});for(let y=.4;y<2.4;y+=.35)line(pef,'fine',[x-.45,y,-36.19],[x+.45,y,-36.19]);box(pef,x+.35,2.1,-36.18,.12,.08,.02,{solid:'gold'})});dataPanel(pef,-3.6,3.4,-37,3.4,.95,0,'bars');figure(pef,'stand',-1,0,-34.2,pf(-1,-34.2,4),-1);sitAt(pef,-7.4,0,-34.4,1);}
 {const x=-10,demoTex=ctex(1024,540,(c,w,hh)=>{c.fillStyle='#1E4632';c.fillRect(0,0,w,hh);c.fillStyle='#F2EFE2';c.font='800 30px Manrope, sans-serif';sp(c,'6px');c.fillText('CLIENT DEMO',44,64);c.fillStyle='#C9A33A';c.fillRect(44,84,110,5);c.strokeStyle='rgba(242,239,226,.5)';c.lineWidth=3;c.strokeRect(44,130,560,340);c.strokeRect(640,130,340,150);c.strokeRect(640,320,340,150);c.strokeStyle='#C9A33A';c.lineWidth=6;c.beginPath();c.moveTo(70,430);([[160,380],[250,400],[340,300],[430,320],[520,200],[590,180]] as [number,number][]).forEach(p=>c.lineTo(...p));c.stroke();c.fillStyle='#C9A33A';[0,1,2,3].forEach(i=>c.fillRect(670+i*72,250-i*28,40,20+i*28))});
  plane(pef,x,2.5,-37.6,5.4,2.8,{mat:amat(pef,0xffffff,1,demoTex),tone:'ink'});figure(pef,'point',-13,0,-35.8,pf(-13,-35.8,5));[[-11.4,-27.6],[-9.6,-27.3],[-7.9,-27.8]].forEach(([a,b])=>figure(pef,'stand',a,0,b,face(a,b,[x,0,-37.6])));}
}
const dynG=(c:THREE.Vector3,full:number,start:number)=>{const g=new THREE.Group();factoryG.add(g);g.visible=false;return{g,a:area('dyn'+Math.random(),{c,full,start,parent:g})}};
const crate=dynG(V(8,1,-31),34,48);TG=crate.g;box(crate.a,0,0,0,1.5,1.1,1.1,{});box(crate.a,0,.44,0,1.54,.16,1.14,{solid:'gold'});line(crate.a,'fine',[-.75,0,.56],[.75,1.1,.56]);line(crate.a,'fine',[.75,0,.56],[-.75,1.1,.56]);plane(crate.a,0,1.6,0,2.6,.56,{mat:amat(crate.a,0xffffff,1,roomSign('INDUSTRY PROBLEM'))});TG=factoryG;
const mentor=dynG(V(8,1,-28),34,48);TG=mentor.g;figure(mentor.a,'point',0,0,0,0,1,1.8,'gold');hring(mentor.a,'gold',0,.03,0,.5);plane(mentor.a,0,2.25,0,1.3,.34,{mat:amat(mentor.a,0xffffff,1,roomSign('MENTOR'))});TG=factoryG;
const walkC=new THREE.CatmullRomCurve3(([[31,6,-29.5],[35.6,6,-29.5],[40,0,-29.5],[44,0,-27],[46.8,0,-21],[48.3,0,-14.6]] as P3[]).map(p=>V(...p)));
const WALK=[0,1,2].map(i=>{const w=dynG(V(42,3,-24),30,50);TG=w.g;figure(w.a,'walk',0,0,0,0,1);box(w.a,.06,1.18,.03,.12,.16,.02,{solid:'gold'});TG=factoryG;return w});
const ent=area('ent',{c:V(56,4,-20),full:30,start:50});
([[58,-27,6,8,5],[61,-13,5,6,5]] as [number,number,number,number,number][]).forEach(([x,z,w,hh,d])=>{box(ent,x,0,z,w,hh,d,{});for(let yy=1.4;yy<hh-.6;yy+=1.4)line(ent,'fine',[x-w/2+.4,yy,z+d/2+.01],[x+w/2-.4,yy,z+d/2+.01]);plane(ent,x,hh+.5,z+d/2,3.4,.7,{mat:amat(ent,0xffffff,1,roomSign('ENTERPRISE'))})});
([[[48.4,0,-15],[52,0,-20],[55,0,-24.4]],[[49,0,-13],[54,0,-12],[58.5,0,-10.5]]] as P3[][]).forEach(pts=>{const P=lanePts(pts);for(let i=0;i<70;i++){const p=P[i],q=P[i+1],d=q.clone().sub(p).normalize(),n=V(-d.z,0,d.x).multiplyScalar(.5);seg(ent,'gold',p.clone().add(n).setY(.03),q.clone().add(n).setY(.03));seg(ent,'gold',p.clone().sub(n).setY(.03),q.clone().sub(n).setY(.03))}});
const tickM=new THREE.MeshBasicMaterial({color:GOLD});const TICKS=[[-10.8,-45.4],[-5.8,-46.2],[-2.8,-43.8],[-10.4,-39.4],[-3.4,-39]].map(([x,z])=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.22),tickM);m.position.set(x,9.1,z);m.visible=false;factoryG.add(m);return m});
// ETAF dynamic: gates + streams
const EC=[21,-43.8],EN=['ASSESSMENTS','ARTIFACTS & CODE','PROJECT DELIVERY','PERFORMANCE DATA','OBSERVED BEHAVIOUR','CREDENTIALS'];
const goldSign=(n:string)=>ctex(512,128,(x,w,hh)=>{x.fillStyle='#C9A33A';x.fillRect(0,0,w,hh);x.fillStyle='#0F2B22';x.font='800 60px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');{const mw=x.measureText(n).width;if(mw>w-36)x.font='800 '+Math.floor(60*(w-36)/mw)+'px Manrope, sans-serif'}x.fillText(n,w/2,hh/2+4)});
const eg=area('etafg',{c:V(21,8,-42),full:14,start:24});
const SRC=[V(-10.8,7.2,-45.4),V(5.4,7.2,-45.2),V(-10,1.6,-33.5),V(-3.6,1.6,-35.5),V(-2.8,7.2,-43.8),V(8.6,7.2,-45.2)];
const GATES=EN.map((n,i)=>{const a=Math.PI*(.62+i*.152),gx=EC[0]+Math.sin(a)*3.1,gz=EC[1]-Math.cos(a)*3.1,ry=Math.atan2(EC[0]-gx,EC[1]-gz);
 const m=M(gx,6,gz,0,ry);poly(eg,'ink',[[-.5,0,0],[-.5,1.7,0],[.5,1.7,0],[.5,0,0]],false,m);
 const lm=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const lp=new THREE.Mesh(new THREE.PlaneGeometry(.96,1.66),lm);lp.position.set(gx,6.85,gz);lp.rotation.y=ry;factoryG.add(lp);
 const sm2=amat(eg,0xffffff,1,roomSign(n));sm2.userData.dark=sm2.map;sm2.userData.lit=goldSign(n);
 const s=SRC[i],pts=s.y<3?[s,V(s.x,2.4,-24.5),V(12,6.8,-23.5),V(14.5,6.9,-31.5),V(16.5,6.9,-37),V(gx,6.9,gz)]:[s,V(s.x,7.3,-32.6),V(14.5,6.9,-32),V(16.5,6.9,-37),V(gx,6.9,gz)];
 const cv=new THREE.CatmullRomCurve3(pts,false,'centripetal');const lnM=new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:0});const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(120)),lnM);ln.visible=false;factoryG.add(ln);
 const dm=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false});const dots=[];for(let j=0;j<7;j++){const d=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),dm);d.visible=false;factoryG.add(d);dots.push(d)}
 return{gx,gz,lm,sm2,cv,ln,lnM,dots,dm,lit:false}});
// click targets (matched by panel buttons)
const HIT:THREE.Mesh[]=[],hitMat=new THREE.MeshBasicMaterial();
const hit=(k:string,stop:number|string,x:number,y:number,z:number,w:number,hh:number,d:number)=>{const m=new THREE.Mesh(BOX,hitMat);m.position.set(x,y,z);m.scale.set(w,hh,d);m.visible=false;m.userData={k,stop};factoryG.add(m);HIT.push(m)};
[[-10.8,-45.4,4],[-5.8,-46.4,3.2],[-2.8,-43.8,3],[-10.4,-39.2,3.4],[-3.4,-39,3.2]].forEach(([x,z,w],i)=>hit('st'+i,3,x,7.2,z,w,2.6,3));
[[2.2,-45.2],[5.4,-45.2],[8.6,-45.2],[11.8,-45.2],[2.8,-39.4],[7,-39.4],[11.2,-39.4]].forEach(([x,z],i)=>hit('pod'+i,4,x,7.3,z,2.4,2.8,2.4));
FX.forEach((x,i)=>hit('stg'+i,5,x,1.6,-33.5,5.4,3.4,6));
GATES.forEach((g,i)=>hit('sr'+i,6,g.gx,7.3,g.gz,1.6,2.8,1.6));
const RAY=new THREE.Raycaster(),NDC=new THREE.Vector2();
const frostM=new THREE.MeshBasicMaterial({color:PAPER,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),recM=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),gateM=recM.clone();
const mkP=(x:number,y:number,z:number,w:number,hh:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(w,hh),m);o.position.set(x,y,z);o.visible=false;factoryG.add(o);return o};
const COR=[mkP(-7,8.45,-33.8,11.8,4.9,frostM),mkP(7,8.45,-33.8,11.8,4.9,frostM),mkP(8,2.7,-22.35,44,5.4,frostM)],GATE=mkP(-21,8.45,-33.8,11.8,4.9,gateM);
const scanR=new THREE.Mesh(new THREE.RingGeometry(1.5,1.62,56),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));scanR.rotation.x=-Math.PI/2;scanR.position.set(-21,7,-41);scanR.visible=false;factoryG.add(scanR);
// WORKFORCE DOCK (output side) + TaaS shelf + POD nodes
const BZ=[-3.5,-8.5,-13.5,-18.5,-23.5],dA=area('dock',{c:V(38,3,-14),full:30,start:52});
const wideSign=(n:string,k:string)=>ctex(1024,180,(x,w,hh)=>{x.fillStyle='#0F2B22';x.fillRect(0,0,w,hh);x.fillStyle='#C9A33A';x.font='800 54px Manrope, sans-serif';x.textBaseline='middle';x.fillText(k,40,hh/2+3);x.fillStyle='#F2EFE2';let fs=62;x.font='800 '+fs+'px Manrope, sans-serif';sp(x,'4px');const mw=x.measureText(n).width,av=w-170;if(mw>av){fs=Math.floor(fs*av/mw);x.font='800 '+fs+'px Manrope, sans-serif'}x.fillText(n,140,hh/2+4)});
['VERIFIED TALENT (TaaS)','PRODUCT ENGINEERING PODs','WORKFORCE CAPABILITY','CAMPUS TALENT FACTORY','ECOSYSTEM AT SCALE'].forEach((n,i)=>{const z=BZ[i];
 box(dA,32,0,z,4,1.1,4.2,{});poly(dA,'ink',[[30.03,0,z-1.8],[30.03,4.2,z-1.8],[30.03,4.2,z+1.8],[30.03,0,z+1.8]]);for(let y=3.3;y<4.2;y+=.3)line(dA,'fine',[30.05,y,z-1.8],[30.05,y,z+1.8]);
 plane(dA,30.1,5.1,z,4.1,.72,{ry:Math.PI/2,mat:amat(dA,0xffffff,1,wideSign(n,'0'+(i+1)))});
 line(dA,'gold',[34,.03,z-.7],[46,.03,z-.7]);line(dA,'gold',[34,.03,z+.7],[46,.03,z+.7]);
 const y=1.1;
 if(i===0)[-1,0,1].forEach(k=>{box(dA,32.2,y,z+k*1.05,.75,.75,.75,{});box(dA,32.2,y+.62,z+k*1.05,.77,.12,.77,{solid:'gold'})});
 if(i===1){box(dA,32.2,y,z,1.3,.9,.9,{});box(dA,32.2,y+.36,z,1.32,.14,.92,{solid:'gold'});[0,1,2,3,4,5].forEach(k=>{const a=k/6*Math.PI*2;hring(dA,'gold',32.2+Math.cos(a)*1.3,y+.02,z+Math.sin(a)*1.3,.18,16)})}
 if(i===2){[[-.9,.3],[0,-.4],[.9,.2],[.2,.9]].forEach(([a,b])=>figure(dA,'stand',32+a*.6,y,z+b*1.2,face(32,z,[50,8,8]),1,1.3));poly(dA,'gold',[[33.6,y+.4,z+1.6],[33.6,y+1.8,z+1.6],[33.6,y+1.5,z+1.3],[33.6,y+1.8,z+1.6],[33.6,y+1.5,z+1.9]])}
 if(i===3){box(dA,32.2,y,z,1.8,.8,1.4,{});poly(dA,'ink',[[33.1,y+.8,z-.7],[33.1,y+1.3,z],[33.1,y+.8,z+.7]],true);for(let k=-.5;k<=.5;k+=.25)line(dA,'fine',[33.12,y,z+k],[33.12,y+.8,z+k]);line(dA,'gold',[33.2,y+.03,z+.9],[33.9,y+.03,z+1.9])}
 if(i===4){const T=[[-.7,-1,1.4],[.4,-.6,.9],[-.3,.5,1.9],[.7,1.1,1.1]];T.forEach(([a,b,hh])=>box(dA,32.2+a,y,z+b,.6,hh,.6,{}));for(let k=0;k<3;k++){const p=T[k],q=T[k+1];let pr=V(32.2+p[0],y+p[2],z+p[1]);for(let j=1;j<=12;j++){const t=j/12,v=V(32.2+p[0]+(q[0]-p[0])*t,y+p[2]+(q[2]-p[2])*t+Math.sin(Math.PI*t)*.6,z+p[1]+(q[1]-p[1])*t);seg(dA,'gold',pr,v);pr=v}}}
});
line(dA,'fine',[37.4,0,2.2],[37.4,2,2.2]);dataPanel(dA,37.4,2.7,2.2,2.2,1.3,face(37.4,2.2,[50,8,8]),'bars');
const BAYFX=BZ.map(z=>{const lm=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const lp=new THREE.Mesh(new THREE.PlaneGeometry(3.6,4.2),lm);lp.position.set(30.06,2.1,z);lp.rotation.y=Math.PI/2;lp.visible=false;factoryG.add(lp);
 const fm=new THREE.MeshBasicMaterial({color:PAPER,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const fp=new THREE.Mesh(new THREE.PlaneGeometry(5.4,6.4),fm);fp.position.set(33.6,3,z+1.2);fp.visible=false;factoryG.add(fp);return{lm,lp,fm,fp,z}});
BZ.forEach((z,i)=>hit('bay'+i,'w0',32,2.6,z,4.6,5.2,4.6));
const shA=area('shelf',{c:V(22,2,-6),full:12,start:22});
[-2.6,-8.9].forEach(z=>line(shA,'ink',[19.2,0,z],[19.2,4.2,z]));[0,1.2,2.4,3.6].forEach(y=>line(shA,'ink',[19.2,y+.02,-2.6],[19.2,y+.02,-8.9]));plane(shA,19.3,4.75,-5.75,3.2,.72,{ry:Math.PI/2,mat:amat(shA,0xffffff,1,roomSign('SHOWROOM · TALENT'))});
figure(shA,'stand',24.5,0,-7.8,face(24.5,-7.8,[29,3.2,-4.5]));line(shA,'gold',[29.8,.03,-3.5],[21,.03,-5.75]);
const UNITS:THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>[]=[];for(let r=0;r<3;r++)for(let c=0;c<4;c++){const m=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:1}),o=new THREE.Mesh(BOX,m);o.scale.set(.7,.8,1.1);o.position.set(19.6,.02+r*1.2+.42,-3.3-c*1.5);const e=new THREE.LineSegments(new THREE.EdgesGeometry(BOX),new THREE.LineBasicMaterial({color:INK,transparent:true,opacity:1}));o.add(e);o.visible=false;factoryG.add(o);UNITS.push(o)}
const NODEN=['PRODUCT/BA','AI/ML','DATA','FULL STACK','CLOUD','CYBER'],PODN=NODEN.map((n,i)=>{const g=new THREE.Group();const s=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.47),new THREE.MeshBasicMaterial({map:roomSign(n),transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));s.position.y=2.1;g.add(s);const rg=new THREE.Mesh(new THREE.RingGeometry(.34,.44,28),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));rg.rotation.x=-Math.PI/2;rg.position.y=.04;g.add(rg);g.visible=false;factoryG.add(g);return{g,s,rg,a:i/6*Math.PI*2}});
// E1 signs of life + spine
const life=area('life',{at:.42});
sitAt(life,-15,0,-3.4,1);sitAt(life,-9.6,0,-3.9,1);figure(life,'stand',-12.4,0,-5.4,face(-12.4,-5.4,[22,10,48]));
sitAt(life,15.6,0,-3.6,-1);sitAt(life,10.2,0,-3.9,-1);figure(life,'point',13,0,-5.6,face(13,-5.6,[22,10,48]),-1);
figure(life,'stand',-19,6,-23,face(-19,-23,[22,10,48]));figure(life,'walk',16.5,6,-23.4,face(16.5,-23.4,[22,10,48]),-1);
const SPY=9.6,SPZ=-4,SPX=[-16,-5.5,5.5,16];
line(life,'gold',[-19,SPY-.95,SPZ],[19,SPY-.95,SPZ]);
const litSign=(n:string)=>ctex(512,128,(x,w,h)=>{x.fillStyle='#C9A33A';x.fillRect(0,0,w,h);x.fillStyle='#0F2B22';x.font='800 60px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');x.fillText(n,w/2,h/2+4)});
const SPM=['DEVELOP','ENGINEER','VERIFY','DEPLOY'].map((n,i)=>{const x=SPX[i];line(life,'gold',[x,SPY-.95,SPZ],[x,SPY-.62,SPZ]);line(life,'fine',[x-1.8,SPY+.62,SPZ],[x-1.8,14.6,SPZ]);line(life,'fine',[x+1.8,SPY+.62,SPZ],[x+1.8,14.6,SPZ]);
 const m=amat(life,0xffffff,1,roomSign(n));m.userData.dark=m.map;m.userData.lit=litSign(n);plane(life,x,SPY,SPZ,5,1.25,{mat:m,tone:'ink'});return m});
const spMk=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),Ym(life));factoryG.add(spMk);
const HOV=([['career',[[0,0,46],[1.2,0,30],[0,0,13],[0,0,4.5]],GOLD,0],['workforce',[[7,0,46],[12,0,30],[20,0,14],[24,0,3.4]],INK,0],['globe',[[0,25.9,-10],[0,48,-10],[0,72,-10]],GOLD,1]] as [string,P3[],THREE.Color,number][]).map(([k,pts,col,up])=>{
 const curve=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)));const geo=up?new THREE.RingGeometry(.55,.7,40):new THREE.CircleGeometry(.34,20);
 const dots=[];for(let i=0;i<(up?5:10);i++){const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.visible=false;factoryG.add(m);dots.push(m)}
 return{k,curve,dots,up,a:0}});
const OUT:[P3,P3][]=[];{const ol=(p:P3,q:P3)=>OUT.push([p,q]);const X=[-30,30],Y=[0,16],Z=[0,-60];
 X.forEach(x=>Y.forEach(y=>ol([x,y,0],[x,y,-60])));X.forEach(x=>Z.forEach(z=>ol([x,0,z],[x,16,z])));Y.forEach(y=>Z.forEach(z=>ol([-30,y,z],[30,y,z])));
 [-20,-10,10,20].forEach(x=>ol([x,0,0],[x,16,0]));ol([-30,5.8,0],[-6.3,5.8,0]);ol([6.3,5.8,0],[30,5.8,0]);ol([-6.3,0,0],[-6.3,8.4,0]);ol([6.3,0,0],[6.3,8.4,0]);ol([-6.3,8.4,0],[6.3,8.4,0]);
 ol([-11,11,.3],[11,11,.3]);ol([-11,13.8,.3],[11,13.8,.3]);ol([-11,11,.3],[-11,13.8,.3]);ol([11,11,.3],[11,13.8,.3]);
 [-18,0,18].forEach(x=>{ol([x-4,17.8,-7],[x+4,17.8,-7]);ol([x-4,16,-7],[x-4,17.8,-7]);ol([x+4,16,-7],[x+4,17.8,-7]);ol([x-4,17.8,-7],[x-4,17.8,-53]);ol([x+4,17.8,-7],[x+4,17.8,-53])});}
// WORKFORCE ROUTE
const ctl=area('ctl',{c:V(24,10,-10),full:14,start:24}),bay=area('bay',{c:V(40,4,-24),full:26,start:38}),acad=area('acad',{c:V(-24,2,-12),full:22,start:32}),uni=area('uni',{c:V(-44,6,-22),full:26,start:40}),pod=area('pod',{c:V(19,2,-28),full:14,start:24}),city=area('city',{hy:[900,901]}),cityArcs=area('cityArcs',{hy:[900,901]});
const lane=(a:Area,pts:P3[],wd:number)=>{const P=lanePts(pts);for(let i=0;i<70;i++){const p=P[i],q=P[i+1],d=q.clone().sub(p).normalize(),n=V(-d.z,0,d.x).multiplyScalar(wd);seg(a,'gold',p.clone().add(n).setY(.03),q.clone().add(n).setY(.03));seg(a,'gold',p.clone().sub(n).setY(.03),q.clone().sub(n).setY(.03));if(i%3===0)seg(a,'gold',p.clone().setY(.03),p.clone().lerp(q,.6).setY(.03))}};
const flowC=document.createElement('canvas');flowC.width=1600;flowC.height=700;const flowX=flowC.getContext('2d')!,flowT=new THREE.CanvasTexture(flowC);flowT.colorSpace=THREE.SRGBColorSpace;flowT.anisotropy=R.capabilities.getMaxAnisotropy();
let flowP=-1;
function drawFlow(p:number){flowP=p;const x=flowX,w=1600,h=700;x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.textBaseline='alphabetic';x.textAlign='left';
  x.fillStyle='#F2EFE2';x.font='800 36px Manrope, sans-serif';sp(x,'6px');x.fillText('FACTORY FLOW',60,100);x.strokeStyle='#F2EFE2';x.lineWidth=3;x.strokeRect(1330,62,210,54);x.fillStyle='#F2EFE2';x.font='800 26px Manrope, sans-serif';sp(x,'5px');x.fillText('SAMPLE',1370,99);x.fillStyle='#C9A33A';x.fillRect(60,122,140,6);
  ([['ASSESSED',12400],['SKILLED',8600],['BUILT',5200],['CERTIFIED',3100]] as [string,number][]).forEach(([n,v],i)=>{const bx=60+i*380,by=220,pi=Math.min(1,Math.max(0,(p-i*.12)/.64)),e=1-Math.pow(1-pi,3);
    x.strokeStyle='#C9A33A';x.lineWidth=4;x.strokeRect(bx,by,320,290);
    x.fillStyle='#F2EFE2';x.font='800 30px Manrope, sans-serif';sp(x,'5px');x.fillText(n,bx+30,by+66);
    x.fillStyle='#C9A33A';x.font='800 76px Manrope, sans-serif';sp(x,'0px');x.fillText(Math.round(v*e).toLocaleString('en-US'),bx+28,by+184);
    x.fillStyle='rgba(242,239,226,.22)';x.fillRect(bx+30,by+232,260,12);x.fillStyle='#C9A33A';x.fillRect(bx+30,by+232,260*(v/12400)*e,12);
    if(i<3){const ax=bx+330,ay=by+145;x.strokeStyle='#C9A33A';x.lineWidth=5;x.beginPath();x.moveTo(ax,ay);x.lineTo(ax+30,ay);x.stroke();x.beginPath();x.moveTo(ax+42,ay);x.lineTo(ax+26,ay-12);x.lineTo(ax+26,ay+12);x.closePath();x.fill()}});
  flowT.needsUpdate=true}
drawFlow(0);document.fonts&&document.fonts.ready.then(()=>drawFlow(Math.max(0,flowP)));
const prodTex=ctex(1440,540,(x,w,h)=>{x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.fillStyle='rgba(242,239,226,.12)';x.fillRect(0,0,w,64);x.fillStyle='#F2EFE2';x.font='800 28px Manrope, sans-serif';sp(x,'5px');x.textBaseline='middle';x.textAlign='left';x.fillText('CLIENT PRODUCT',40,34);
  x.fillStyle='#C9A33A';[0,1,2].forEach(i=>{x.beginPath();x.arc(w-50-i*34,32,9,0,7);x.fill()});
  x.strokeStyle='rgba(242,239,226,.25)';x.lineWidth=2;x.beginPath();x.moveTo(250,64);x.lineTo(250,h);x.stroke();
  x.fillStyle='#C9A33A';[110,150,190,230,270].forEach((y,i)=>x.fillRect(40,y,i?150-i*16:170,10));
  x.strokeStyle='#C9A33A';x.lineWidth=4;[0,1,2].forEach(i=>{x.strokeRect(290+i*380,96,340,110);x.fillRect(314+i*380,126,[180,120,210][i],14);x.globalAlpha=.5;x.fillRect(314+i*380,160,[110,190,90][i],10);x.globalAlpha=1});
  [.4,.62,.5,.8,.7,.92,.66,.85,1,.78].forEach((v,i)=>x.fillRect(300+i*62,h-40-v*230,38,v*230));
  x.lineWidth=5;x.beginPath();[[960,470],[1030,420],[1100,440],[1170,360],[1240,380],[1310,290],[1390,270]].forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.stroke();x.strokeStyle='rgba(242,239,226,.3)';x.lineWidth=2;x.strokeRect(950,250,450,250)});
// Control room
{const cx=24,cz=-10,y=8.5,hh=4.2,x0=19,x1=29,z0=-5,z1=-15;
 box(ctl,cx,y-.3,cz,10,.3,10,{});
 [[x0,z0],[x1,z0],[x0,z1],[x1,z1]].forEach(([x,z])=>box(ctl,x,0,z,.3,y-.3,.3,{solid:'green'}));
 box(ctl,cx,y,cz,10,hh,10,{solid:'none'});
 for(let k=1;k<5;k++){const x=x0+k*2,z=z0-k*2;line(ctl,'fine',[x,y,z0],[x,y+hh,z0]);line(ctl,'fine',[x0,y,z],[x0,y+hh,z]);line(ctl,'fine',[x1,y,z],[x1,y+hh,z])}
 line(ctl,'fine',[x0,y+1,z0],[x1,y+1,z0]);line(ctl,'fine',[x0,y+1,z0],[x0,y+1,z1]);line(ctl,'fine',[x1,y+1,z0],[x1,y+1,z1]);
 plane(ctl,cx,y+hh/2,z1+.02,10,hh,{fill:true});
 plane(ctl,cx,y+2.5,z1+.08,7.6,3.33,{mat:amat(ctl,0xffffff,1,flowT),tone:'ink'});
 box(ctl,cx,y,z1+2.2,6,.8,.9,{});
 figure(ctl,'stand',cx-3.4,y,z1+3.4,Math.PI,1);figure(ctl,'point',cx+3.3,y,z1+3.2,Math.PI,-1);
 plane(ctl,cx,y+hh+.45,z0+.02,3.6,.8,{mat:amat(ctl,0xffffff,1,roomSign('CONTROL ROOM'))});}
// Hire: deployment bay off Certify
{const y=6;
 box(bay,33,y-.3,-29.5,6,.3,5,{});
 [[35.8,-27.2],[35.8,-31.8]].forEach(([x,z])=>box(bay,x,0,z,.3,y-.3,.3,{solid:'green'}));
 line(bay,'fine',[30,y+1,-27],[36,y+1,-27]);line(bay,'fine',[30,y+1,-32],[36,y+1,-32]);for(let x=31;x<=36;x++){line(bay,'fine',[x,y,-27],[x,y+1,-27]);line(bay,'fine',[x,y,-32],[x,y+1,-32])}
 poly(bay,'ink',[[30.04,y,-28],[30.04,y+3.2,-28],[30.04,y+3.2,-31],[30.04,y,-31]]);
 plane(bay,30.04,y+1.6,-29.5,3,3.2,{ry:Math.PI/2,mat:GLm(bay)});
 plane(bay,30.06,y+3.9,-29.5,3,.7,{ry:Math.PI/2,mat:amat(bay,0xffffff,1,roomSign('DEPLOY'))});
 for(let i=0;i<16;i++)box(bay,36+i*.25+.125,y-(i+1)*.375,-29.5,.25,.375,2.4,{tone:'fine'});
 [[31.2,-29],[32.9,-30.1],[34.6,-29.2]].forEach(([x,z])=>{figure(bay,'walk',x,y,z,0,1);box(bay,x+.06,y+1.18,z+.03,.12,.16,.02,{solid:'gold'})});
 lane(bay,[[40,0,-29.5],[44,0,-27],[46.8,0,-21],[48.2,0,-15.4]],.8);
 box(bay,51,0,-14,5,5,4.5,{});
 for(let r=0;r<2;r++)for(let c=0;c<3;c++){const x=49.2+c*1.5,yy=1.9+r*1.4;poly(bay,'fine',[[x-.4,yy,-11.73],[x+.4,yy,-11.73],[x+.4,yy+.8,-11.73],[x-.4,yy+.8,-11.73]],true)}
 poly(bay,'gold',[[48.47,0,-14.6],[48.47,1.9,-14.6],[48.47,1.9,-13.4],[48.47,0,-13.4]]);
 plane(bay,51,4.35,-11.7,2.6,.65,{mat:amat(bay,0xffffff,1,roomSign('CLIENT'))});}
// Workforce Capability: reskilling line (no classroom)
{const x0=-29.6,x1=-19,z0=-5,z1=-19,hh=4.2,cx=(x0+x1)/2,cz=(z0+z1)/2,lx=-24.3,cam=[-9,4.5,-1.5];
 box(acad,cx,0,cz,x1-x0,hh,z0-z1,{solid:'none'});
 for(let z=z0-2;z>z1;z-=2)line(acad,'fine',[x1,0,z],[x1,hh,z]);for(let x=x0+2;x<x1;x+=2)line(acad,'fine',[x,0,z0],[x,hh,z0]);
 line(acad,'fine',[x1,1,z0],[x1,1,z1]);line(acad,'fine',[x0,1,z0],[x1,1,z0]);
 plane(acad,-24.3,hh+.45,z0+.02,4.6,.8,{mat:amat(acad,0xffffff,1,roomSign('RESKILLING LINE'))});
 [-1.4,1.4].forEach(o=>line(acad,'gold',[lx+o,.03,z1+.3],[lx+o,.03,z0-.3]));for(let z=z1+1;z<z0-.3;z+=1)line(acad,'fine',[lx-1.4,.03,z],[lx+1.4,.03,z]);
 ([['BASELINE',-15.4],['RESKILL',-12.1],['APPLY',-8.8]] as [string,number][]).forEach(([n,z])=>{poly(acad,'ink',[[lx-1.8,0,z],[lx-1.8,3,z],[lx+1.8,3,z],[lx+1.8,0,z]]);line(acad,'fine',[lx-1.8,2.65,z],[lx+1.8,2.65,z]);plane(acad,lx,3.45,z,2.4,.6,{ry:face(lx,z,cam),mat:amat(acad,0xffffff,1,roomSign(n))})});}
// Campus: blueprint that slides in and plugs into the Factory
const campus=dynG(V(-50,4,-22),40,62),bridge=dynG(V(-36,6,-22),40,62);
const wideRS=(n:string)=>ctex(1024,150,(x,w,h)=>{x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.fillStyle='#F2EFE2';x.font='800 70px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');const mw=x.measureText(n).width;if(mw>w-50)x.font='800 '+Math.floor(70*(w-50)/mw)+'px Manrope, sans-serif';x.fillText(n,w/2,h/2+4)});
{const cu=campus.a;TG=campus.g;
 poly(cu,'ink',[[-60,.03,-28],[-48,.03,-28],[-48,.03,-16],[-60,.03,-16]],true);for(let x=-58;x<-48;x+=2)line(cu,'fine',[x,.03,-28],[x,.03,-16]);for(let z=-26;z<-16;z+=2)line(cu,'fine',[-60,.03,z],[-48,.03,z]);
 [[-57.5,-19.5],[-51,-25.5]].forEach(([x,z])=>{line(cu,'ink',[x,0,z],[x,1.6,z]);ring(cu,'ink',M(x,2.4,z,Math.PI/2),1.1,28);ring(cu,'fine',M(x,1.9,z,Math.PI/2),.8,24)});
 box(cu,-54,0,-33,18,9,6,{});[3,6].forEach(y=>line(cu,'ink',[-63,y,-29.97],[-45,y,-29.97]));for(let x=-61.5;x<-45;x+=1.5)line(cu,'fine',[x,.3,-29.96],[x,8.7,-29.96]);
 [-60,-57,-51,-48].forEach(x=>cyl(cu,x,9.8,-34,.32,1.6));plane(cu,-54,9.9,-29.9,4.2,.72,{mat:amat(cu,0xffffff,1,roomSign('LAB BLOCK'))});
 box(cu,-63,0,-22,6,6,14,{});box(cu,-63,6,-22,6.6,2.6,11,{solid:'none',tone:'ink'});plane(cu,-63,7.3,-16.45,6.6,2.6,{mat:GLm(cu)});for(let z=-27;z<-16;z+=1.4)line(cu,'fine',[-59.7,6,z],[-59.7,8.6,z]);
 for(let z=-28.5;z<-15;z+=2.2)line(cu,'ink',[-59.97,.3,z],[-59.97,5.7,z]);plane(cu,-63,5.1,-14.95,5.6,.66,{mat:amat(cu,0xffffff,1,roomSign('AI CENTRE OF EXCELLENCE'))});
 box(cu,-45,0,-23,6,.3,10,{});box(cu,-45,5.8,-23,6,.2,10,{});box(cu,-45,9,-23,6.2,.25,10.2,{});[[-48,-28],[-42,-28],[-48,-18],[-42,-18]].forEach(([x,z])=>line(cu,'ink',[x,0,z],[x,9,z]));
 [-26.5,-23,-19.5].forEach(z=>{box(cu,-45,6,z,4.4,2.4,2.6,{solid:'none',tone:'ink'});box(cu,-45,6,z,1.2,.75,.8,{tone:'fine'})});plane(cu,-45,9.7,-17.88,4.6,.66,{mat:amat(cu,0xffffff,1,roomSign('STUDENT POD ROOMS'))});
 box(cu,-45,.3,-23,3.2,2.6,4,{tone:'fine'});
 [-51.4,-48.6].forEach(x=>box(cu,x,0,-20,.4,3.6,.4,{}));box(cu,-50,3.6,-20,3.3,.4,.5,{});ring(cu,'ink',M(-50,2,-20),1,32);plane(cu,-50,4.45,-19.97,2.6,.55,{mat:amat(cu,0xffffff,1,roomSign('ETAF™ GATE'))});
 [-58.4,-56.6].forEach(x=>line(cu,'ink',[x,0,-26.8],[x,1.3,-26.8]));dataPanel(cu,-57.5,2.2,-26.8,3,1.8,0,'lines');plane(cu,-57.5,3.5,-26.78,2.6,.5,{mat:amat(cu,0xffffff,1,roomSign('CURRICULUM'))});
 [-60,-56,-52,-48].forEach(x=>{box(cu,x,0,-14.3,1,1.1,1,{});box(cu,x,1.1,-14.3,1.04,.08,1.04,{solid:'gold'})});[-61.6,-46.4].forEach(x=>line(cu,'ink',[x,0,-15.6],[x,3.4,-15.6]));line(cu,'ink',[-61.6,3.4,-15.6],[-46.4,3.4,-15.6]);
 [-11.4,-12.6].forEach(z=>line(cu,'ink',[-30,.05,z],[-43.4,.05,z]));for(let x=-31;x>-43.5;x-=1)line(cu,'fine',[x,.05,-11.2],[x,.05,-12.8]);[-43.4,-44.6].forEach(x=>line(cu,'ink',[x,.05,-12],[x,.05,-17.5]));
 figure(cu,'walk',-55,0,-21,0,1,1.7);figure(cu,'stand',-52.5,0,-23.5,0,-1,1.7);figure(cu,'point',-58.6,0,-25.6,0,1,1.7);
 TG=bridge.g;const b=bridge.a;
 box(b,-6,5.8,0,12,.2,3,{});box(b,-6,6,0,12,3,3,{solid:'none'});for(let x=-11;x<=-1;x+=1.5){line(b,'ink',[x,6,1.5],[x,9,1.5]);line(b,'fine',[x,6,-1.5],[x,9,-1.5]);line(b,'fine',[x,9,1.5],[x,9,-1.5])}
 plane(b,-6,7.5,1.5,12,3,{mat:GLm(b)});box(b,-6,0,0,.4,5.8,.4,{solid:'green'});plane(b,-8.6,8.55,1.56,6.4,.78,{mat:amat(b,0xffffff,1,wideRS('CAMPUS TALENT FACTORY'))});
 TG=factoryG;bridge.g.position.set(-30,0,-22);}
const HLF=[0,1,2,3].map(()=>new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})),HLE=[0,1,2,3].map(()=>new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false}));
const EDG=new THREE.EdgesGeometry(BOX),hlB=(k:number,x:number,y:number,z:number,w:number,h:number,d:number)=>{const m=new THREE.Mesh(BOX,HLF[k]);m.position.set(x,y,z);m.scale.set(w,h,d);campus.g.add(m);const e=new THREE.LineSegments(EDG,HLE[k]);e.position.copy(m.position);e.scale.copy(m.scale);campus.g.add(e)},hlL=(k:number,pts:THREE.Vector3[])=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),HLE[k]);campus.g.add(l);return l};
hlB(0,-54,4.5,-33,18.3,9.3,6.3);hlB(0,-63,4.3,-22,6.9,8.8,14.3);hlB(0,-57.5,2.2,-26.8,3.3,2.1,.3);
[-11.4,-12.6].forEach(z=>hlL(1,[V(-30,.08,z),V(-43.4,.08,z)]));hlL(1,[V(-44,.08,-12),V(-44,.08,-17.5)]);
const CRM=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false}),CRT=[0,1,2].map(()=>{const m=new THREE.Mesh(BOX,CRM);m.scale.set(1,.8,.8);const e=new THREE.LineSegments(EDG,HLE[1]);m.add(e);campus.g.add(m);return m});
[-26.5,-23,-19.5].forEach(z=>hlB(2,-45,7.2,z,4.5,2.5,2.7));hlB(2,-50,1.9,-20,3.5,4.1,.7);
const NETP=[V(-92,.1,-6),V(-90,.1,-42),V(-72,.1,14),V(-62,.1,-66),V(-30,.1,8)],NETC=NETP.map(p=>{const s=V(-54,.1,-22),mid=s.clone().lerp(p,.5);mid.y+=5;const cv=new THREE.QuadraticBezierCurve3(s,mid,p);hlL(3,cv.getPoints(40));const r=new THREE.Mesh(new THREE.RingGeometry(1,1.3,32),HLF[3]);r.rotation.x=-Math.PI/2;r.position.copy(p);campus.g.add(r);const d=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),CRM.clone());campus.g.add(d);return{cv,d}});
const WLK=[0,1,2].map(i=>{const d=dynG(V(-36,6,-22),40,62);TG=d.g;figure(d.a,'walk',0,0,0,0,1,1.6);TG=factoryG;return d});

const gmat=()=>new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
const bpTex=ctex(640,720,(x,w,h)=>{x.fillStyle='rgba(30,70,50,.10)';x.fillRect(0,0,w,h);x.strokeStyle='rgba(201,163,58,.55)';x.lineWidth=2;for(let i=0;i<=w;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke()}for(let j=0;j<=h;j+=32){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke()}x.fillStyle='#1E4632';x.font='800 22px Manrope, sans-serif';sp(x,'5px');x.fillText('CAMPUS EXTENSION · BLUEPRINT',24,h-24)});
const bpM=new THREE.MeshBasicMaterial({map:bpTex,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),bpP=new THREE.Mesh(new THREE.PlaneGeometry(21.5,24.5),bpM);bpP.rotation.x=-Math.PI/2;bpP.position.set(-53.25,.02,-21.75);
const CONL=['AI CENTRE OF EXCELLENCE','CURRICULUM PATHWAY','FACULTY DEVELOPMENT','STUDENT PODs','LABS','PROBLEM STATEMENTS','ETAF™ VALIDATION','TALENT PIPELINE'],CONP=[[-61,-12],[-57,-12],[-53,-12],[-49,-12],[-45,-14.5],[-45,-18.5],[-45,-26],[-45,-30]];
const CMK_ON=false;// contribution markers are switched off (as in the prototype)
const CMK:CampusMark[]=CMK_ON?CONL.map((n,i)=>{const [x,z]=CONP[i],rm=gmat(),r=new THREE.Mesh(new THREE.RingGeometry(.7,.88,36),rm);r.rotation.x=-Math.PI/2;r.position.set(x,.07,z);campus.g.add(r);const dm=gmat(),d=new THREE.Mesh(new THREE.CircleGeometry(.7,36),dm);d.rotation.x=-Math.PI/2;d.position.set(x,.06,z);campus.g.add(d);
 const sm3=new THREE.MeshBasicMaterial({map:roomSign(n),transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),s=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.7),sm3);s.position.set(x,1.5+(i>3?(i%2)*.9:0),z);campus.g.add(s);return{rm,dm,sm3,s,a:0}}):[];
const ccr=dynG(V(-38,6,-22),40,60);TG=ccr.g;box(ccr.a,0,0,0,1.5,1.1,1.1,{});box(ccr.a,0,.44,0,1.54,.16,1.14,{solid:'gold'});line(ccr.a,'fine',[-.75,0,.56],[.75,1.1,.56]);line(ccr.a,'fine',[.75,0,.56],[-.75,1.1,.56]);plane(ccr.a,0,1.6,0,2.6,.56,{mat:amat(ccr.a,0xffffff,1,roomSign('INDUSTRY PROBLEM'))});TG=factoryG;
// Workforce Capability: team clusters on the reskilling line
const teamName={v:'Finance'},teamTex=ctex(512,128,(x,w,h)=>{x.fillStyle='#1E4632';x.fillRect(0,0,w,h);x.fillStyle='#F2EFE2';x.font='800 56px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'8px');const n=teamName.v.toUpperCase(),mw=x.measureText(n).width;if(mw>w-36)x.font='800 '+Math.floor(56*(w-36)/mw)+'px Manrope, sans-serif';x.fillText(n,w/2,h/2+4)});
const aiTex=goldSign('AI-CAPABLE');
const CLU=[0,1,2].map(k=>{const d=dynG(V(-24,2,-12),22,32);TG=d.g;[[0,0],[-.75,.6],[-.75,-.6]].forEach(([a,c])=>figure(d.a,'walk',a,0,c,0,1,1.45));TG=factoryG;
 const om=gmat(),ring=new THREE.Mesh(new THREE.RingGeometry(1.05,1.22,40),om);ring.rotation.x=-Math.PI/2;ring.position.set(-.4,.05,0);d.g.add(ring);
 [[0,0],[-.75,.6],[-.75,-.6]].forEach(([a,c])=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.14),om);m.position.set(a+.05,1.85,c);d.g.add(m)});
 const sm2=new THREE.MeshBasicMaterial({map:teamTex,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),sg=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.47),sm2);sg.position.set(-.4,2.5,0);d.g.add(sg);
 d.g.rotation.y=-Math.PI/2;return{g:d.g,a:d.a,om,sm2,sg}});
// Ecosystem: flat regional network above the Factory
const NY=28,NET=new THREE.Group();NET.visible=false;factoryG.add(NET);
const netTex=ctex(1040,800,(x,w,h)=>{x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);x.strokeStyle='rgba(30,70,50,.12)';x.lineWidth=2;for(let i=0;i<=w;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke()}for(let j=0;j<=h;j+=40){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke()}x.strokeStyle='#1E4632';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);x.fillStyle='#1E4632';x.font='800 24px Manrope, sans-serif';sp(x,'6px');x.fillText('REGIONAL NETWORK · ILLUSTRATIVE',32,52)});
const plM=new THREE.MeshBasicMaterial({map:netTex,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),plN=new THREE.Mesh(new THREE.PlaneGeometry(52,40),plM);plN.rotation.x=-Math.PI/2;plN.position.set(6,NY,-30);plN.renderOrder=1;NET.add(plN);
const HUBP=V(4,NY,-30);
const ENOD=ECO.nodes.map(([t,x,z,s])=>{const mm=new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),geo=t==='c'?new THREE.CircleGeometry(.95,32):t==='i'?new THREE.PlaneGeometry(1.7,1.7):new THREE.CircleGeometry(1.3,3),m=new THREE.Mesh(geo,mm);m.rotation.x=-Math.PI/2;if(t==='g')m.rotation.z=Math.PI/2;m.position.set(x,NY+.06,z);m.renderOrder=2;NET.add(m);
 const p=V(x,NY+.08,z),mid=HUBP.clone().lerp(p,.5);mid.y+=2.4;const cv=new THREE.QuadraticBezierCurve3(HUBP.clone().setY(NY+.1),mid,p),lm=new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false}),ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(40)),lm);ln.renderOrder=3;NET.add(ln);
 const dm=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false}),d=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),dm);d.renderOrder=4;NET.add(d);return{t,s,mm,lm,dm,d,cv,k:0}});
const hubM=gmat(),hubR=new THREE.Mesh(new THREE.RingGeometry(1.6,2.05,48),hubM);hubR.rotation.x=-Math.PI/2;hubR.position.copy(HUBP).setY(NY+.07);hubR.renderOrder=2;NET.add(hubR);
const hubC=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5),hubM);hubC.rotation.x=-Math.PI/2;hubC.position.copy(hubR.position);NET.add(hubC);
const hubTx=[roomSign('PILOT POD'),roomSign('REGIONAL HUB')],hsM=new THREE.MeshBasicMaterial({map:hubTx[0],transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),hubS=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.15),hsM);hubS.position.set(HUBP.x,NY+2.8,HUBP.z);hubS.renderOrder=5;NET.add(hubS);
const tetM=new THREE.LineBasicMaterial({color:INK,transparent:true,opacity:0}),tet=new THREE.Line(new THREE.BufferGeometry().setFromPoints([HUBP.clone(),V(0,17.9,-30)]),tetM);NET.add(tet);
// Scale: city skyline
{seed=31;const cam=Math.atan2(48,60),CIV:[number,number,string][]=[[-50,-84,'dome'],[56,-86,'bank'],[-78,-2,'bank'],[76,-40,'hospital'],[6,-118,'school'],[-40,36,'school']];
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2+rnd()*.05,r=68+rnd()*40,w=4+rnd()*5,d=4+rnd()*5,hh=6+rnd()*rnd()*34,x=Math.sin(a)*r,z=-30+Math.cos(a)*r;
  if(Math.abs(Math.atan2(Math.sin(a-cam),Math.cos(a-cam)))<.5||Math.abs(Math.atan2(Math.sin(a-.124),Math.cos(a-.124)))<.3||CIV.some(c=>Math.hypot(c[0]-x,c[1]-z)<13))continue;
  box(city,x,0,z,w,hh,d,{ry:a});if(hh>16)line(city,'fine',[x,hh,z],[x,hh+3,z])}
 const tops=CIV.map(([x,z,k])=>{if(k==='dome'){box(city,x,0,z,10,5,10,{});cyl(city,x,6,z,3.2,2);for(let j=0;j<6;j++){const t=j/6*Math.PI/2;hring(city,'ink',x,7+Math.sin(t)*3.2,z,3.2*Math.cos(t))}line(city,'gold',[x,10.2,z],[x,12.5,z]);return V(x,10.4,z)}
  BUILD[k](city,new THREE.Matrix4().compose(V(x,0,z),new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.atan2(-x,-30-z)),V(4,4,4)));return V(x,k==='school'?9.8:7.2,z)});
 const arc=(p:THREE.Vector3,q:THREE.Vector3,lift:number)=>{let pr=p;for(let i=1;i<=40;i++){const t=i/40,v=p.clone().lerp(q,t);v.y+=Math.sin(Math.PI*t)*lift;seg(cityArcs,'gold',pr,v);pr=v}};
 const roof=V(0,16.4,-30);tops.forEach(t=>arc(roof,t,14));
 const ord=tops.map((t,i)=>[Math.atan2(t.x,t.z+30),i]).sort((a,b)=>a[0]-b[0]).map(o=>tops[o[1]]);ord.forEach((t,i)=>arc(t,ord[(i+1)%ord.length],6));}

const FOGU={value:new THREE.Vector2(45,190)};
// BUILD LINE GEOMETRY (merged per area and tone)
const VS=`attribute float lineU;attribute float delay;varying float vU;varying float vD;varying float vDepth;
void main(){vU=lineU;vD=delay;vec4 mv=modelViewMatrix*vec4(position,1.0);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
const FS=`uniform vec3 uColor;uniform vec3 uPaper;uniform float uReveal;uniform vec2 uFog;uniform float uDim;varying float vU;varying float vD;varying float vDepth;
void main(){float r=clamp((uReveal-vD)/0.55,0.0,1.0);if(r<=0.0||vU>r)discard;float f=max(smoothstep(uFog.x,uFog.y,vDepth)*0.92,uDim);gl_FragColor=vec4(mix(uColor,uPaper,f),1.0);
#include <colorspace_fragment>
}`;
VXQ.forEach(({tg,a,c,ms})=>{const g=mergeGeometries(ms.map(m=>BOX.clone().applyMatrix4(m)),false);if(!g)return;const o=new THREE.Mesh(g,vmat(a,c));tg.add(o)});VXQ.clear();
// Batch static helper meshes per (parent, material): ~1000 draws become ~150.
{const groups=new Map<string,THREE.Mesh[]>();const seen=new Set<THREE.Object3D>();S.traverse(o=>{if(!(o as THREE.Mesh).isMesh||!o.userData.b||!o.parent)return;seen.add(o.parent);const m=o as THREE.Mesh,k=o.parent.uuid+'/'+(m.material as THREE.Material).uuid;let g=groups.get(k);if(!g)groups.set(k,g=[]);g.push(m)});
 groups.forEach(ms=>{if(ms.length<2)return;const geo=mergeGeometries(ms.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),false);if(!geo)return;const parent=ms[0].parent!,o=new THREE.Mesh(geo,ms[0].material);o.matrixAutoUpdate=false;ms.forEach(m=>parent.remove(m));parent.add(o)});void seen}
AREAS.forEach(a=>{
  let lo=1e9,hi=-1e9;Object.values(a.L!).forEach(arr=>{for(let i=1;i<arr.length;i+=3){lo=Math.min(lo,arr[i]);hi=Math.max(hi,arr[i])}});const span=Math.max(1,hi-lo);
  Object.entries(a.L!).forEach(([t,arr])=>{if(!arr.length)return;const n=arr.length/6,u=new Float32Array(n*2),dl=new Float32Array(n*2);
    for(let i=0;i<n;i++){if(a.LU){u[i*2]=a.LU[i*2];u[i*2+1]=a.LU[i*2+1]}else u[i*2+1]=1;const d=(a.name==='grid'||a.grow)?0:((arr[i*6+1]+arr[i*6+4])/2-lo)/span*.3+Math.random()*.15;dl[i*2]=dl[i*2+1]=d}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.setAttribute('lineU',new THREE.BufferAttribute(u,1));g.setAttribute('delay',new THREE.BufferAttribute(dl,1));
    (a.parent||factoryG).add(new THREE.LineSegments(g,new THREE.ShaderMaterial({uniforms:{uColor:{value:TONES[t as Tone]},uPaper:{value:PAPER},uReveal:a.u,uFog:FOGU,uDim:(a.dimU||(a.dimU={value:0}))},vertexShader:VS,fragmentShader:FS})));
  });a.L=null;
});
grd.u.value=1;grd.r=1;

// ROUTES
const EXTP=V(22,10,48),EXTL=V(0,6,-8),DOL=EXTP.clone().sub(EXTL).normalize();
const fitExt=()=>{EXTP.set(10,10,50);EXTL.set(-2,6,-8);DOL.copy(EXTP).sub(EXTL).normalize()};fitExt();
const ROUTES:Record<string,Route>={
 career:{wp:[[[22,10,48],[0,6,-8]],[[3,3.6,24],[0,3.4,-10]],[[0,3.2,5],[0,3.8,-20]],[[0,2.6,-3],[0,4.5,-20]],[[0,4.6,-13],[0,7.5,-30]],[[0,8.2,-25],[-6,7.2,-42]],[[-21,8.1,-31.5],[-21,7.6,-44]],[[0,11.5,-12],[0,5.5,-32]],[[-7,8.1,-31.5],[-7,7.6,-44]],[[7,8.1,-31.5],[7,7.6,-44]],[[16,5,-14],[20,2,-30]],[[26,3.2,-22.8],[21.5,1.3,-32.5]],[[19.6,3.2,-22.8],[15.1,1.3,-32.5]],[[13.2,3.2,-22.8],[8.7,1.3,-32.5]],[[6.8,3.2,-22.8],[2.3,1.3,-32.5]],[[0.3999999999999999,3.2,-22.8],[-4.1,1.3,-32.5]],[[-6,3.2,-22.8],[-10.5,1.3,-32.5]],[[-2,8.5,-15],[10,8,-32]],[[12,9.5,-20],[19,7.5,-36]],[[21,8.1,-31.5],[21,7.6,-44]],[[10,12.5,-4],[30,6,-28]],[[27,11,8],[36,6,-20]],[[46,10,6],[38,5,-26]]],stops:[2,6,7,8,9,11,19,22]},
 workforce:{wp:[[[50,8,8],[30,2.5,-15]],[[50,8,8],[30,2.5,-15]]],stops:[0]}
};
[11,12,13,14,15,16,22].forEach(i=>{const w=ROUTES.career.wp[i];w[0][0]=w[1][0]});
Object.values(ROUTES).forEach(r=>{r.pc=new THREE.CatmullRomCurve3(r.wp.map(w=>V(...w[0])),false,'centripetal');r.lc=new THREE.CatmullRomCurve3(r.wp.map(w=>V(...w[1])),false,'centripetal')});
const sm=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
const look=V(0,0,0),tmp=V(0,0,0),lt=V(0,0,0),snapP=V(0,0,0),snapL=V(0,0,0);let lastT=performance.now();
const Rcur=R0.clone(),ONE=V(1,1,1),TMPM=new THREE.Matrix4(),T30=new THREE.Matrix4().makeTranslation(0,0,30);
const G:SceneState={fogB:0,actor:0,hlA:[0,0,0,0],gsel:-1,gdE:0,dist:0,wf:false,bayHv:-1,baySel:[],stop:-1,cam:{t0:-1},cc:{t0:-1},act:[0,1,4],con:-1,net:{sec:0,act:{c:1,i:1,g:1},mode:0,links:[]},netA:0,bayDim:[],units:[],pod:{on:false,t0:0},podGv:-1,podLead:[],crate:null,ticks:[],walk:false,et:{on:false,t0:0},gl:null,car:0,sample:false,sh:0,shE:0,hover:null,spine:false,spT0:0,fs:1,gV:0,arcs:0,done:false,dir:null,focus:null,panel:0,panelE:0,A:null,B:null,podK:0,podI:0,podTA:0,podAE:0};
const PODS3=[['For students','Build real products. Leave with proof.'],['For universities','Industry PODs on your campus.'],['For startups','Get a product built. Meet the people who built it.']];
const PIV=V(0,0,-10),PA=[-.5,0,.5],PRAD=31,PCAM=52;
const PPOS=[[-15,19],[0,21],[15,19]];
const podCam=(k:number)=>{const x=-15+15*k;return{p:V(x,8.5,42),l:V(x,3.6,15)}};
G.podK=0;G.podI=0;G.podTA=0;G.podAE=0;
const POD3=PODS3.map(([h,s],i)=>{const g=new THREE.Group();g.position.set(PPOS[i][0],0,PPOS[i][1]);
  const fill=new THREE.MeshBasicMaterial({color:PAPER,transparent:true,opacity:0}),ink=new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:0}),gold=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0}),line=new THREE.LineBasicMaterial({color:INK,transparent:true,opacity:0});
  const add=(w:number,h2:number,d:number,y:number,m:THREE.Material,edge:boolean)=>{const geo=new THREE.BoxGeometry(w,h2,d),me=new THREE.Mesh(geo,m);me.position.y=y;g.add(me);if(edge){const l=new THREE.LineSegments(new THREE.EdgesGeometry(geo),line);l.position.y=y;g.add(l)}};
  add(8.2,.32,4.6,.16,ink,false);add(7.6,5.2,4,.32+2.6,fill,true);add(7.6,.36,4,5.52+.18,gold,true);
  const el=document.createElement('button');el.type='button';el.className='podL';el.dataset.pod=String(i);el.innerHTML='<b>'+h+'</b><span>'+s+'</span>';el.setAttribute('aria-label',h+'. '+s);el.style.display='none';CAMEL.appendChild(el);
  const o=new CSS3DObject(el);o.position.set(0,2.95,2.02);o.scale.setScalar(.0098);g.add(o);g.visible=false;S.add(g);
  return{g,o,el,mats:[fill,ink,gold,line],c:0}});
function podsTick(mode:string,dt:number){
  if(mode!=='intro')G.podTA=0;
  G.podAE+=(G.podTA-G.podAE)*(reduce?1:Math.min(1,dt*(G.podTA>G.podAE?3:8)));
  const A=G.podAE;
  POD3.forEach((p,i)=>{const on=A>.01;p.g.visible=on;p.o.visible=on;if(!on){p.el.style.pointerEvents='none';return}
    const c=Math.max(0,1-Math.abs(G.podK-i)),op=A*(.42+.58*c);
    p.mats[0].opacity=op;p.mats[1].opacity=op;p.mats[2].opacity=op;p.mats[3].opacity=op;
    p.el.style.opacity=op.toFixed(3);p.el.style.pointerEvents=A>.6?'auto':'none';p.el.tabIndex=A>.6?0:-1;
    p.g.rotation.y=Math.atan2(C.position.x-p.g.position.x,C.position.z-p.g.position.z)})}
window.FACTORY={
  stops:r=>ROUTES[r].stops,
  podPose(b,i){const now=performance.now(),dt=Math.min(.1,(now-(G.podT||now))/1000);G.podT=now;G.podI=i;G.podK=reduce?i:G.podK+(i-G.podK)*Math.min(1,dt*3.2);if(Math.abs(G.podK-i)<.002)G.podK=i;G.podTA=b>0?1:0;G.podB=b;if(b<=0)return;const q=podCam(G.podK);C.position.lerp(q.p,b);look.lerp(q.l,b)},
  podEls:()=>POD3.map(p=>p.el),podCentre:()=>Math.round(G.podK),
  fromSnap(e){const p=C.position.clone(),l=look.clone();C.position.lerpVectors(snapP,p,e);look.lerpVectors(snapL,l,e)},
  poseIntro(d=0){C.position.copy(EXTP).addScaledVector(DOL,d*12);C.position.y+=d*2;look.copy(EXTL)},
  poseFly(r,e){const w=ROUTES[r].wp[0];C.position.lerpVectors(EXTP,V(...w[0]),e);look.lerpVectors(EXTL,V(...w[1]),e)},
  setHover(k){G.hover=k},poseAt(p,l){C.position.set(p[0],p[1],p[2]);look.set(l[0],l[1],l[2])},
  setWf(on){G.wf=on},setBays(hv,sel,dim){G.bayHv=hv;G.baySel=sel;G.bayDim=dim},setUnits(u){G.units=u},setTeam(n){if(teamName.v!==n){teamName.v=n;teamTex.redraw()}},wfStop(i){G.stop=i},campusIn(r){if(G.cam.t0<0||r){G.cam.t0=performance.now();G.cc.t0=-1}},podCross(){G.cc.t0=Math.max(performance.now(),G.cam.t0+2700)},setCampus(a,c){G.act=a;G.con=c},setActor(i){G.actor=i},setNet(o){G.net=o},
  pod(on){if(on&&!G.pod.on)G.pod.t0=performance.now();G.pod.on=on},setPodLead(l){G.podLead=l},podJump(i){G.pod.on=true;G.pod.t0=performance.now()-(4200+i*2600)},podG(){return G.pod.on?G.podGv:-1},podTime(){return G.pod.on?(performance.now()-G.pod.t0)/1000:0},setCrate(g){G.crate=g},setTicks(a){G.ticks=a},setWalk(on){G.walk=on},
  rayWhat(a,b){const A=V(...a),dir=V(...b).sub(A),len=dir.length();dir.normalize();factoryG.updateMatrixWorld(true);const rc=new THREE.Raycaster(A,dir,0,len);const nm=new THREE.Vector3();return rc.intersectObject(factoryG,true).filter(h=>(h.object as THREE.Mesh).isMesh&&h.face).slice(0,4).map(h=>{const m=h.object as THREE.Mesh;let vis=true;for(let o:THREE.Object3D|null=m;o;o=o.parent)if(!o.visible)vis=false;nm.copy(h.face!.normal).transformDirection(m.matrixWorld);const mat=m.material as THREE.MeshBasicMaterial;return {p:[h.point.x,h.point.y,h.point.z].map(v=>+v.toFixed(2)),vis,ny:+nm.y.toFixed(2),geo:(m.geometry as THREE.BufferGeometry).type,op:mat.opacity,tr:mat.transparent,cw:mat.colorWrite,dw:mat.depthWrite,size:(()=>{(m.geometry as THREE.BufferGeometry).computeBoundingBox();const b=(m.geometry as THREE.BufferGeometry).boundingBox!;return [b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z].map(v=>+v.toFixed(1))})()}})},
  rayHits(a,b){const A=V(...a),dir=V(...b).sub(A),len=dir.length();if(len<1e-4)return [];dir.normalize();factoryG.updateMatrixWorld(true);const rc=new THREE.Raycaster(A,dir,0,len);const skip=(o:THREE.Object3D|null):boolean=>{for(;o;o=o.parent)if(o.userData.noRay)return true;return false};const nm=new THREE.Vector3();return rc.intersectObject(factoryG,true).filter(h=>{const m=h.object as THREE.Mesh;if(!m.isMesh||!h.face||skip(m))return false;nm.copy(h.face.normal).transformDirection(m.matrixWorld);return Math.abs(nm.y)<.6}).map(h=>({p:[+h.point.x.toFixed(2),+h.point.y.toFixed(2),+h.point.z.toFixed(2)] as P3,d:+h.distance.toFixed(2)}))},
  obstacles(y0,y1){factoryG.updateMatrixWorld(true);const walls:number[]=[],floor:number[]=[],low:number[]=[],high:number[]=[],highY:number[]=[];const a=V(),b=V(),c=V(),e1=V(),e2=V(),n=V();const skip=(o:THREE.Object3D|null):boolean=>{for(;o;o=o.parent)if(o.userData.noRay)return true;return false};
    factoryG.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||!m.visible||skip(m))return;const g=m.geometry as THREE.BufferGeometry,pos=g.getAttribute('position');if(!pos)return;const idx=g.getIndex(),cnt=idx?idx.count:pos.count,M=m.matrixWorld;
      for(let i=0;i+2<cnt;i+=3){a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(M);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(M);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(M);
        const lo=Math.min(a.y,b.y,c.y),hi=Math.max(a.y,b.y,c.y);e1.subVectors(b,a);e2.subVectors(c,a);n.crossVectors(e1,e2);const L=n.length();if(L<1e-9)continue;const ny=Math.abs(n.y/L);
        if(ny>.9&&lo>y0-.6&&hi<y0+.2){floor.push(a.x,a.z,b.x,b.z,c.x,c.z);continue}
        if(hi<y0||lo>y1||ny>.6)continue;const P=[a,b,c];let best=-1,p=0,q=1;for(const [s,t] of [[0,1],[0,2],[1,2]]){const d=(P[s].x-P[t].x)**2+(P[s].z-P[t].z)**2;if(d>best){best=d;p=s;q=t}}walls.push(P[p].x,P[p].z,P[q].x,P[q].z)}});
    // Line-art walls: outline edges on the floor and at head height (a wall is a floor edge with a matching edge above it).
    const p1=V(),p2=V();factoryG.traverse(o=>{const ln=o as THREE.LineSegments;if(!(ln as unknown as {isLine?:boolean}).isLine||!ln.visible||skip(ln))return;const pos=(ln.geometry as THREE.BufferGeometry).getAttribute("position");if(!pos)return;const pairs=(ln as unknown as {isLineSegments?:boolean}).isLineSegments;const M=ln.matrixWorld;
      for(let i=0;i+1<pos.count;i+=pairs?2:1){p1.fromBufferAttribute(pos,i).applyMatrix4(M);p2.fromBufferAttribute(pos,i+1).applyMatrix4(M);if(Math.abs(p1.y-p2.y)>.05||Math.hypot(p1.x-p2.x,p1.z-p2.z)<.8)continue;const y=(p1.y+p2.y)/2;if(y>y0-.45&&y<y0-.05)low.push(p1.x,p1.z,p2.x,p2.z);else if(y>y0+1.6&&y<y0+5){high.push(p1.x,p1.z,p2.x,p2.z);highY.push(+y.toFixed(2))}}});
    return {walls,floor,low,high,highY}},
  rayBatch(segs,walls){factoryG.updateMatrixWorld(true);const rc=new THREE.Raycaster(),A=V(),D=V(),nm=new THREE.Vector3();const skip=(o:THREE.Object3D|null):boolean=>{for(;o;o=o.parent)if(o.userData.noRay)return true;return false};return segs.map(([a,b])=>{A.set(...a);D.set(...b).sub(A);const len=D.length();if(len<1e-4)return false;D.normalize();rc.set(A,D);rc.far=len;return rc.intersectObject(factoryG,true).some(h=>{const m=h.object as THREE.Mesh;if(!m.isMesh||!h.face||skip(m))return false;nm.copy(h.face.normal).transformDirection(m.matrixWorld);return walls?Math.abs(nm.y)<.6:Math.abs(nm.y)>.6})})},
  etaf(on){if(on&&!G.et.on)G.et.t0=performance.now();G.et.on=on},etafLit(){return GATES.filter(g=>g.lit).length},
  glance(i){G.gl={p:SRC[i].clone(),i,t0:performance.now()}},
  pick(cx,cy,stop){NDC.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);RAY.setFromCamera(NDC,C);const hs=RAY.intersectObjects(HIT.filter(m=>m.userData.stop===stop),false);return hs.length?hs[0].object.userData.k:null},setCareer(f,s,sh){G.car=f;G.sample=s;G.sh=sh},setSpine(on){if(on&&!G.spine)G.spT0=performance.now();G.spine=on},outline:()=>OUT,
  poseRoute(r,k){const Q=ROUTES[r],u=Math.min(1,Math.max(0,k/(Q.wp.length-1)));Q.pc!.getPoint(u,C.position);Q.lc!.getPoint(u,look)},
  snapshot(){snapP.copy(C.position);snapL.copy(look)},
  poseBack(t){const e=sm(0,1,t);const q=podCam(G.podK);C.position.lerpVectors(snapP,q.p,e);C.position.y+=Math.sin(Math.PI*e)*8;look.lerpVectors(snapL,q.l,e)},
  render(mode,introS){
    if(innerHeight>0&&!(Math.abs(C.aspect-innerWidth/innerHeight)<=1e-4)){fitExt();C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight,false);CR.setSize(innerWidth,innerHeight)}
    const now=performance.now(),dt=Math.min(.1,(now-lastT)/1000);lastT=now;podsTick(mode,dt);
    if(G.focus){const k=reduce?1:Math.min(1,(now-G.focus.t0)/900);Rcur.slerpQuaternions(G.focus.q0,G.focus.q1,sm(0,1,k));if(k>=1)G.focus=null}
    if(G.done)G.arcs=Math.min(1,G.arcs+dt*(reduce?9:.6));
    G.panelE+=((G.panel?1:0)-G.panelE)*Math.min(1,dt*5);
    globeG.quaternion.copy(Rcur);
    factoryG.matrix.compose(GC,Rcur,ONE).multiply(TMPM.compose(NF.clone().multiplyScalar(GR),QF,V(G.fs,G.fs,G.fs))).multiply(T30);factoryG.matrixWorldNeedsUpdate=true;
    gSphere.visible=G.gV>.001;
    const hf=Math.max(0,C.position.y-18);G.fogB+=((G.wf&&G.stop===4?1:0)-G.fogB)*Math.min(1,dt*2);const fog=S.fog as THREE.Fog;fog.near=45+G.gV*70+hf*2+G.fogB*80;fog.far=190+G.gV*220+hf*5+G.fogB*160;FOGU.value.set(fog.near,fog.far);
    G.shE+=(G.sh-G.shE)*Math.min(1,dt*3);lt.copy(look);if(G.shE>.001){tmp.copy(lt).sub(C.position);const dd=tmp.length(),tx=Math.tan(C.fov*Math.PI/360)*Math.min(1.9,Math.max(1.3,C.aspect));tmp.normalize().cross(C.up).normalize();lt.addScaledVector(tmp,G.shE*dd*tx/3)}if(G.done)lt.x+=G.panelE*6;if(!reduce){lt.x+=mx*(G.done?.3:1.2);lt.y-=my*(G.done?.15:.6)}if(!reduce&&mode==='intro'){lt.x+=Math.sin(now/5200)*.5;lt.y+=Math.sin(now/7400)*.2}if(G.gl){const t=(performance.now()-G.gl.t0)/3400,w=sm(0,.28,t)*(1-sm(.72,1,t));lt.lerp(G.gl.p,w);if(t>=1)G.gl=null}C.lookAt(lt);
    if(G.pod.on){const te=(now-G.pod.t0)/1000;if(te<2.2)G.podGv=-1+sm(0,2.2,te);else if(te<4.2)G.podGv=0;else{const x=(te-4.2)/2.6,i=Math.floor(x);G.podGv=Math.min(5,i+sm(.35,.75,x-i))}}
    BAYFX.forEach((b,i)=>{const on=G.wf;b.lp.visible=b.fp.visible=on;if(!on)return;const lit=G.bayHv===i||G.baySel.includes(i);b.lm.opacity+=((lit?.38:0)-b.lm.opacity)*Math.min(1,dt*6);b.fm.opacity+=((G.bayDim.includes(i)?.72:0)-b.fm.opacity)*Math.min(1,dt*5);b.fp.lookAt(C.position)});
    UNITS.forEach((u,i)=>{u.visible=G.wf;const d=G.units[i];if(!d||!G.wf)return;u.material.color.set(d.state==='Available'?GOLD:d.state==='Deployed'?INK:PAPER);const op=d.off?.12:1;u.material.opacity=op;u.position.x+=((19.6+(d.grp?.55:0))-u.position.x)*Math.min(1,dt*6);(u.children[0] as THREE.LineSegments<THREE.EdgesGeometry,THREE.LineBasicMaterial>).material.opacity=op});
    {const cg=G.pod.on?G.podGv:G.crate,on=cg!==null&&cg!==undefined;crate.g.visible=on;mentor.g.visible=on&&!G.pod.on;if(on){const g=cg;let x;if(g<0)x=FX[0]+(-g)*9.5;else{const i=Math.min(4,Math.floor(g)),f=g-i;x=FX[i]+(FX[i+1]-FX[i])*f}crate.g.position.set(x,0,FZ);mentor.g.position.set(x+2.3,0,-27.4);mentor.g.rotation.y=Math.atan2(C.position.x-mentor.g.position.x,C.position.z-mentor.g.position.z)}
     TICKS.forEach((m,i)=>{m.visible=G.car>=0&&G.ticks.includes(i);m.rotation.y=now/900});
     {const tp=G.pod.on?(now-G.pod.t0)/1000:0;PODN.forEach((n,i)=>{const on=G.pod.on&&G.podGv>=-.2;n.g.visible=on;if(!on)return;const a=sm(2.2+i*.3,2.8+i*.3,tp);n.g.position.set(crate.g.position.x+Math.cos(n.a)*2.3*(2-a),0,FZ+Math.sin(n.a)*2.3*(2-a));const ld=G.podLead.includes(i),k=G.podLead.length?(ld?1:.45):1;n.s.material.opacity=a*k;n.rg.material.opacity=a*k;const tg=ld?1.7:1;n.rg.scale.setScalar(n.rg.scale.x+(tg-n.rg.scale.x)*Math.min(1,dt*6));n.s.scale.setScalar(ld?1.15:1);n.s.lookAt(C.position)})}
     CLU.forEach((c,k)=>{c.g.visible=G.wf;if(!G.wf)return;const u=((now/15000)+k/3)%1,z=-18.6+u*13.4,s=reduce?1:sm(0,.05,u)*(1-sm(.95,1,u));c.g.position.set(-24.3,0,z);c.g.scale.setScalar(Math.max(.001,s));const ov=sm(-9.2,-8.2,z);c.om.opacity=ov*.95*c.a.r;const want=ov>.5?aiTex:teamTex;if(c.sm2.map!==want){c.sm2.map=want;c.sm2.needsUpdate=true}c.sm2.opacity=c.a.r;c.sg.lookAt(C.position)});
     {const t=G.cam.t0<0?-1:(now-G.cam.t0)/1000,on=G.wf&&t>=0;campus.g.visible=bridge.g.visible=on;WLK.forEach(w=>w.g.visible=false);if(on){const e=reduce?1:sm(0,1.8,t),e2=reduce?1:sm(1.6,2.6,t),r=campus.a.r;campus.g.position.x=-26*(1-e);bridge.g.scale.x=Math.max(.001,e2);bridge.g.visible=e2>.002;bpM.opacity=.95*r;
       CMK.forEach((m,i)=>{const lit=G.act.includes(i),f=G.con===i;m.a+=((lit?1:0)-m.a)*Math.min(1,dt*5);m.rm.opacity=(.3+.7*m.a)*r*e;m.dm.opacity=(m.a*.22+(f?.35+.25*Math.sin(now/260):0))*r*e;m.sm3.opacity=Math.max(m.a,f?1:0)*r*e;m.s.visible=false;m.s.lookAt(C.position)});
       for(let k=0;k<4;k++){G.hlA[k]+=((G.actor===k?1:0)-G.hlA[k])*Math.min(1,dt*4);const a=G.hlA[k]*r*e;HLF[k].opacity=(k===3?.9:.2)*a;HLE[k].opacity=.95*a}
       const ia=G.hlA[1]*r*e;CRM.opacity=.85*ia;CRT.forEach((c,i)=>{const u=((now/6000)+i/3)%1;c.visible=ia>.02;if(u<.75){const f=u/.75;c.position.set(-30-13.4*f,.5,-12)}else{const f=(u-.75)/.25;c.position.set(-44,.5,-12-5.5*f)}c.scale.setScalar(1).multiply(V(1,.8,.8)).multiplyScalar(Math.max(.001,sm(0,.05,u)*(1-sm(.95,1,u))))});
       const ga=G.hlA[3]*r*e;NETC.forEach((n,i)=>{n.d.material.opacity=ga;n.d.visible=ga>.02&&!reduce;if(n.d.visible)n.cv.getPointAt(((now/2600)+i*.21)%1,n.d.position)});
       WLK.forEach((w,i)=>{const on2=e2>.98;w.g.visible=on2;if(!on2)return;const u=((now/(9000+i*1400))+i*.37)%1,dir=i%2?-1:1,x=dir>0?-30.8-10.4*u:-41.2+10.4*u;w.g.position.set(x,6,-22+(i-1)*.7);w.g.rotation.y=dir>0?Math.PI:0})}
      const ct=G.cc.t0<0?-1:(now-G.cc.t0)/1000,cOn=on&&ct>=0&&ct<3.9;ccr.g.visible=cOn;if(cOn){const e=reduce?1:sm(0,3.2,ct),sc=1-sm(3.2,3.9,ct);ccr.g.position.set(-30-15*e,6.05,-22);ccr.g.scale.setScalar(Math.max(.001,sc))}}
     {const tg=G.wf&&G.stop===5?1:0;G.netA+=(tg-G.netA)*Math.min(1,dt*(reduce?99:2.5));const A=G.netA;NET.visible=A>.01;if(NET.visible){const N=G.net;plM.opacity=.9*A;hubM.opacity=A;hsM.opacity=A;if(hsM.map!==hubTx[N.mode]){hsM.map=hubTx[N.mode];hsM.needsUpdate=true}hubS.lookAt(C.position);tetM.opacity=.45*A;
       ENOD.forEach((n,i)=>{const on=N.act[n.t],inS=n.s.includes(N.sec),ln=N.links.includes(i);n.k+=((ln?1:0)-n.k)*Math.min(1,dt*4);n.mm.color.copy(ln?GOLD:INK);n.mm.opacity=A*(on?(inS?1:.3):.08);n.lm.opacity=A*n.k*.95;n.dm.opacity=A*n.k;n.d.visible=n.k>.05&&!reduce;if(n.d.visible)n.cv.getPointAt(((now/2400)+i*.137)%1,n.d.position)})}}
     WALK.forEach((w,i)=>{w.g.visible=G.walk;if(!G.walk)return;const u=((now/11000)+i/3)%1,p=walkC.getPointAt(u),d=walkC.getTangentAt(u);w.g.position.copy(p);w.g.rotation.y=Math.atan2(-d.z,d.x)});
     const et=G.et,te=(now-et.t0)/1000;GATES.forEach((g,i)=>{const st=i*.55,tr=2.6,raw0=et.on?(te-st)/tr:-1;g.lit=et.on&&raw0>=1;const want=g.lit?g.sm2.userData.lit:g.sm2.userData.dark;if(g.sm2.map!==want)g.sm2.map=want;g.lm.opacity+=(((g.lit?.32:0))-g.lm.opacity)*Math.min(1,dt*4);
      const hl=G.gl&&G.gl.i===i;g.ln.visible=et.on;g.lnM.opacity=hl?.95:.28;g.dots.forEach((d,j)=>{const raw=raw0-j/7;d.visible=et.on&&raw>=0;if(!d.visible)return;const u=raw%1;g.cv.getPointAt(u,d.position);const sc=hl?1.8:1;d.scale.set(sc,sc,sc)});g.dm.opacity=et.on?.95:0});}
    HOV.forEach(o=>{o.a+=((G.hover===o.k?1:0)-o.a)*Math.min(1,dt*6);o.dots.forEach((d,i)=>{d.visible=o.a>.01;if(!d.visible)return;const u=(now/(o.up?1700:2600)+i/o.dots.length)%1;o.curve.getPointAt(u,d.position);if(!o.up)d.position.y=.07;else{const s=1+u*2.2;d.scale.set(s,s,s)}d.material.opacity=o.a*Math.sin(Math.PI*u)*.95})});
    {const on=mode==='route'&&G.car>0;frostM.opacity=.62*G.car;recM.opacity=.28*G.car;gateM.opacity=(.16+.1*Math.sin(now/420))*G.car;COR.forEach((o,i)=>{o.visible=on;o.material=G.sample&&i===1?recM:frostM});GATE.visible=on;
     const inR=mode==='route';scanR.visible=inR;if(inR){scanR.position.y=6.4+(Math.sin(now/650)*.5+.5)*2.2}}
    SPM.forEach((m,i)=>{const t=G.spine&&now-G.spT0>i*380?m.userData.lit:m.userData.dark;if(m.map!==t)m.map=t});
    spMk.position.set(-19+((now/5200)%1)*38,SPY-.95,SPZ);
    G.gdE+=((G.gsel>=0&&G.gV>.5?1:0)-G.gdE)*Math.min(1,dt*4);[gA,gRim,gArc].forEach(a=>{if(a.dimU)a.dimU.value=.8*G.gdE});selR.visible=G.gsel>=0&&G.gV>.5;if(selR.visible){const n=NODES[G.gsel].n;selR.position.copy(n).multiplyScalar(GR+.12);selR.quaternion.setFromUnitVectors(V(0,0,1),n);selM.opacity=.95*G.gdE}
    const im=mode==='intro'||mode==='globe';
    AREAS.forEach(a=>{
      if(a===grd)a.r=1-sm(0,.5,G.gV);
      else if(a===brand.skyline)a.r=1-sm(.75,1,G.gV);
      else if(a===gA)a.r=G.gV;
      else if(a===gRim)a.r=G.done?sm(0,.35,G.arcs):Math.min(a.r,G.gV);
      else if(a===gArc)a.r=G.done?G.arcs:Math.min(G.arcs,G.gV);
      // The civic city ring is part of the visible city now (its paper fills always occluded anyway).
      else if(a===city)a.r=Math.max(G.dist,1-sm(.75,1,G.gV));
      else if(a===cityArcs)a.r=G.dist;
      else if(a.at!==undefined)a.r=mode==='intro'?(reduce?(introS>=a.at-.6?1:0):sm(a.at-.95,a.at-.05,introS)):1;
      else if(a.hy){const tg=im?0:sm(a.hy[0],a.hy[1],C.position.y);a.r=reduce?tg:a.r+(tg-a.r)*Math.min(1,dt*2.2)}
      else{const tg=im?0:1-sm(a.full!,a.start!,C.position.distanceTo(a.c!));
        if(reduce)a.r=im?0:Math.max(a.r,tg>.3?1:0);
        else if(tg>a.r)a.r=Math.min(tg,a.r+dt*1.1);
        else if(im)a.r=Math.max(0,a.r-dt*1.6);}
      a.u.value=a.r;a.mats.forEach(m=>{const op=m.userData.base*a.r;m.opacity=op;m.visible=a.r>.002;
        // Fully revealed solids draw in the opaque pass (hundreds of sorted transparent draws were the frame-rate cost).
        const tr=op<.999||m.blending!==THREE.NormalBlending||m.depthWrite===false;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}})});
    brand.tick(now,dt);
    R.render(S,C);CR.render(S,C);
  },
  globeBegin(dir){G.dir=dir;G.done=false;G.focus=null;G.panel=0;G.A={p:C.position.clone(),l:lt.clone(),s:G.fs,q:Rcur.clone()};G.B=dir==='in'?{p:GPOS,l:GLOOK,s:SF,q:Rg}:{p:EXTP,l:EXTL,s:1,q:R0};if(dir==='in'){const a=G.A;G.cp=new THREE.CatmullRomCurve3([a.p.clone(),V(2,31,-4),V(0,62,-18),GPOS.clone()],false,'centripetal');G.cl=new THREE.CatmullRomCurve3([a.l.clone(),V(0,26.4,-10),V(0,4,-30),GLOOK.clone()],false,'centripetal')}},
  globeStep(t){const A=G.A!,B=G.B!;if(G.dir==='in'){const e=sm(0,1,t),e2=sm(.3,.92,t);G.cp!.getPoint(e,C.position);G.cl!.getPoint(e,look);G.fs=Math.exp(Math.log(A.s)+(Math.log(B.s)-Math.log(A.s))*e2);Rcur.slerpQuaternions(A.q,B.q,sm(.42,.95,t));G.gV=sm(.42,.88,t);G.dist=sm(.1,.3,t)*(1-sm(.6,.8,t));return}G.dist=0;const e=sm(0,1,t),e2=sm(.1,.9,t);C.position.lerpVectors(A.p,B.p,e);C.position.y+=Math.sin(Math.PI*e)*(G.dir==='in'?14:8);look.lerpVectors(A.l,B.l,e);G.fs=Math.exp(Math.log(A.s)+(Math.log(B.s)-Math.log(A.s))*e2);Rcur.slerpQuaternions(A.q,B.q,e2);G.gV=G.dir==='in'?sm(.3,.9,t):Math.min(G.gV,1-sm(.05,.55,t))},
  globeArrive(){G.done=true;C.position.copy(GPOS);look.copy(GLOOK)},
  globeHold(){C.position.copy(GPOS);look.copy(GLOOK)},
  globeReset(){G.dist=0;G.fs=1;Rcur.copy(R0);G.gV=0;G.arcs=0;G.done=false;G.dir=null;G.panel=0;G.panelE=0},
  setPanel(v){G.panel=v},setSel(i){G.gsel=i},
  css(el,par){const o=new CSS3DObject(el);el.style.userSelect='text';el.style.display='none';CAMEL.appendChild(el);(par==='campus'?campus.g:par==='net'?NET:par==='world'?S:factoryG).add(o);return o},
  cam(){return C},routeWP(r,s){const Q=ROUTES[r];return Q.wp[Q.stops[s]]},brandIcons(){return brand.icons},addWorld(o){factoryG.add(o)},routePose(r,k){const Q=ROUTES[r],u=Math.min(1,Math.max(0,k/(Q.wp.length-1))),p=Q.pc!.getPoint(u),l=Q.lc!.getPoint(u);return[[p.x,p.y,p.z],[l.x,l.y,l.z]]},
  fitBoard(o,p,l,pxW){const P=V(...p),L=V(...l),f=L.clone().sub(P),d=f.length(),ty=Math.tan(C.fov*Math.PI/360),tx=ty*Math.min(1.9,Math.max(1.3,innerWidth/innerHeight));f.normalize();const r=f.clone().cross(V(0,1,0)).normalize();L.addScaledVector(r,d*tx/3);const f2=L.sub(P).normalize(),r2=f2.clone().cross(V(0,1,0)).normalize(),u=r2.clone().cross(f2),D=Math.min(d*.8,13);o.position.copy(P).addScaledVector(f2,D).addScaledVector(r2,D*tx*.6).addScaledVector(u,D*ty*.05);o.scale.setScalar(D*tx*2*.27/pxW);o.rotation.set(0,0,0);o.lookAt(P);o.rotateY(-.17)},
  aim(o,pos,cp,z,flat,ww,pxW){o.position.set(pos[0],pos[1],pos[2]);const c=cp?V(...cp):null;if(flat)o.rotation.set(-Math.PI/2,0,0);else if(c){o.updateMatrixWorld();o.lookAt(c)}const w=V();o.getWorldPosition(w);o.scale.setScalar(ww?ww/pxW!:
c?w.distanceTo(c)*.001036*(z||1):.02)},
  scanY(){return scanR.position.y},gates(){return GATES.map(g=>[g.gx,g.gz])},campusOn(){return campus.g.visible},netA(){return G.netA},
  gNode(i){globeG.updateMatrixWorld();return NODES[i].tip.clone().applyMatrix4(globeG.matrixWorld)},gFront(){return GC.clone().addScaledVector(C.position.clone().sub(GC).normalize(),GR*1.02)},
  setFlow(p){if(p!==flowP)drawFlow(p)},
  focusNode(i){const w=NODES[i].n.clone().applyQuaternion(Rcur),tg=CAMDIR.clone().add(V(0,.1,0)).normalize();G.focus={q0:Rcur.clone(),q1:new THREE.Quaternion().setFromUnitVectors(w,tg).multiply(Rcur),t0:performance.now()}},
  drag(dx,dy){G.focus=null;Rcur.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),dx*.006)).premultiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),dy*.006))},
  nodes(){globeG.updateMatrixWorld();const cam=C.position.clone().sub(GC).normalize();return NODES.map(nd=>{const w=nd.tip.clone().applyMatrix4(globeG.matrixWorld),n=nd.n.clone().applyQuaternion(Rcur),p=this.project(w.x,w.y,w.z);p.face=n.dot(cam);return p})},
  project(x,y,z){tmp.set(x,y,z).project(C);return{x:(tmp.x*.5+.5)*innerWidth,y:(-tmp.y*.5+.5)*innerHeight,vis:tmp.z>-1&&tmp.z<1&&Math.abs(tmp.x)<1.1&&Math.abs(tmp.y)<1.1}},
};
addEventListener('resize',()=>{C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight,false);CR.setSize(innerWidth,innerHeight)});
}
