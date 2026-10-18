// The 3D EmpowerED Careers company building (formerly the AI Talent Factory): scene construction,
// camera poses and the window.FACTORY API. Company branding lives in brand.ts.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { POSES, HEAD, LANDMASK, INDS, ECO, type Pose } from '../data/content';
import type { P3, TalentUnit, EcoNet } from '../bridge';
import { buildBrand, drawLogo, whenLogo } from './brand';
import { motion } from '../app/motion';
import { POD_PLACE } from '../pod/missions';
import { quality } from '../app/quality';
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
  /** per-colour materials for blocky people */ _vx?: Record<number, THREE.MeshLambertMaterial>;
}
interface BoxOpts { p?: THREE.Matrix4; rx?: number; ry?: number; rz?: number; solid?: 'none' | 'green' | 'gold' | 'wood'; tone?: Tone | null }
interface PlaneOpts { rx?: number; ry?: number; mat?: THREE.Material; fill?: boolean; tone?: Tone }
type RedrawTex = THREE.CanvasTexture & { redraw(): void };
interface Route { wp: [P3, P3][]; stops: number[]; pc?: THREE.CatmullRomCurve3; lc?: THREE.CatmullRomCurve3 }
interface GlobeEnd { p: THREE.Vector3; l: THREE.Vector3; s: number; q: THREE.Quaternion }
/** Mutable scene state shared between the FACTORY setters and render(). */
interface SceneState {
  fogB: number; actor: number; hlA: number[]; gsel: number; gdE: number; dist: number; wf: boolean; bayHv: number; baySel: number[]; stop: number;
  cam: { t0: number }; cc: { t0: number }; act: number[]; con: number; net: EcoNet; netA: number; bayDim: number[]; units: TalentUnit[];
  pod: { on: boolean; t0: number }; podGv: number; podLead: number[]; zoom: number; zoomL: number; zoomE: number; dioStep: number; dioT0: number; dioCur: number; crate: number | null; ticks: number[]; walk: boolean; et: { on: boolean; t0: number };
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
R.setPixelRatio(quality.pixelRatio());R.setSize(innerWidth,innerHeight,false);R.setClearColor(PAPER,1);
const S=new THREE.Scene();S.fog=new THREE.Fog(PAPER,45,190);
/** Soft contact shadow (radial falloff), shared by every shadow patch. */
const SHADOW_MAT=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!;const g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(15,43,34,.34)');g.addColorStop(.55,'rgba(15,43,34,.16)');g.addColorStop(1,'rgba(15,43,34,0)');x.fillStyle=g;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})})();
const C=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,600);
const CR=new CSS3DRenderer();CR.setSize(innerWidth,innerHeight);CR.domElement.id='c3d';CR.domElement.style.overflow='clip';document.body.insertBefore(CR.domElement,document.getElementById('hud'));const CAMEL=CR.domElement.firstChild!.firstChild as HTMLElement;
const V=(x?:number,y?:number,z?:number)=>new THREE.Vector3(x,y,z);
const AREAS:Area[]=[];
function area(name:string,o:Partial<Area>={}):Area{const a=Object.assign({name,u:{value:0},L:{ink:[],fine:[],faint:[],gold:[]},mats:[],r:0},o);AREAS.push(a);return a}
function seg(a:Area,t:Tone,p:THREE.Vector3,q:THREE.Vector3){a.L![t].push(p.x,p.y,p.z,q.x,q.y,q.z)}
function M(x:number,y:number,z:number,rx=0,ry=0,rz=0){return new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(1,1,1))}
const SC=(x:number,y:number,z:number)=>new THREE.Matrix4().makeScale(x,y,z);
const fillMat=new THREE.MeshLambertMaterial({color:PAPER,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
// Light for the paper surfaces and people: a sky/ground fill keeps tops at paper brightness and lets sides
// fall about 10-15% darker with a warm bounce; a soft sun from the front left separates the faces.
// Late-afternoon warmth: a warm sky/ground fill plus a low golden sun from the front left.
{S.add(new THREE.HemisphereLight(0xFFF6E8,0xF1E6CF,Math.PI*.8));const sun=new THREE.DirectionalLight(0xFFDDA8,Math.PI*.3);sun.position.set(-.75,.8,.6);S.add(sun)}
/** Warm materials shared by every desk top, planting and glass pane (merged per material like the paper fills). */
const WOOD=new THREE.MeshLambertMaterial({color:0xE2C79A,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
const BARK=new THREE.MeshLambertMaterial({color:0x8C6B4A});
const LEAF=[0x6F9E68,0x86B077,0x5E8C5C].map(c=>new THREE.MeshLambertMaterial({color:c,flatShading:true}));
const GLASS=new THREE.MeshBasicMaterial({color:0xA9D3BF,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
const ICO=new THREE.IcosahedronGeometry(1,0),CYL8=new THREE.CylinderGeometry(1,1,1,8);
// Outdoor planting is already there when the company starts to assemble, so it keeps its own (never cut) materials.
const LEAFO=LEAF.map(m=>{const c=m.clone();c.userData.noClip=1;return c}),BARKO=BARK.clone();BARKO.userData.noClip=1;
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
  if(s!=='none')addS(BOX,s==='green'?Gm(a):s==='gold'?Ym(a):s==='wood'?WOOD:fillMat,m);
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
/** Lit version of amat, for people (so their blocky volumes read). */
function amatLit(a:Area,color:THREE.ColorRepresentation){const m=new THREE.MeshLambertMaterial({color,transparent:true,opacity:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:.5,polygonOffsetUnits:1});m.userData.base=1;a.mats.push(m);return m}
const vmat=(a:Area,c:number)=>{const m=a._vx||(a._vx={});return m[c]||(m[c]=amatLit(a,c))};
/** Person boxes are queued per (target group, area, colour) and merged into one mesh each, so crowds stay cheap. */
/** Contact shadows queued per target group: [x, y, z, width, depth]. */
const SHQ=new Map<THREE.Object3D,number[]>();
function contact(x:number,y:number,z:number,w:number,d:number){let q=SHQ.get(TG);if(!q)SHQ.set(TG,q=[]);q.push(x,y+.015,z,w,d)}
const VXQ=new Map<string,{tg:THREE.Object3D;a:Area;c:number;ms:THREE.Matrix4[]}>();let vxId=0;const vxKey=new WeakMap<object,number>();
const vxq=(a:Area,c:number,m:THREE.Matrix4)=>{const id=(o:object)=>{let v=vxKey.get(o);if(v===undefined){v=++vxId;vxKey.set(o,v)}return v};const k=id(TG)+'/'+id(a)+'/'+c;let e=VXQ.get(k);if(!e){e={tg:TG,a,c,ms:[]};VXQ.set(k,e)}e.ms.push(m)};
function figure(a:Area,pose:Pose,x:number,y:number,z:number,ry=0,flip=1,h=1.75,t:Tone='ink'){
  const s=h/1.75;contact(x,y,z,.95*s,.75*s);let hv=Math.sin(x*12.9898+z*78.233+y*3.71)*43758.5453;hv-=Math.floor(hv);
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
/** A low-poly tree or potted plant: trunk, two or three faceted leaf clumps, a soft shadow, optionally a pot. */
function plant(x:number,y:number,z:number,s=1,pot=false,out=false){const LF=out?LEAFO:LEAF,BK=out?BARKO:BARK;
  let hv=Math.sin(x*91.7+z*47.3)*9631.7;hv-=Math.floor(hv);const th=(pot?.5:1.7)*s,py=pot?.45*s:0;
  if(pot){addS(CYL8,fillMat,M(x,y+.22*s,z).multiply(SC(.32*s,.44*s,.32*s)));addS(CYL8,WOOD,M(x,y+.45*s,z).multiply(SC(.34*s,.04*s,.34*s)))}
  addS(CYL8,BK,M(x,y+py+th/2,z).multiply(SC(.09*s,th,.09*s)));
  const r=(pot?.55:1.25)*s,n=pot?2:3;
  for(let i=0;i<n;i++){const k=i/n*Math.PI*2+hv*6,o=i===0?0:r*.55;addS(ICO,LF[(i+Math.floor(hv*3))%3],M(x+Math.cos(k)*o,y+py+th+r*(i===0?.75:.45),z+Math.sin(k)*o,hv*3,k,0).multiply(SC(r*(i===0?1:.78),r*(i===0?.9:.7),r*(i===0?1:.78))))}
  contact(x,y,z,(pot?1.1:3.2)*s,(pot?1.1:3.2)*s)}
function desk(a:Area,x:number,y:number,z:number,w=1.3,d=.9){box(a,x,y+.7,z,w,.05,d,{solid:'wood'});[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([i,j])=>line(a,'fine',[x+i*(w/2-.05),y,z+j*(d/2-.05)],[x+i*(w/2-.05),y+.7,z+j*(d/2-.05)]))}
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
// Tinted glass across the front, leaving the entrance itself open.
plane(ext,-18.15,7.7,.04,23.7,15.4,{mat:GLASS});plane(ext,18.15,7.7,.04,23.7,15.4,{mat:GLASS});plane(ext,0,12.05,.04,12.6,7.3,{mat:GLASS});


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

// Planting: potted plants in the atrium and along the mezzanine edge, like a working garden office.
[[-27,-3],[27,-3],[-27,-19],[27,-19],[-9.5,-4],[9.5,-4],[-17,-14],[17,-14]].forEach(([x,z])=>plant(x,0,z,1.3,true));
[-26,-18,-10,10,18,26].forEach(x=>plant(x,6,-23,1,true));
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
/** The active project's record, as a notebook page (Develop bench and the Engineer data bench).
 *  state 0: as found; 1: the gap is marked; 2: fixed and linked to the POD. */
let devNote:{title:string;head:string[];rows:string[][];row:number;col:number;fix:string;state:number;linked:string;missing:string}={title:'',head:[],rows:[],row:-1,col:-1,fix:'',state:0,linked:'',missing:''};
const devTex=ctex(1024,640,(x,w,h)=>{const d=devNote;x.fillStyle='#FBF8EE';x.fillRect(0,0,w,h);x.fillStyle='#E6DFC9';x.fillRect(0,0,w,8);
  x.fillStyle='#1E4632';x.font='800 40px Manrope, sans-serif';x.fillText(d.title,36,66);
  const cols=d.head.length||1,cw=(w-72)/cols,y0=124,rh=80;x.font='700 26px Inter, sans-serif';x.fillStyle='#4E6A5C';d.head.forEach((c,j)=>x.fillText(c,36+j*cw,y0));
  d.rows.forEach((r,i)=>{const y=y0+66+i*rh;x.strokeStyle='#D8D0B8';x.lineWidth=2;x.beginPath();x.moveTo(30,y+26);x.lineTo(w-30,y+26);x.stroke();
    r.forEach((c,j)=>{const bad=i===d.row&&j===d.col;let v=c;let col='#1E4632';
      if(bad&&d.state===2){v=d.fix;col='#1F7A4A'}else if(bad&&!c){v=d.state>=1?d.missing:'';col='#B5481F'}else if(bad&&d.state===1)col='#B5481F';
      x.fillStyle=col;x.font=(bad&&d.state>=1?'800 ':'600 ')+'31px Inter, sans-serif';let t=v;while(t.length>2&&x.measureText(t).width>cw-14)t=t.slice(0,-2);if(t!==v)t=t.slice(0,-1)+'…';x.fillText(t,36+j*cw,y)});
    if(i===d.row&&d.state>=1){x.strokeStyle=d.state===2?'#2E8B57':'#C9A33A';x.lineWidth=5;if(d.state===1)x.setLineDash([14,9]);x.strokeRect(22,y-36,w-44,56);x.setLineDash([])}});
  if(d.state===2){x.fillStyle='#2E8B57';x.font='800 28px Manrope, sans-serif';x.fillText('✓ '+d.linked,36,h-34)}});
/** Gold connection from the Develop bench toward the engineering floor (shown once the record is fixed). */
const devLink=(()=>{const c=new THREE.CatmullRomCurve3([V(-9.7,6.79,-39.1),V(-9.15,6.79,-39.15),V(-8.98,6.4,-39.15),V(-8.95,6.04,-38.8),V(-8.3,6.04,-36.6),V(-7,6.04,-34.3),V(-6,6.04,-30),V(-3,6.04,-24)]);const m=new THREE.Mesh(new THREE.TubeGeometry(c,80,.022,5,false),new THREE.MeshBasicMaterial({color:0xC9A33A,transparent:true,opacity:.9}));m.visible=false;m.userData.noRay=true;factoryG.add(m);return m})();
// LAUNCH: Foundation Hall
{const c=-7,f=(x:number,z:number)=>face(x,z,ST[4]);
 plane(rS,-10.5,8.3,-47.8,3.4,1.9,{fill:true,tone:'ink'});[[8.9,1.6],[8.6,1.1],[8.3,1.4],[7.9,.8]].forEach(([y,w])=>line(rS,'fine',[-12,y,-47.75],[-12+w,y,-47.75]));poly(rS,'gold',[[-10,7.7,-47.75],[-9.6,8.2,-47.75],[-9.2,8,-47.75],[-8.9,8.8,-47.75]]);
 sitAt(rS,-12.3,6,-44.6,1);sitAt(rS,-10.1,6,-44.6,1);figure(rS,'point',-12.2,6,-46.9,f(-12.2,-46.9));hring(rS,'gold',-10.8,6.02,-45.4,1.6);
 desk(rS,-5.8,6,-46.6,2.6,.9);[-6.7,-5.8,-4.9].forEach(x=>monitor(rS,x,6.1,-46.9,0));dataPanel(rS,-5.8,9.3,-47.4,2.6,1.1,0,'bars');figure(rS,'stand',-5.1,6,-45.4,f(-5.1,-45.4));hring(rS,'gold',-5.8,6.02,-46.2,1.4);
 cyl(rS,-2.8,6.72,-43.8,.9,.06);line(rS,'fine',[-2.8,6,-43.8],[-2.8,6.7,-43.8]);figure(rS,'stand',-3.9,6,-43.2,f(-3.9,-43.2));figure(rS,'point',-1.8,6,-44.4,f(-1.8,-44.4),-1);figure(rS,'stand',-3,6,-45.1,f(-3,-45.1));hring(rS,'gold',-2.8,6.02,-43.8,1.5);
 // Project bench: the learner and a peer with the project's record notebook (it changes as the record is checked and fixed).
 box(rS,-10.4,6,-39.2,2.6,.72,1,{tone:'fine'});box(rS,-10.4,6.72,-39.2,2.7,.06,1.08,{solid:'wood'});
 figure(rS,'sit',-10.75,6,-40.1,-Math.PI/2,1);cyl(rS,-10.75,6.22,-40.1,.24,.44,{tone:'fine'});
 figure(rS,'point',-8.85,6,-39.75,f(-8.85,-39.75));
 box(rS,-11.45,6.75,-39.25,.5,.03,.36,{ry:-.4,solid:'green',tone:null});plane(rS,-11.55,6.93,-39.45,.5,.34,{rx:-.3,ry:-.4,mat:amat(rS,0x2B4A3C),tone:'fine'});
 plane(rS,-10.4,6.785,-39.05,1.4,.875,{rx:-Math.PI/2,mat:amat(rS,0xffffff,1,devTex),tone:'ink'});
 hring(rS,'gold',-10.4,6.02,-39.4,1.6);
 box(rS,-3.4,6,-39.9,2.8,2,.06,{solid:'none',tone:'fine'});figure(rS,'sit',-4.2,6,-38.8,0,1);chair(rS,-4.18,6,-38.8,1);figure(rS,'sit',-2.6,6,-38.8,0,-1);chair(rS,-2.62,6,-38.8,-1);box(rS,-3.4,6,-38.8,.5,.7,.5,{tone:'fine'});hring(rS,'gold',-3.4,6.02,-39,1.5);
 line(rS,'gold',[-2,6.03,-41.5],[3,6.03,-41.5]);}
/** Specialise: pod positions, and a gold marker over the pod whose task is being looked at. */
const SPEC_P:number[][]=[];
const specMark=new THREE.Mesh(new THREE.OctahedronGeometry(.26,0),new THREE.MeshBasicMaterial({color:0xC9A33A}));specMark.visible=false;specMark.userData.noRay=true;factoryG.add(specMark);
// PRO: specialisation pods
{const f=(x:number,z:number)=>face(x,z,ST[5]);
 const P=[...Array(7)].map((_,i)=>{const a=(-33+i*41/6)*Math.PI/180;return [7+10.5*Math.sin(a),-31.5-10.5*Math.cos(a)]});SPEC_P.push(...P);
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
  root:factoryG,cam:()=>C,plant:(x,y,z,sc,pot)=>plant(x,y,z,sc,pot,!pot),glass:GLASS,
},innerWidth<=700||((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=4);
// GLOBE (AI for Everyone)
TG=globeG;
const llv=(la:number,lo:number)=>{la*=Math.PI/180;lo*=Math.PI/180;return V(Math.cos(la)*Math.cos(lo),Math.sin(la),-Math.cos(la)*Math.sin(lo))};
/** AI for Everyone: the world view is dark green with luminous lines (lerped in by the globe's visibility). */
const DARK=new THREE.Color(0x0D231A),SPHERE_DARK=new THREE.Color(0x15382A),GLOW_T:Record<Tone,THREE.Color>={ink:new THREE.Color(0x7BE3A6),fine:new THREE.Color(0x46A878),faint:new THREE.Color(0x2A5E45),gold:new THREE.Color(0xE9C96A)};
const GLC:Record<Tone,THREE.Color>={ink:INK.clone(),fine:TONES.fine.clone(),faint:TONES.faint.clone(),gold:GOLD.clone()},GLP=PAPER.clone(),BG=PAPER.clone();
let LAND_PM:THREE.PointsMaterial|null=null;
const sphereMat=new THREE.MeshBasicMaterial({color:PAPER,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
const gSphere=new THREE.Mesh(new THREE.SphereGeometry(GR*.992,64,40),sphereMat);gSphere.visible=false;globeG.add(gSphere);
for(let lat=-75;lat<=75;lat+=15){const k=lat*Math.PI/180;ring(gA,'ink',M(0,GR*Math.sin(k),0,-Math.PI/2),GR*Math.cos(k),96)}
for(let lon=0;lon<180;lon+=15)ring(gA,'ink',M(0,0,0,0,lon*Math.PI/180),GR,96);
{const b=atob(LANDMASK),pts:number[]=[];let idx=0;for(let lat=-84;lat<=84.01;lat+=2.4){const n=Math.max(1,Math.round(150*Math.cos(lat*Math.PI/180)));for(let i=0;i<n;i++){const lon=-180+(i+.5)*360/n;if((b.charCodeAt(idx>>3)>>(idx&7))&1){const v=llv(lat,lon).multiplyScalar(GR*1.004);pts.push(v.x,v.y,v.z)}idx++}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));const pm=LAND_PM=new THREE.PointsMaterial({color:INK.clone(),size:2.6,sizeAttenuation:false,transparent:true,opacity:0});pm.userData.base=.7;gA.mats.push(pm);globeG.add(new THREE.Points(g,pm))}
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
// AI for Everyone: a small workflow diorama beside each complete profession's building on the globe.
// Three stations: the sample input, the AI draft and the person who checks it. Revealed when the camera zooms in.
const DIO_KIND:Record<string,{draft:string;props:(a:Area)=>void}>={
  bank:{draft:'Draft commentary',props:a=>{box(a,-2.3,0,0,1.5,.75,.8);box(a,-2.65,.75,.05,.5,.22,.6,{tone:'fine'});box(a,-2.65,.97,.05,.46,.12,.56,{tone:'fine'});dataPanel(a,-2.3,1.75,-.45,1.4,.85,0,'bars')}},
  hospital:{draft:'Draft visit summary',props:a=>{box(a,-2.7,0,-.2,1,.55,1.9);box(a,-2.7,.55,-.85,.8,.16,.4,{tone:'fine'});box(a,-1.75,0,.35,.55,.95,.45);box(a,-1.75,.95,.35,.42,.04,.32,{solid:'gold'});figure(a,'stand',-1.6,0,1.1,Math.PI*.85,1,1.75)}},
  school:{draft:'Draft lesson outline',props:a=>{plane(a,-2.3,1.55,-.7,2,1.1,{fill:true,tone:'ink'});[1.75,1.55,1.35].forEach((y,i)=>line(a,'gold',[-3.05,y,-.68],[-2.0+i*.15,y,-.68]));box(a,-2.85,0,.35,.7,.5,.5);box(a,-1.85,0,.35,.7,.5,.5);figure(a,'stand',-2.85,0,1.05,Math.PI,1,1.25);figure(a,'stand',-1.85,0,1.05,Math.PI,-1,1.25)}},
  hotel:{draft:'Draft reply',props:a=>{box(a,-2.3,0,-.1,1.9,1.05,.6);box(a,-1.75,1.05,-.1,.24,.1,.24,{solid:'gold'});figure(a,'stand',-2.5,0,.95,Math.PI,1,1.75);box(a,-1.75,0,1.0,.45,.62,.26,{solid:'gold'})}},
  factory:{draft:'Draft maintenance summary',props:a=>{box(a,-2.75,0,-.35,1.2,1.35,1);cyl(a,-2.75,1.7,-.35,.26,.7);box(a,-1.75,0,.25,1.3,.45,.5,{tone:'fine'});[-2.2,-1.75,-1.3].forEach(x=>box(a,x,.45,.25,.28,.22,.28,{solid:'gold'}));figure(a,'point',-2.1,0,1.0,Math.PI*.8,1,1.75)}},
};
interface Dio{node:number;pivot:THREE.Group;g:THREE.Group;a:Area;labels:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[];token:THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>;check:THREE.Group;checkM:THREE.MeshBasicMaterial[];screen:THREE.MeshBasicMaterial;st:THREE.Vector3[]}
const DIOS:Dio[]=[];
const dioLabel=(n:number,t:string)=>ctex(640,140,(x,w,h)=>{x.fillStyle='#0F2B22';x.beginPath();x.roundRect(4,4,w-8,h-8,64);x.fill();x.fillStyle='#C9A33A';x.beginPath();x.arc(70,h/2,40,0,Math.PI*2);x.fill();x.fillStyle='#0F2B22';x.font='800 46px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(n),70,h/2+2);x.fillStyle='#F2EFE2';x.textAlign='left';x.font='800 44px Manrope, sans-serif';sp(x,'4px');x.fillText(t,132,h/2+2)});
const DIO_LT=[dioLabel(1,'SAMPLE INPUT'),dioLabel(2,'AI DRAFT'),dioLabel(3,'YOU CHECK')];
{const prevTG=TG;INDS.forEach((d,ni)=>{const k=DIO_KIND[d.kind];if(d.ph||!k)return;
  const pivot=new THREE.Group();pivot.position.copy(NODES[ni].n).multiplyScalar(GR);pivot.quaternion.setFromUnitVectors(V(0,1,0),NODES[ni].n);globeG.add(pivot);
  const g=new THREE.Group();g.scale.setScalar(.42);g.visible=false;pivot.add(g);TG=g;
  const a=area('dio'+ni,{manual:1,parent:g});
  cyl(a,0,-.03,0,3.95,.06,{tone:'fine'});contact(0,0,0,7.6,7.6);hring(a,'fine',0,.02,0,3.5,72);hring(a,'gold',0,.02,0,3.65,72);
  const st=[V(-2.3,0,.3),V(0,0,-.5),V(2.3,0,.3)];
  poly(a,'gold',[[-2.3,.03,1.4],[0,.03,.75],[2.3,.03,1.4]]);
  k.props(a);
  // The AI station: a screen on a desk, showing the draft.
  box(a,0,0,-1.0,1.9,.75,.8);box(a,0,.75,-1.3,1.6,1.05,.08);box(a,0,.75,-1.2,.12,.1,.12,{tone:'fine'});
  const scrT=ctex(512,336,(x,w,h)=>{x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);x.fillStyle='#0F2B22';x.fillRect(0,0,w,64);x.fillStyle='#F6DB2D';x.font='800 30px Manrope, sans-serif';x.textBaseline='middle';sp(x,'3px');x.fillText('AI DRAFT',24,33);x.fillStyle='#0F2B22';x.font='700 30px Manrope, sans-serif';sp(x,'0px');x.fillText(k.draft,24,104);x.fillStyle='rgba(30,70,50,.28)';[150,186,222,258].forEach((y,i)=>x.fillRect(24,y,w-48-(i%2)*120,14));x.fillStyle='#C9A33A';x.fillRect(24,292,170,16)});
  const screen=new THREE.MeshBasicMaterial({map:scrT,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});const so=new THREE.Mesh(PL,screen);so.scale.set(1.5,.98,1);so.position.set(0,1.27,-1.25);g.add(so);
  // The reviewer: the professional checks the draft at a lectern.
  box(a,2.3,0,-.45,1.1,.95,.6);box(a,2.3,.95,-.45,.7,.03,.45,{solid:'gold'});figure(a,'point',2.25,0,.55,Math.PI*1.12,1,1.75);
  const labels=DIO_LT.map((t,i)=>{const m=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.scale.set(2.05,.45,1);m.position.set(st[i].x,i===1?2.75:3.05,st[i].z);g.add(m);return m});
  const token=new THREE.Mesh(BOX,new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0}));token.scale.set(.5,.08,.66);token.position.set(st[0].x,1.05,st[0].z+.9);g.add(token);
  const check=new THREE.Group(),checkM=[new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),new THREE.MeshBasicMaterial({color:INK,transparent:true,opacity:0,depthWrite:false})];
  check.add(new THREE.Mesh(new THREE.CircleGeometry(.38,32),checkM[0]));const t1=new THREE.Mesh(BOX,checkM[1]);t1.scale.set(.2,.07,.02);t1.position.set(-.09,-.04,.01);t1.rotation.z=-Math.PI/4;const t2=new THREE.Mesh(BOX,checkM[1]);t2.scale.set(.38,.07,.02);t2.position.set(.08,.04,.01);t2.rotation.z=Math.PI/3.6;check.add(t1,t2);check.position.set(3.05,2.2,.4);g.add(check);
  DIOS.push({node:ni,pivot,g,a,labels,token,check,checkM,screen,st})});TG=prevTG}
/** The gallery frames: centre, the point each exhibit faces, and whether it hangs on a side wall. */
const GALLERY:{at:P3;face:P3;ry?:number}[]=[{at:[19.8,2.1,11.06],face:[19.8,2.1,24]},{at:[25.2,2.1,11.06],face:[25.2,2.1,24]},{at:[17.06,2.1,15.5],face:[30,2.1,15.5],ry:1},{at:[27.94,2.1,15.5],face:[15,2.1,15.5],ry:1}];
// Evidence & Impact: a small glass pavilion on the plaza beside the entrance, open toward the plaza.
// The exhibits themselves are HTML boards the controller hangs in the frames (GALLERY in the bridge).
{const prevTG=TG;TG=factoryG;const gal=area('gallery',{at:.45});
 const X0=17,X1=28,Z0=11,Z1=20,H=4.2,cx=(X0+X1)/2,cz=(Z0+Z1)/2;
 box(gal,cx,0,cz,X1-X0,.12,Z1-Z0);
 box(gal,cx,H,cz,X1-X0+.4,.3,Z1-Z0+.4);
 plane(gal,cx,H/2,Z0,X1-X0,H,{fill:true,tone:'ink'});
 plane(gal,X0,H/2,cz,Z1-Z0,H,{ry:Math.PI/2,fill:true,tone:'ink'});
 plane(gal,X1,H/2,cz,Z1-Z0,H,{ry:Math.PI/2,fill:true,tone:'ink'});
 // The front: glass either side of a 4 m opening.
 ([[X0,cx-2],[cx+2,X1]] as [number,number][]).forEach(([a,b])=>{plane(gal,(a+b)/2,H/2,Z1,b-a,H,{tone:'fine'});[a,(a+b)/2,b].forEach(x=>line(gal,'fine',[x,0,Z1],[x,H,Z1]))});
 line(gal,'gold',[X0-.2,H+.32,Z1+.2],[X1+.2,H+.32,Z1+.2]);
 const sT=ctex(1024,160,(x,w,h)=>{x.fillStyle='#0F2B22';x.fillRect(0,0,w,h);x.fillStyle='#F2EFE2';x.font='800 62px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';sp(x,'10px');x.fillText('EVIDENCE & IMPACT',w/2,h/2+2)});
 const sg=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:sT,side:THREE.DoubleSide}));sg.scale.set(5.6,.88,1);sg.position.set(cx,H+.95,Z1+.25);sg.userData.noRay=true;factoryG.add(sg);
 // Frames for the four exhibits, and a plinth in the middle.
 GALLERY.forEach(f=>{if(f.ry)plane(gal,f.at[0],f.at[1],f.at[2],3.1,2.3,{ry:Math.PI/2,tone:'gold'});else plane(gal,f.at[0],f.at[1],f.at[2],3.1,2.3,{tone:'gold'})});
 box(gal,cx,0,16.6,1,1,1);box(gal,cx,1,16.6,.62,.1,.82,{solid:'gold'});
 TG=prevTG}
// ---- POD mission: predictive maintenance on the engineering floor (src/pod/missions.ts) -----------
// An instrumented CNC machine, its sensor traces, a technician alert screen and the five-person team.
// Built as its own groups (not batched) so the spindle can move and each person can be highlighted.
const MS={g:new THREE.Group(),people:[] as {g:THREE.Group;ring:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;mark:THREE.Mesh<THREE.OctahedronGeometry,THREE.MeshBasicMaterial>;link:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>}[],
  spindle:new THREE.Group(),mach:new THREE.Group(),traceT:null as RedrawTex|null,alertT:null as RedrawTex|null,sensors:[] as THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>[]};
interface MsnState{mi:number;cond:number;revised:boolean;t0:number;sel:number;u:number;last:string;labels:Record<string,string>}
const MSN:MsnState={mi:0,cond:0,revised:false,t0:-1,sel:-1,u:0,last:'',labels:{}};
const MSN_DUR=6500;
/** Document label textures on the source table (redrawn when the language changes). */
const MSN_DOCTEX:RedrawTex[]=[];
/** Prepared example signals (0..1) for a condition at cycle position u. Deterministic, labelled as an example. */
function msnSig(cond:number,u:number):[number,number]{const n=Math.sin(u*97)*.02+Math.sin(u*231)*.015;
  if(cond===1){const b=sm(.32,.42,u)*(1-sm(.68,.78,u));return[.24+.46*b+n,.3+.28*sm(.35,.9,u)]}
  if(cond===2)return[.27+.5*u*u+Math.sin(u*60)*.03*u+n,.3+.22*u];
  return[.24+n,.3+.04*u]}
/** The heavy cut is scheduled between these points; after review the team uses it as context. */
const MSN_CUT:[number,number]=[.34,.76];
function msnAlertAt(cond:number,revised:boolean,u:number):boolean{const [v]=msnSig(cond,u);if(v<.55)return false;if(revised&&cond===1&&u>=MSN_CUT[0]&&u<=MSN_CUT[1])return false;return true}
{const prevTG=TG;TG=MS.g;factoryG.add(MS.g);const M0=POD_PLACE.centre,mx=M0[0],mz=M0[2];
 const ma=area('msnMachine',{manual:1,parent:MS.g});
 const mach=MS.mach;MS.g.add(mach);TG=mach;const mm=area('msnMach',{manual:1,parent:mach});
 // Base, enclosure with a window, control panel and chip tray.
 box(mm,mx,0,mz,3.1,.9,1.9);contact(mx,0,mz,4.2,2.8);box(mm,mx,.9,mz,3.1,2,1.9,{solid:'none',tone:'ink'});box(mm,mx,2.9,mz,3.1,.18,1.9);
 // Enclosure: paper back and sides, a glass front so the spindle and the cut stay visible.
 plane(mm,mx,1.9,mz-.95,3.1,2,{fill:true});plane(mm,mx-1.55,1.9,mz,1.9,2,{ry:Math.PI/2,fill:true});plane(mm,mx+1.55,1.9,mz,1.9,2,{ry:Math.PI/2,fill:true});
 plane(mm,mx-.25,1.9,mz+.95,2,1.3,{mat:GLASS});plane(mm,mx+1.25,1.9,mz+.95,.6,2,{fill:true});plane(mm,mx-1.4,1.9,mz+.95,.3,2,{fill:true});plane(mm,mx-.25,1.05,mz+.95,2,.3,{fill:true});plane(mm,mx-.25,2.72,mz+.95,2,.36,{fill:true});
 plane(mm,mx-.25,1.9,mz+.96,2,1.3,{tone:'fine'});line(mm,'fine',[mx-1.25,1.25,mz+.97],[mx+.75,1.25,mz+.97]);
 box(mm,mx+1.85,.4,mz+.35,.5,1.6,.4);plane(mm,mx+1.85,1.75,mz+.56,.36,.42,{tone:'ink'});box(mm,mx+1.85,1.65,mz+.57,.26,.3,.02,{solid:'gold'});
 box(mm,mx-.25,.9,mz+.2,1.9,.12,1);
 // Forest-green frame posts and a gold trim line: the hero machine reads as the subject of the room.
 [mx-1.5,mx+1.0,mx+1.5].forEach(x=>box(mm,x,.9,mz+.93,.1,2,.08,{solid:'green'}));box(mm,mx,2.86,mz+.93,3.1,.08,.08,{solid:'green'});box(mm,mx-.25,1.2,mz+.98,2,.04,.03,{solid:'gold'});box(mm,mx,.86,mz+.96,3.1,.04,.03,{solid:'gold'});
 // Sensor hub on the side, with cables to the two sensors.
 box(mm,mx+1.55,2.95,mz-.4,.5,.36,.4,{tone:'ink'});
 // The moving spindle head: its own area so its lines move with it.
 MS.spindle.position.set(mx-.25,0,mz);mach.add(MS.spindle);{const prev=TG;TG=MS.spindle;const sa=area('msnSpindle',{manual:1,parent:MS.spindle});
   box(sa,0,1.85,0,.7,.95,.7,{tone:'ink'});cyl(sa,0,1.55,0,.12,.5);TG=prev}
 // Sensors: vibration on the spindle bearing, temperature on the motor housing (gold, highlighted when in use).
 const sm1=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.9}),sv=new THREE.Mesh(BOX,sm1);sv.scale.set(.2,.16,.2);sv.position.set(.42,2.15,.2);MS.spindle.add(sv);
 const sm2=new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.9}),st=new THREE.Mesh(BOX,sm2);st.scale.set(.22,.22,.12);st.position.set(mx+1.2,2.5,mz+.97);mach.add(st);MS.sensors=[sv,st];
 line(mm,'gold',[mx+1.2,2.6,mz+.97],[mx+1.55,3.1,mz-.2]);line(mm,'gold',[mx+.2,2.8,mz+.2],[mx+1.4,3.1,mz-.3]);
 TG=MS.g;
 // Trace panel above the machine, and the technician alert screen on a stand.
 MS.traceT=ctex(640,300,(x,w,h)=>msnDrawTrace(x,w,h));
 const tp=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:MS.traceT,side:THREE.DoubleSide}));tp.scale.set(3,1.4,1);tp.position.set(mx+.3,3.95,mz+.3);tp.rotation.y=.4;MS.g.add(tp);
 line(ma,'ink',[mx+.3,3.08,mz+.3],[mx+.3,3.25,mz+.3]);
 const so=POD_PLACE.art[3];box(ma,so[0],0,so[2]-.05,.1,1,.1,{solid:'green'});
 MS.alertT=ctex(560,360,(x,w,h)=>msnDrawAlert(x,w,h));
 const ap=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:MS.alertT,side:THREE.DoubleSide}));ap.scale.set(1.75,1.12,1);ap.position.set(so[0],so[1]+.15,so[2]);ap.rotation.y=-.15;MS.g.add(ap);
 // The records bench (data), with the cream source notebook: clipped corner, three green rows.
 const da=POD_PLACE.art[0];box(ma,da[0],0,da[2],1.7,.78,.85);contact(da[0],0,da[2],2.3,1.4);
 const nb=ctex(256,180,(x,w,h)=>{x.fillStyle='#F2EFE2';x.beginPath();x.moveTo(0,0);x.lineTo(w-46,0);x.lineTo(w,46);x.lineTo(w,h);x.lineTo(0,h);x.closePath();x.fill();x.strokeStyle='#0F2B22';x.lineWidth=6;x.stroke();x.fillStyle='#1E4632';[54,96,138].forEach(y=>x.fillRect(26,y,w-60,16));x.fillStyle='#C9A33A';x.fillRect(w-40,8,24,24)});
 // The data bench shows the same record notebook as Develop (the reviewed version once it is fixed).
 const nbm=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:devTex,side:THREE.DoubleSide}));void nb;nbm.scale.set(.62,.39,1);nbm.rotation.x=-Math.PI/2;nbm.rotation.z=.3;nbm.position.set(da[0]-.25,.8,da[2]);MS.g.add(nbm);
 box(ma,da[0]+.45,.78,da[2]-.15,.5,.32,.04,{tone:'ink'});
 // Ops console (cloud/MLOps & security): a small server box with a status light.
 const oa=POD_PLACE.art[4];box(ma,oa[0],0,oa[2],.6,1.1,.6);box(ma,oa[0],1.1,oa[2]+.31,.36,.08,.02,{solid:'gold'});
 // The five people, each in their own group with a ring, a marker and a link to their work.
 POD_PLACE.at.forEach((pat,i)=>{const p={at:pat,art:POD_PLACE.art[i]};const g=new THREE.Group();MS.g.add(g);TG=g;const a=area('msnP'+i,{manual:1,parent:g});
   const ry=Math.atan2(p.art[0]-p.at[0],p.art[2]-p.at[2]);figure(a,i===1?'point':'stand',p.at[0],0,p.at[2],ry,i%2?1:-1,1.75);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.55,32),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(p.at[0],.04,p.at[2]);g.add(ring);
   const mark=new THREE.Mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0}));mark.position.set(p.art[0],p.art[1]+.95,p.art[2]);g.add(mark);
   const lg=new THREE.BufferGeometry().setFromPoints([V(p.at[0],1.2,p.at[2]),V(p.art[0],p.art[1]+.2,p.art[2])]);const link=new THREE.Line(lg,new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:0}));g.add(link);
   MS.people.push({g,ring,mark,link})});
 MS.g.traverse(o=>{o.userData.noRay=true});
 TG=prevTG}
// ---- POD missions 2 and 3: the inspection cell and the supply-chain source table ----------------
// Same place as the CNC machine; only the active mission's centrepiece is visible (podMission).
const IC={g:new THREE.Group(),chip:null as unknown as THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>,mark:null as unknown as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,arm:new THREE.Group(),ring:null as unknown as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>};
const AS={g:new THREE.Group(),links:[] as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>[],out:null as unknown as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>,lock:null as unknown as THREE.Mesh<THREE.BoxGeometry,THREE.MeshBasicMaterial>};
{const prevTG=TG;const [cx,,cz]=POD_PLACE.centre;
 // Inspection cell: conveyor, camera gantry with a ring light, edge device, sorting arm, review lane and reject bin.
 TG=IC.g;MS.g.add(IC.g);IC.g.visible=false;const ia=area('msnIC',{manual:1,parent:IC.g});
 box(ia,cx,0,cz,3.6,.78,.9);contact(cx,0,cz,4.6,1.9);box(ia,cx,.78,cz,3.6,.08,.75,{tone:'ink'});[-1.6,1.6].forEach(dx=>cyl(ia,cx+dx,.82,cz,.06,.75,{rx:Math.PI/2}));
 [-.65,.25].forEach(dx=>{box(ia,cx+dx,0,cz-.55,.1,2.7,.1,{solid:'green'})});box(ia,cx-.2,2.7,cz-.55,1.1,.1,.1,{solid:'green'});
 box(ia,cx-.2,1.95,cz-.2,.36,.36,.36,{tone:'ink'});cyl(ia,cx-.2,1.72,cz-.2,.08,.12);
 IC.ring=new THREE.Mesh(new THREE.RingGeometry(.22,.3,32),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));IC.ring.rotation.x=-Math.PI/2;IC.ring.position.set(cx-.2,1.62,cz-.2);IC.g.add(IC.ring);
 box(ia,cx-.4,2.05,cz+.2,.42,.3,.3,{tone:'ink'});box(ia,cx-.4,2.2,cz+.36,.1,.06,.02,{solid:'gold'});line(ia,'gold',[cx-.4,2.2,cz+.05],[cx-.2,2.1,cz-.2]);
 box(ia,cx-1.3,0,cz+.95,.5,1.25,.35);box(ia,cx-1.3,1.25,cz+.95,.3,.2,.02,{solid:'gold'});
 cyl(ia,cx+1.25,.95,cz-.55,.16,.3);IC.arm.position.set(cx+1.25,1.1,cz-.55);IC.g.add(IC.arm);{const prev=TG;TG=IC.arm;const aa=area('msnArm',{manual:1,parent:IC.arm});box(aa,0,0,.35,.12,.12,.7,{tone:'ink'});box(aa,0,-.05,.72,.3,.18,.06,{solid:'gold'});TG=prev}
 box(ia,cx+1.95,.55,cz+.75,.9,.08,.6,{tone:'ink'});line(ia,'gold',[cx+1.5,.64,cz+.45],[cx+2.4,.64,cz+.45]);line(ia,'gold',[cx+1.5,.64,cz+1.05],[cx+2.4,.64,cz+1.05]);
 box(ia,cx+1.95,0,cz-.95,.6,.55,.5);
 IC.chip=new THREE.Mesh(BOX,new THREE.MeshBasicMaterial({color:0x1A2620}));IC.chip.scale.set(.26,.07,.26);IC.chip.position.set(cx-1.7,.9,cz);IC.g.add(IC.chip);
 IC.mark=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide}));IC.mark.scale.set(.09,.09,1);IC.mark.rotation.x=-Math.PI/2;IC.mark.position.set(.06,.51,.06);IC.chip.add(IC.mark);
 [[cx+1.8,.62,cz+.75],[cx+2.1,.62,cz+.7]].forEach(p=>{const c=new THREE.Mesh(BOX,new THREE.MeshBasicMaterial({color:0x1A2620}));c.scale.set(.26,.07,.26);c.position.set(p[0],p[1],p[2]);IC.g.add(c)});
 // Source table: labelled document stacks, a restricted contract with a padlock, a retrieval index and the links between them.
 TG=AS.g;MS.g.add(AS.g);AS.g.visible=false;const sa=area('msnAS',{manual:1,parent:AS.g});
 box(sa,cx,0,cz,3.4,.78,1.7);contact(cx,0,cz,4.4,2.6);
 const DOCS:[string,number][]=[['CUSTOMS',-1.2],['BILL OF MATERIALS',-.4],['EXPORT RULES',.4],['CONTRACT',1.2]];
 const idx=V(POD_PLACE.art[2][0],2.05,POD_PLACE.art[2][2]);box(sa,idx.x,1.8,idx.z,.5,.5,.5,{tone:'ink'});box(sa,idx.x,0,idx.z-.25,.08,1.8,.08,{solid:'green'});
 DOCS.forEach(([n,dx],k)=>{const h=.12+(k%2)*.1;box(sa,cx+dx,.78,cz+.3,.5,h,.66,{tone:'ink'});
   const t=ctex(256,72,(x,w,hh)=>{x.fillStyle=k===3?'#B4472C':'#0F2B22';x.fillRect(0,0,w,hh);x.fillStyle='#F2EFE2';x.font='800 22px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(msnLabel('doc'+k,n),w/2,hh/2+1)});
   const s=new THREE.Mesh(PL,new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));s.scale.set(.62,.18,1);s.position.set(cx+dx,1.2,cz-.05);AS.g.add(s);MSN_DOCTEX.push(t);
   const lg=new THREE.BufferGeometry().setFromPoints([V(cx+dx,.8+h,cz+.3),idx.clone()]);const ln=new THREE.Line(lg,new THREE.LineBasicMaterial({color:k===3?0xB4472C:GOLD,transparent:true,opacity:.1}));AS.g.add(ln);AS.links.push(ln)});
 AS.lock=new THREE.Mesh(BOX,new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.5}));AS.lock.scale.set(.16,.14,.08);AS.lock.position.set(cx+1.2,1.08,cz+.66);AS.g.add(AS.lock);
 const scr=POD_PLACE.art[3];const og=new THREE.BufferGeometry().setFromPoints([idx.clone(),V(scr[0],scr[1]+.2,scr[2])]);AS.out=new THREE.Line(og,new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:.1}));AS.g.add(AS.out);
 [IC.g,AS.g].forEach(g=>g.traverse(o=>{o.userData.noRay=true}));
 TG=prevTG}
/** Inspection: which way the part goes. 0 passes, 1 review lane, 2 reject. */
function icRoute():number{if(MSN.cond===0)return 0;if(MSN.cond===1)return MSN.revised?1:2;return 2}
/** The current mission's "problem shown" state, once the example reaches its decision. */
function msnFlag():boolean{
  if(MSN.t0<0)return false;
  if(MSN.mi===1)return MSN.u>=.55&&icRoute()===2;
  if(MSN.mi===2)return MSN.u>=.7&&((MSN.cond===1&&!MSN.revised)||MSN.cond===2);
  for(let i=0;i<=40;i++){if(i/40>MSN.u)break;if(msnAlertAt(MSN.cond,MSN.revised,i/40))return true}return false}
function wrapText(x:CanvasRenderingContext2D,msg:string,x0:number,y0:number,maxW:number,lh:number){const words=msg.split(' ');let line='',y=y0;words.forEach(wd=>{const t=line?line+' '+wd:wd;if(x.measureText(t).width>maxW){x.fillText(line,x0,y);y+=lh;line=wd}else line=t});x.fillText(line,x0,y);return y}
function icDrawTrace(x:CanvasRenderingContext2D,w:number,h:number){
  x.fillStyle='#0F2B22';x.fillRect(0,0,w,h);x.fillStyle='#E9C96A';x.font='800 22px Manrope, sans-serif';x.textBaseline='middle';sp(x,'3px');x.fillText(msnLabel('camT','CAMERA VIEW · EXAMPLE IMAGE'),20,26);sp(x,'0px');
  if(MSN.t0<0||MSN.u<.3){x.fillStyle='rgba(242,239,226,.7)';x.font='600 22px Inter, sans-serif';x.fillText(msnLabel('camWait','Waiting for the next part'),24,h/2);return}
  const s=170,X=60,Y=70;x.fillStyle='#1A2620';x.fillRect(X,Y,s,s);x.strokeStyle='#5B6B62';x.lineWidth=2;for(let i=0;i<6;i++){const p=Y+18+i*27;x.beginPath();x.moveTo(X-14,p);x.lineTo(X,p);x.moveTo(X+s,p);x.lineTo(X+s+14,p);x.stroke()}
  x.fillStyle='#3A4A40';x.font='700 16px Inter, sans-serif';x.fillText('QFN-32',X+46,Y+s/2);
  if(MSN.cond===1){x.strokeStyle='rgba(242,239,226,.55)';x.lineWidth=3;x.beginPath();x.moveTo(X+110,Y+40);x.lineTo(X+150,Y+70);x.stroke();x.setLineDash([6,5]);x.strokeStyle='#E9C96A';x.strokeRect(X+96,Y+28,66,56);x.setLineDash([])}
  if(MSN.cond===2){x.fillStyle='#0F2B22';x.beginPath();x.moveTo(X+s,Y+s-60);x.lineTo(X+s-38,Y+s);x.lineTo(X+s,Y+s);x.fill();x.strokeStyle='#F2A65A';x.lineWidth=4;x.strokeRect(X+s-60,Y+s-74,64,78)}
  const k=MSN.cond===0?'camClean':MSN.cond===1?'camMaybe':'camDefect',d=MSN.cond===0?'No visible anomaly':MSN.cond===1?'Possible scratch':'Edge damage';
  const c=MSN.cond===1?'camLow':'camHigh',cd=MSN.cond===1?'Confidence: low':'Confidence: high';
  x.fillStyle='#F2EFE2';x.font='800 26px Manrope, sans-serif';wrapText(x,msnLabel(k,d),X+s+50,Y+40,w-(X+s+70),32);x.fillStyle=MSN.cond===1?'#E9C96A':'#35DC78';x.font='700 20px Inter, sans-serif';x.fillText(msnLabel(c,cd),X+s+50,Y+110)}
function icDrawAlert(x:CanvasRenderingContext2D,w:number,h:number){
  const ran=MSN.t0>=0,decided=ran&&MSN.u>=.55,r=icRoute();
  x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);x.fillStyle=!decided?'#0F2B22':r===2?'#B4472C':r===1?'#8A6A12':'#1E4632';x.fillRect(0,0,w,64);x.fillStyle='#F2EFE2';x.font='800 24px Manrope, sans-serif';x.textBaseline='middle';sp(x,'2px');x.fillText(msnLabel('laneH','REVIEW LANE'),22,33);sp(x,'0px');
  x.fillStyle='#0F2B22';x.font='700 26px Manrope, sans-serif';
  const msg=!ran?msnLabel('laneIdle','No part under the camera'):!decided?msnLabel('laneRun','Inspecting…'):MSN.cond===0?msnLabel('lanePass','Passed: no visible anomaly.'):MSN.cond===1?(MSN.revised?msnLabel('laneReview','Sent to human review: low confidence.'):msnLabel('laneAuto','Rejected automatically.')):msnLabel('laneReject','Rejected: edge damage.');
  wrapText(x,msg,22,110,w-44,36);
  x.fillStyle='#4C5A50';x.font='600 19px Inter, sans-serif';x.fillText(msnLabel('laneCtx','Each decision shows its image region'),22,h-56);x.fillText(msnLabel('laneEx','Example images · not a live line'),22,h-26)}
const AS_DOCS=['Customs declaration','Bill of materials','Export-rule summary','Supplier contract (restricted)'];
/** Retrieval state of each source for the current example: 0 not used, 1 used, 2 blocked, 3 used but not allowed, 4 no support. */
function asState(k:number):number{const c=MSN.cond;if(c===2)return k===3?0:4;if(k<3)return 1;if(c===0)return 0;return MSN.revised?2:3}
function asDrawTrace(x:CanvasRenderingContext2D,w:number,h:number){
  x.fillStyle='#0F2B22';x.fillRect(0,0,w,h);x.fillStyle='#E9C96A';x.font='800 22px Manrope, sans-serif';x.textBaseline='middle';sp(x,'3px');x.fillText(msnLabel('retT','RETRIEVAL · EXAMPLE SOURCES'),20,26);sp(x,'0px');
  if(MSN.t0<0){x.fillStyle='rgba(242,239,226,.7)';x.font='600 22px Inter, sans-serif';x.fillText(msnLabel('retWait','Ask a question to see which sources are used'),24,h/2);return}
  x.fillStyle='rgba(242,239,226,.8)';x.font='600 17px Inter, sans-serif';x.fillText(MSN.cond===1?msnLabel('rolePlan','Role: planner (no contract access)'):msnLabel('roleLog','Role: logistics coordinator'),24,60);
  const ST=['Not needed','Used','Blocked before retrieval','Used: not allowed for this role','No support for this question'],STK=['stNo','stUsed','stBlocked','stLeak','stNone'],COL=['rgba(242,239,226,.5)','#35DC78','#E9C96A','#F2A65A','rgba(242,239,226,.5)'];
  AS_DOCS.forEach((d,k)=>{const y=100+k*46,on=MSN.u>=.1+k*.08,s=asState(k);x.fillStyle='#F2EFE2';x.font='700 19px Inter, sans-serif';x.fillText(msnLabel('docN'+k,d),24,y);if(on){x.fillStyle=COL[s];x.font='700 17px Inter, sans-serif';x.textAlign='right';x.fillText(msnLabel(STK[s],ST[s]),w-20,y);x.textAlign='left'}})}
function asDrawAlert(x:CanvasRenderingContext2D,w:number,h:number){
  const ran=MSN.t0>=0,done=ran&&MSN.u>=.7,leak=MSN.cond===1&&!MSN.revised,none=MSN.cond===2;
  x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);x.fillStyle=!done?'#0F2B22':leak?'#B4472C':none?'#8A6A12':'#1E4632';x.fillRect(0,0,w,64);x.fillStyle='#F2EFE2';x.font='800 24px Manrope, sans-serif';x.textBaseline='middle';sp(x,'2px');
  x.fillText(done&&leak?msnLabel('ansLeak','RESTRICTED SOURCE USED'):done&&none?msnLabel('ansNone','NEEDS EVIDENCE'):msnLabel('ansH','DRAFT ANSWER · FOR REVIEW'),22,33);sp(x,'0px');
  x.fillStyle='#0F2B22';x.font='700 24px Manrope, sans-serif';
  const msg=!ran?msnLabel('ansIdle','No question asked yet'):!done?msnLabel('ansRun','Retrieving the permitted sources…'):none?msnLabel('ansNoneMsg','Not enough support in the approved sources. Please add the evidence needed.'):leak?msnLabel('ansLeakMsg','Missing: export licence number and net weight [1][2][3]. Contract terms [4].'):MSN.cond===1?msnLabel('ansRoleMsg','Missing: export licence number and net weight [1][2][3]. One document isn’t available to your role.'):msnLabel('ansOkMsg','Missing: export licence number and net weight [1][2][3].');
  wrapText(x,msg,22,108,w-44,32);
  x.fillStyle='#4C5A50';x.font='600 19px Inter, sans-serif';x.fillText(msnLabel('ansCtx','A person reviews every answer'),22,h-56);x.fillText(msnLabel('ansEx','Example documents · not real shipment data'),22,h-26)}
function icTick(now:number,dt:number){
  const [cx,,cz]=POD_PLACE.centre,u=MSN.t0>=0?MSN.u:0,r=icRoute(),c=IC.chip.position;
  IC.mark.material.opacity=MSN.t0>=0&&MSN.cond>0?(MSN.cond===1?.45:1):0;
  if(MSN.t0<0){c.set(cx-1.7,.9,cz);IC.arm.rotation.y=0;IC.ring.material.opacity=.35;return}
  const ex=cx-.2;let x=cx-1.7,y=.9,z=cz;
  if(u<.3)x=cx-1.7+(ex-(cx-1.7))*sm(0,.3,u);else if(u<.5)x=ex;else if(u<.7)x=ex+(cx+1.2-ex)*sm(.5,.7,u);
  else{x=cx+1.2;const k=sm(.7,.95,u);if(r===0)x=cx+1.2+.6*k;else if(r===1){x=cx+1.2+.6*k;z=cz+.75*k;y=.9-.25*k}else{x=cx+1.2+.6*k;z=cz-.95*k;y=.9-.38*k}}
  c.set(x,y,z);IC.ring.material.opacity=u>=.3&&u<.5?.7+.3*Math.abs(Math.sin(now/90)):.35;
  const sw=u>=.7&&u<.95&&r!==0?Math.sin(Math.PI*sm(.7,.95,u))*(r===1?-1:1)*.9:0;IC.arm.rotation.y+=(sw-IC.arm.rotation.y)*Math.min(1,dt*8)}
function asTick(){
  const u=MSN.t0>=0?MSN.u:0;
  AS.links.forEach((l,k)=>{const s=MSN.t0>=0?asState(k):0,on=u>=.1+k*.08;l.material.opacity=!on?.1:s===1||s===3?.95:s===4?.25:.1});
  AS.out.material.opacity=MSN.t0>=0&&u>=.45?(MSN.cond===2?.25:.95):.1;
  AS.lock.material.opacity=MSN.t0>=0&&MSN.cond===1&&MSN.revised&&u>=.3?1:.5}
function msnLabel(k:string,d:string){return MSN.labels[k]??d}
function msnDrawTrace(x:CanvasRenderingContext2D,w:number,h:number){if(MSN.mi===1)return icDrawTrace(x,w,h);if(MSN.mi===2)return asDrawTrace(x,w,h);
  x.fillStyle='#0F2B22';x.fillRect(0,0,w,h);x.fillStyle='#E9C96A';x.font='800 22px Manrope, sans-serif';x.textBaseline='middle';sp(x,'3px');x.fillText(msnLabel('traceT','SENSOR READINGS · EXAMPLE DATA'),20,26);sp(x,'0px');
  const L=24,R=w-20,T=58,B=h-34,u=MSN.u,N=140;
  if(MSN.revised&&MSN.cond===1){x.fillStyle='rgba(233,201,106,.16)';x.fillRect(L+(R-L)*MSN_CUT[0],T,(R-L)*(MSN_CUT[1]-MSN_CUT[0]),B-T);x.fillStyle='#E9C96A';x.font='700 16px Inter, sans-serif';x.fillText(msnLabel('cut','Scheduled heavy cut'),L+(R-L)*MSN_CUT[0]+6,T+14)}
  const thr=B-(B-T)*.55;x.strokeStyle='rgba(242,239,226,.4)';x.setLineDash([6,6]);x.lineWidth=2;x.beginPath();x.moveTo(L,thr);x.lineTo(R,thr);x.stroke();x.setLineDash([]);
  const draw=(k:number,c:string)=>{x.strokeStyle=c;x.lineWidth=4;x.beginPath();for(let i=0;i<=N;i++){const uu=i/N;if(uu>u)break;const y=B-(B-T)*msnSig(MSN.cond,uu)[k];if(i)x.lineTo(L+(R-L)*uu,y);else x.moveTo(L,y)}x.stroke()};
  draw(0,'#35DC78');draw(1,'#F2A65A');
  x.font='700 17px Inter, sans-serif';x.fillStyle='#35DC78';x.fillText(msnLabel('vib','Vibration'),L,h-16);x.fillStyle='#F2A65A';x.fillText(msnLabel('temp','Temperature'),L+130,h-16);x.fillStyle='rgba(242,239,226,.6)';x.fillText(msnLabel('thr','Alert line'),R-110,thr-12)}
function msnDrawAlert(x:CanvasRenderingContext2D,w:number,h:number){if(MSN.mi===1)return icDrawAlert(x,w,h);if(MSN.mi===2)return asDrawAlert(x,w,h);
  const ran=MSN.t0>=0,done=MSN.u>=1,alert=ran&&[...Array(41)].some((_,i)=>i/40<=MSN.u&&msnAlertAt(MSN.cond,MSN.revised,i/40));
  x.fillStyle='#F2EFE2';x.fillRect(0,0,w,h);x.fillStyle=alert?'#B4472C':'#0F2B22';x.fillRect(0,0,w,64);x.fillStyle='#F2EFE2';x.font='800 24px Manrope, sans-serif';x.textBaseline='middle';sp(x,'2px');
  x.fillText(alert?msnLabel('alertH','ALERT · SPINDLE BEARING'):msnLabel('okH','SPINDLE BEARING · WATCHING'),22,33);sp(x,'0px');
  x.fillStyle='#0F2B22';x.font='700 26px Manrope, sans-serif';
  const msg=!ran?msnLabel('idle','No cycle running'):alert?(MSN.cond===2?msnLabel('wearMsg','Early wear signs. Inspect at the next planned stop.'):msnLabel('loadMsg','Vibration above the alert line.')):(MSN.revised&&MSN.cond===1&&done?msnLabel('ctxMsg','Heavy cut scheduled. Reading expected, no alert.'):done?msnLabel('okMsg','Cycle complete. No alert.'):msnLabel('runMsg','Reading the cycle…'));
  const words=msg.split(' ');let line='',y=110;words.forEach(wd=>{const t=line?line+' '+wd:wd;if(x.measureText(t).width>w-44){x.fillText(line,22,y);y+=36;line=wd}else line=t});x.fillText(line,22,y);
  x.fillStyle='#4C5A50';x.font='600 19px Inter, sans-serif';x.fillText(msnLabel('ctx','Context: job schedule, tool, operating hours'),22,h-56);x.fillText(msnLabel('ex','Example data · not a live machine'),22,h-26)}
const MSN_X=POD_PLACE.centre[0]-.25;
function msnTick(now:number,dt:number){
  if(!MS.g.visible)return;
  if(MSN.t0>=0){MSN.u=reduce?1:Math.min(1,(now-MSN.t0)/MSN_DUR)}
  const u=MSN.u,running=MSN.t0>=0&&u<1,[v]=MSN.t0>=0?msnSig(MSN.cond,u):[0];
  if(MSN.mi===1)icTick(now,dt);else if(MSN.mi===2)asTick();
  MS.spindle.position.x=MSN_X+(running&&MSN.mi===0?Math.sin(u*Math.PI*6)*.6:0);MS.spindle.position.y=running?(Math.sin(now/22)*.02*v):0;
  MS.sensors.forEach(s=>{s.material.opacity=running?.6+.4*Math.abs(Math.sin(now/180)):.9});
  const key=MSN.mi+'|'+Math.round(u*120)+'|'+MSN.cond+'|'+MSN.revised+'|'+MSN.t0;if(key!==MSN.last){MSN.last=key;MS.traceT?.redraw();MS.alertT?.redraw()}
  MS.people.forEach((p,i)=>{const on=MSN.sel===i,k=Math.min(1,dt*6);p.ring.material.opacity+=((MSN.sel<0?.3:on?.95:.12)-p.ring.material.opacity)*k;const sc=on?1.35:1;p.ring.scale.setScalar(p.ring.scale.x+(sc-p.ring.scale.x)*k);
    p.mark.material.opacity+=((on?1:0)-p.mark.material.opacity)*k;p.mark.rotation.y=now/600;p.link.material.opacity+=((on?.9:0)-p.link.material.opacity)*k})}
/** Development: render cost of the last frames (CPU time to submit, draw calls, triangles). */
const STATS={ms:0,calls:0,tris:0};
const DTMP=new THREE.Vector3();
/** Zoom the globe camera onto the chosen diorama and play its three steps (sample input, AI draft, you check). */
function dioTick(now:number,dt:number){
  G.zoomE+=((G.zoom>=0&&G.done?1:0)-G.zoomE)*(reduce?1:Math.min(1,dt*1.7));if(G.zoomE<.002&&G.zoom<0)G.zoomE=0;
  const D=DIOS.find(x=>x.node===G.zoomL);
  DIOS.forEach(x=>{x.g.visible=x===D&&G.zoomE>.01&&G.done});
  if(!D||!D.g.visible)return;
  globeG.updateMatrixWorld();
  const cl=D.pivot.worldToLocal(DTMP.copy(GPOS)),yaw=Math.atan2(cl.x,cl.z);D.g.rotation.y=yaw;D.g.position.set(Math.sin(yaw)*2.7,0,Math.cos(yaw)*2.7);D.g.updateMatrixWorld();
  const up=NODES[D.node].n.clone().applyQuaternion(Rcur),cen=D.g.getWorldPosition(new THREE.Vector3()),t2=GPOS.clone().sub(cen),fwd=t2.sub(up.clone().multiplyScalar(t2.dot(up))).normalize(),rt=up.clone().cross(fwd).normalize();
  const narrow=innerWidth<=760,pan=rt.clone().multiplyScalar(narrow?0:.95*G.panelE).addScaledVector(up,narrow?-1.7*G.panelE:0),zp=cen.clone().addScaledVector(fwd,narrow?7.6:4.3).addScaledVector(up,narrow?3.3:1.9).add(pan),zl=cen.clone().addScaledVector(up,.55).add(pan);
  const e=sm(0,1,G.zoomE);C.position.lerp(zp,e);lt.lerp(zl,e);
  const r=sm(.5,1,G.zoomE);
  let cur=G.dioStep;if(cur<0){const t=((now-G.dioT0)/1000)%11.5;cur=reduce?2:Math.min(2,Math.floor(t/3.4))}G.dioCur=cur;
  D.labels.forEach((m,i)=>{m.material.opacity=r*(i===cur?1:.42);const sc=i===cur?1.1:.92;m.scale.set(1.6*sc,.35*sc,1)});
  D.screen.opacity=r*(cur>=1?1:.35);
  const tg=D.st[cur];D.token.material.opacity=r;D.token.position.x+=(tg.x-D.token.position.x)*Math.min(1,dt*3.5);D.token.position.z+=((tg.z+.3)-D.token.position.z)*Math.min(1,dt*3.5);D.token.position.y=2.3+Math.sin(Math.PI*Math.min(1,Math.abs(tg.x-D.token.position.x)/2.3))*.5;
  const ck=cur===2?1:0;D.checkM.forEach(m=>{m.opacity+=(ck*r-m.opacity)*Math.min(1,dt*5)});D.check.scale.setScalar(.6+.4*D.checkM[0].opacity);D.check.lookAt(C.position);
  D.labels.forEach(m=>m.lookAt(C.position));
}
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
// DEPLOY COURTYARD: the reviewed system demonstrated to an employer (technician screen, a team member, the employer).
let DEMO={title:'DEMONSTRATION · REVIEWED VERSION',lines:['',''],note:'Example data · not a live system'};
const demoTex=ctex(768,480,(x,w,h)=>{x.fillStyle='#0F2B22';x.fillRect(0,0,w,h);x.fillStyle='#C9A33A';x.font='800 34px Manrope, sans-serif';x.fillText(DEMO.title,30,56);
  x.fillStyle='#E9F4EC';x.font='600 30px Inter, sans-serif';DEMO.lines.forEach((t,i)=>{let s2=t;while(s2.length>3&&x.measureText(s2).width>w-60)s2=s2.slice(0,-2);x.fillText(s2===t?t:s2.slice(0,-1)+'…',30,130+i*58)});
  x.fillStyle='#7BE3A6';x.font='700 24px Inter, sans-serif';x.fillText(DEMO.note,30,h-36)});
{const prev=TG;TG=factoryG;const dc=area('demoCourt',{c:V(0,4,-76),full:44,start:70});
 box(dc,-3.3,0,-80.6,2.4,.74,1,{tone:'fine'});box(dc,-3.3,.74,-80.6,2.5,.06,1.08,{solid:'wood'});
 // The display faces the courtyard (and the camera); the technician sits beside it, the team member explains, the employer asks.
 plane(dc,-3.3,1.6,-80.25,1.5,.94,{rx:.12,ry:Math.PI,mat:amat(dc,0xffffff,1,demoTex),tone:'ink'});line(dc,'fine',[-3.3,.8,-80.25],[-3.3,1.13,-80.25]);
 figure(dc,'sit',-4.75,0,-80.8,0,1);figure(dc,'point',-1.55,0,-80.9,face(-1.55,-80.9,[-3.3,0,-80.25]));figure(dc,'stand',-3.9,0,-82.7,face(-3.9,-82.7,[-3.3,0,-80.4]));
 hring(dc,'gold',-3.3,.02,-80.6,2.4);TG=prev}
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
/** Verify: trace one evidence source from its origin (e.g. the selected person's work at the POD) into its gate. */
const TRACE={i:-1,t0:0,line:new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:GOLD})),dots:[] as THREE.Mesh[],cv:null as THREE.CatmullRomCurve3|null};
TRACE.line.visible=false;TRACE.line.userData.noRay=true;factoryG.add(TRACE.line);
{const dm=new THREE.MeshBasicMaterial({color:GOLD});for(let j=0;j<6;j++){const d=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),dm);d.visible=false;d.userData.noRay=true;factoryG.add(d);TRACE.dots.push(d)}}
function setTrace(i:number,from:P3|null){TRACE.i=i;TRACE.t0=performance.now();const on=i>=0&&!!GATES[i];TRACE.line.visible=on;TRACE.dots.forEach(d=>d.visible=on);if(!on){TRACE.cv=null;return}
  const g=GATES[i],s0=from?V(...from):SRC[i].clone(),pts=s0.y<3?[s0,V(s0.x,2.6,s0.z+3.5),V(12,6.8,-23.5),V(14.5,6.9,-31.5),V(16.5,6.9,-37),V(g.gx,6.9,g.gz)]:[s0,V(s0.x,7.3,-32.6),V(14.5,6.9,-32),V(16.5,6.9,-37),V(g.gx,6.9,g.gz)];
  TRACE.cv=new THREE.CatmullRomCurve3(pts,false,'centripetal');TRACE.line.geometry.dispose();TRACE.line.geometry=new THREE.BufferGeometry().setFromPoints(TRACE.cv.getPoints(160))}
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
/** Company assembly (opening): everything above the build height is cut away; a gold edge marks the cut. */
const BUILDY={value:1e4},NOBUILD={value:1e4},CLIP=new THREE.Plane(V(0,-1,0),1e4),PEOPLE:THREE.Mesh[]=[];

// OPENING WORKBENCH: a learner and a peer with the source notebook, on the plaza beside the entrance.
// Built in its own group (outside factoryG) so the assembly cut never hides it.
const OPG=new THREE.Group();S.add(OPG);let opState=0;
const opA=area('opening',{fixed:1,parent:OPG});
const OPX=-6.5,OPZ=12;
const noteTex=ctex(768,512,(x,w,h)=>{x.fillStyle='#FBF8EE';x.fillRect(0,0,w,h);x.fillStyle='#E6DFC9';x.fillRect(w/2-3,0,6,h);
  x.fillStyle='#1E4632';x.font='800 34px Manrope, sans-serif';x.fillText('Machine 3 notes',28,56);
  x.font='500 26px Inter, sans-serif';const rows=[['Spindle hum louder','09:40 · J. schedule'],['Vibration after tool change','11:15 · J. schedule'],['Warm housing, long cut',opState>=1?'14:05 · job 2217':'source ?']];
  rows.forEach(([a,b],i)=>{const y=120+i*92,miss=i===2&&opState<1;x.fillStyle='#1E4632';x.fillText(a,28,y);x.fillStyle=miss?'#B5481F':'#3E6B54';x.fillText(b,28,y+36);
    x.strokeStyle='#D8D0B8';x.lineWidth=2;x.beginPath();x.moveTo(24,y+56);x.lineTo(w/2-20,y+56);x.stroke();
    if(miss){x.strokeStyle='#C9A33A';x.lineWidth=5;x.setLineDash([12,8]);x.strokeRect(16,y-34,w/2-36,84);x.setLineDash([])}});
  x.fillStyle='#1E4632';x.font='700 26px Inter, sans-serif';x.fillText(opState>=2?'Reviewed: context added':'Questions',w/2+30,56);
  x.font='500 24px Inter, sans-serif';x.fillStyle='#3E6B54';
  (opState>=2?['Heavy cut on job 2217','explains the warm housing.','Linked to the POD record.']:['Which job was running?','Who can confirm it?']).forEach((t,i)=>x.fillText(t,w/2+30,110+i*40));
  if(opState>=2){x.strokeStyle='#2E8B57';x.lineWidth=6;x.beginPath();x.moveTo(w-90,h-90);x.lineTo(w-66,h-62);x.lineTo(w-30,h-112);x.stroke()}});
{const prev=TG;TG=OPG;
 box(opA,OPX,0,OPZ,2.6,.72,1.05,{tone:'fine'});box(opA,OPX,.72,OPZ,2.7,.06,1.12,{solid:'wood'});
 figure(opA,'sit',OPX-.35,0,OPZ-.95,-Math.PI/2,1);cyl(opA,OPX-.35,.22,OPZ-.95,.24,.44,{tone:'fine'});
 figure(opA,'point',OPX+1.75,0,OPZ-.55,face(OPX+1.75,OPZ-.55,[OPX-.3,0,OPZ+.1]));
 plane(opA,OPX-.3,.785,OPZ+.08,1.15,.78,{rx:-Math.PI/2,mat:amat(opA,0xffffff,1,noteTex),tone:'ink'});
 box(opA,OPX-1.05,.75,OPZ+.02,.56,.03,.4,{ry:.5,solid:'green',tone:null});plane(opA,OPX-1.15,.93,OPZ-.15,.56,.38,{rx:-.3,ry:.5,mat:amat(opA,0x2B4A3C),tone:'fine'});
 cyl(opA,OPX+.95,.86,OPZ-.25,.08,.2,{tone:'fine'});[[-.02,.02],[.03,-.01],[0,.04]].forEach(([dx,dz])=>line(opA,'gold',[OPX+.95+dx,.9,OPZ-.25+dz],[OPX+.95+dx*2,1.08,OPZ-.25+dz*2]));
 plant(OPX-1.7,0,OPZ-2.6,1.1,true);
 TG=prev}
/** The physical gap tab and the source card the peer brings (opening beat 1). */
const opTab=new THREE.Mesh(new THREE.BoxGeometry(.06,.012,.16),new THREE.MeshBasicMaterial({color:0xC9A33A}));opTab.position.set(OPX-.9,.79,OPZ+.3);OPG.add(opTab);
const srcCard=new THREE.Mesh(new THREE.PlaneGeometry(.34,.24),new THREE.MeshBasicMaterial({map:ctex(256,180,(x,w,h)=>{x.fillStyle='#FFFDF5';x.fillRect(0,0,w,h);x.strokeStyle='#C9A33A';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);x.fillStyle='#1E4632';x.font='800 26px Manrope, sans-serif';x.fillText('JOB SCHEDULE',16,40);x.font='500 22px Inter, sans-serif';x.fillText('14:00  job 2217',16,90);x.fillText('heavy cut · 40 min',16,126)})}));
srcCard.rotation.x=-Math.PI/2;srcCard.rotation.z=.25;srcCard.position.set(OPX+.55,.79,OPZ+.3);srcCard.visible=false;OPG.add(srcCard);
const setOpState=(n:number)=>{opState=n;noteTex.redraw();srcCard.visible=n>=1;(opTab.material as THREE.MeshBasicMaterial).color.set(n>=2?0x2E8B57:0xC9A33A)};
let clipKids=-1;
function setBuild(p:number){if(p>=1){BUILDY.value=1e4;CLIP.constant=1e4;PEOPLE.forEach(m=>m.visible=true);return}
  // Meshes added after the build (opening doors, brand extras) join the cut too.
  if(factoryG.children.length!==clipKids){clipKids=factoryG.children.length;factoryG.traverse(o=>{const mm=(o as THREE.Mesh).material;if(!mm||o instanceof THREE.LineSegments)return;(Array.isArray(mm)?mm:[mm]).forEach(x=>{if(!x.clippingPlanes&&!x.userData.noClip)x.clippingPlanes=[CLIP]})});}
  const h=1.3+Math.pow(Math.max(0,p),1.15)*34;BUILDY.value=h;CLIP.constant=h;PEOPLE.forEach(m=>m.visible=p>.9)}
// BUILD LINE GEOMETRY (merged per area and tone)
const VS=`attribute float lineU;attribute float delay;varying float vU;varying float vD;varying float vDepth;varying float vY;
void main(){vU=lineU;vD=delay;vY=(modelMatrix*vec4(position,1.0)).y;vec4 mv=modelViewMatrix*vec4(position,1.0);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
const FS=`uniform vec3 uColor;uniform vec3 uPaper;uniform float uReveal;uniform vec2 uFog;uniform float uDim;uniform float uBuild;varying float vU;varying float vD;varying float vDepth;varying float vY;
void main(){float r=clamp((uReveal-vD)/0.55,0.0,1.0);if(r<=0.0||vU>r)discard;vec3 c=vY>uBuild?mix(uPaper,uColor,0.2):vY>uBuild-0.35?vec3(0.79,0.64,0.23):uColor;float f=max(smoothstep(uFog.x,uFog.y,vDepth)*0.92,uDim);gl_FragColor=vec4(mix(c,uPaper,f),1.0);
#include <colorspace_fragment>
}`;
VXQ.forEach(({tg,a,c,ms})=>{const g=mergeGeometries(ms.map(m=>BOX.clone().applyMatrix4(m)),false);if(!g)return;const o=new THREE.Mesh(g,vmat(a,c));tg.add(o);if(tg!==OPG)PEOPLE.push(o)});VXQ.clear();
{const geo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),m4=new THREE.Matrix4(),q0=new THREE.Quaternion();
 SHQ.forEach((q,tg)=>{const n=q.length/5,o=new THREE.InstancedMesh(geo,SHADOW_MAT,n);for(let i=0;i<n;i++){const k=i*5;m4.compose(V(q[k],q[k+1],q[k+2]),q0,V(q[k+3],1,q[k+4]));o.setMatrixAt(i,m4)}o.userData.noRay=true;o.renderOrder=-1;tg.add(o)});SHQ.clear()}
// Batch static helper meshes per (parent, material): ~1000 draws become ~150.
{const groups=new Map<string,THREE.Mesh[]>();const seen=new Set<THREE.Object3D>();S.traverse(o=>{if(!(o as THREE.Mesh).isMesh||!o.userData.b||!o.parent)return;seen.add(o.parent);const m=o as THREE.Mesh,k=o.parent.uuid+'/'+(m.material as THREE.Material).uuid;let g=groups.get(k);if(!g)groups.set(k,g=[]);g.push(m)});
 groups.forEach(ms=>{if(ms.length<2)return;const geo=mergeGeometries(ms.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),false);if(!geo)return;const parent=ms[0].parent!,o=new THREE.Mesh(geo,ms[0].material);o.matrixAutoUpdate=false;ms.forEach(m=>parent.remove(m));parent.add(o)});void seen}
AREAS.forEach(a=>{
  let lo=1e9,hi=-1e9;Object.values(a.L!).forEach(arr=>{for(let i=1;i<arr.length;i+=3){lo=Math.min(lo,arr[i]);hi=Math.max(hi,arr[i])}});const span=Math.max(1,hi-lo);
  Object.entries(a.L!).forEach(([t,arr])=>{if(!arr.length)return;const n=arr.length/6,u=new Float32Array(n*2),dl=new Float32Array(n*2);
    for(let i=0;i<n;i++){if(a.LU){u[i*2]=a.LU[i*2];u[i*2+1]=a.LU[i*2+1]}else u[i*2+1]=1;const d=(a.name==='grid'||a.grow)?0:((arr[i*6+1]+arr[i*6+4])/2-lo)/span*.3+Math.random()*.15;dl[i*2]=dl[i*2+1]=d}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.setAttribute('lineU',new THREE.BufferAttribute(u,1));g.setAttribute('delay',new THREE.BufferAttribute(dl,1));
    const glb=a===gA||a===gRim||a===gArc;
    (a.parent||factoryG).add(new THREE.LineSegments(g,new THREE.ShaderMaterial({uniforms:{uColor:{value:glb?GLC[t as Tone]:TONES[t as Tone]},uPaper:{value:glb?GLP:PAPER},uReveal:a.u,uFog:FOGU,uDim:(a.dimU||(a.dimU={value:0})),uBuild:a===opA||glb?NOBUILD:BUILDY},vertexShader:VS,fragmentShader:FS})));
  });a.L=null;
});
grd.u.value=1;grd.r=1;
if(import.meta.env.DEV)(window as unknown as {__S:THREE.Scene}).__S=S;
// Assembly clipping: the opening workbench keeps its own (unclipped) materials; everything in the company is cut.
{const own=new Map<THREE.Material,THREE.Material>();OPG.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.material===opTab.material||m.material===srcCard.material)return;const mt=m.material as THREE.Material;if(opA.mats.includes(mt))return;let c=own.get(mt);if(!c){c=mt.clone();own.set(mt,c)}m.material=c});
 R.localClippingEnabled=true;const cl=new Set<THREE.Material>();factoryG.traverse(o=>{const mm=(o as THREE.Mesh).material;if(!mm||o instanceof THREE.LineSegments)return;(Array.isArray(mm)?mm:[mm]).forEach(x=>{if(!x.userData.noClip)cl.add(x)})});cl.forEach(x=>{x.clippingPlanes=[CLIP]})}

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
// One site-wide motion setting (src/app/motion.ts); Lighter 3D also stills ambient animation.
let reduce=motion.reduced;motion.on(v=>{reduce=v});
quality.on(()=>{R.setPixelRatio(quality.pixelRatio());R.setSize(innerWidth,innerHeight,false)});
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
const look=V(0,0,0),tmp=V(0,0,0),lt=V(0,0,0),snapP=V(0,0,0),snapL=V(0,0,0);let lastT=performance.now();
const Rcur=R0.clone(),ONE=V(1,1,1),TMPM=new THREE.Matrix4(),T30=new THREE.Matrix4().makeTranslation(0,0,30);
const G:SceneState={fogB:0,actor:0,hlA:[0,0,0,0],gsel:-1,gdE:0,dist:0,wf:false,bayHv:-1,baySel:[],stop:-1,cam:{t0:-1},cc:{t0:-1},act:[0,1,4],con:-1,net:{sec:0,act:{c:1,i:1,g:1},mode:0,links:[]},netA:0,bayDim:[],units:[],pod:{on:false,t0:0},podGv:-1,podLead:[],zoom:-1,zoomL:-1,zoomE:0,dioStep:-1,dioT0:0,dioCur:0,crate:null,ticks:[],walk:false,et:{on:false,t0:0},gl:null,car:0,sample:false,sh:0,shE:0,hover:null,spine:false,spT0:0,fs:1,gV:0,arcs:0,done:false,dir:null,focus:null,panel:0,panelE:0,A:null,B:null,podK:0,podI:0,podTA:0,podAE:0};
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
  setHover(k){G.hover=k},poseAt(p,l){C.position.set(p[0],p[1],p[2]);look.set(l[0],l[1],l[2])},build(p){setBuild(p)},opNote(n){setOpState(n)},devNote(d){devNote=d;devTex.redraw();devLink.visible=d.state===2},demoScreen(t,l,n){DEMO={title:t,lines:l,note:n};demoTex.redraw()},specPod(i){const q=SPEC_P[i];if(!q){specMark.visible=false;return null}specMark.position.set(q[0],8.6,q[1]);specMark.visible=true;return [q[0],6,q[1]]},
  setWf(on){G.wf=on},setBays(hv,sel,dim){G.bayHv=hv;G.baySel=sel;G.bayDim=dim},setUnits(u){G.units=u},setTeam(n){if(teamName.v!==n){teamName.v=n;teamTex.redraw()}},wfStop(i){G.stop=i},campusIn(r){if(G.cam.t0<0||r){G.cam.t0=performance.now();G.cc.t0=-1}},podCross(){G.cc.t0=Math.max(performance.now(),G.cam.t0+2700)},setCampus(a,c){G.act=a;G.con=c},setActor(i){G.actor=i},setNet(o){G.net=o},
  pod(on){if(on&&!G.pod.on)G.pod.t0=performance.now();G.pod.on=on},setPodLead(l){G.podLead=l},globeZoom(i){if(i>=0&&!DIOS.some(D=>D.node===i))i=-1;if(i>=0&&i!==G.zoom){G.dioStep=-1;G.dioT0=performance.now()}G.zoom=i;if(i>=0){G.zoomL=i;/* Profession on top, the company (NF) behind it, away from the camera. */const n=NODES[i].n,fb=NF.clone().sub(n.clone().multiplyScalar(NF.dot(n))).normalize(),r=fb.clone().cross(n).normalize(),L=new THREE.Matrix4().makeBasis(r,n,fb),W=new THREE.Matrix4().makeBasis(V(1,0,0),V(0,1,0),V(0,0,-1));G.focus={q0:Rcur.clone(),q1:new THREE.Quaternion().setFromRotationMatrix(W.multiply(L.transpose())),t0:performance.now()}}},dioStep(k){G.dioStep=k;if(k<0)G.dioT0=performance.now()},dioAt(){return G.dioCur},stats(){return {ms:+STATS.ms.toFixed(2),calls:STATS.calls,tris:STATS.tris,dpr:R.getPixelRatio()}},podSelect(i){MSN.sel=i},podRun(c,revised){MSN.cond=c;MSN.revised=revised;MSN.t0=performance.now();MSN.u=0},podReset(){MSN.t0=-1;MSN.u=0;MSN.revised=false},podMission(i){if(i===MSN.mi)return;MSN.mi=i;MSN.t0=-1;MSN.u=0;MSN.revised=false;MS.mach.visible=i===0;IC.g.visible=i===1;AS.g.visible=i===2;MSN.last='';MS.traceT?.redraw();MS.alertT?.redraw()},podState(){const ran=MSN.t0>=0;return{ran,u:MSN.u,done:ran&&MSN.u>=1,alert:msnFlag(),cond:MSN.cond,revised:MSN.revised,mi:MSN.mi}},podLabels(l){MSN.labels=l;MS.traceT?.redraw();MS.alertT?.redraw();MSN_DOCTEX.forEach(t=>t.redraw())},gallery(){return GALLERY.map(g=>({at:g.at,face:g.face}))},dioDebug(){const D=DIOS.find(x=>x.node===G.zoomL);if(!D)return null;return{yaw:D.g.rotation.y,cam:C.position.toArray().map(v=>+v.toFixed(2)),labels:D.labels.map(m=>{const p=m.getWorldPosition(new THREE.Vector3());const q=p.clone().project(C);return [p.toArray().map(v=>+v.toFixed(2)),[Math.round((q.x+1)/2*innerWidth),Math.round((1-q.y)/2*innerHeight)]]})}},hasDio(i){return DIOS.some(D=>D.node===i)},podJump(i){G.pod.on=true;G.pod.t0=performance.now()-(4200+i*2600)},podG(){return G.pod.on?G.podGv:-1},podTime(){return G.pod.on?(performance.now()-G.pod.t0)/1000:0},setCrate(g){G.crate=g},setTicks(a){G.ticks=a},setWalk(on){G.walk=on},
  rayWhat(a,b){const A=V(...a),dir=V(...b).sub(A),len=dir.length();dir.normalize();factoryG.updateMatrixWorld(true);const rc=new THREE.Raycaster(A,dir,0,len);rc.camera=C;const nm=new THREE.Vector3();return rc.intersectObject(factoryG,true).filter(h=>(h.object as THREE.Mesh).isMesh&&h.face).slice(0,4).map(h=>{const m=h.object as THREE.Mesh;let vis=true;for(let o:THREE.Object3D|null=m;o;o=o.parent)if(!o.visible)vis=false;nm.copy(h.face!.normal).transformDirection(m.matrixWorld);const mat=m.material as THREE.MeshBasicMaterial;return {name:(()=>{let o:THREE.Object3D|null=m,n='';for(;o&&!n;o=o.parent)n=o.name;return n})(),parentKids:m.parent?.children.length,p:[h.point.x,h.point.y,h.point.z].map(v=>+v.toFixed(2)),vis,ny:+nm.y.toFixed(2),geo:(m.geometry as THREE.BufferGeometry).type,op:mat.opacity,tr:mat.transparent,cw:mat.colorWrite,dw:mat.depthWrite,size:(()=>{(m.geometry as THREE.BufferGeometry).computeBoundingBox();const b=(m.geometry as THREE.BufferGeometry).boundingBox!;return [b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z].map(v=>+v.toFixed(1))})()}})},
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
  glance(i){G.gl={p:SRC[i].clone(),i,t0:performance.now()}},etafTrace(i,from){setTrace(i,from)},
  pick(cx,cy,stop){NDC.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);RAY.setFromCamera(NDC,C);const hs=RAY.intersectObjects(HIT.filter(m=>m.userData.stop===stop),false);return hs.length?hs[0].object.userData.k:null},setCareer(f,s,sh){G.car=f;G.sample=s;G.sh=sh},setSpine(on){if(on&&!G.spine)G.spT0=performance.now();G.spine=on},outline:()=>OUT,
  poseRoute(r,k){const Q=ROUTES[r],u=Math.min(1,Math.max(0,k/(Q.wp.length-1)));Q.pc!.getPoint(u,C.position);Q.lc!.getPoint(u,look)},
  snapshot(){snapP.copy(C.position);snapL.copy(look)},
  poseBack(t){const e=sm(0,1,t);const q=podCam(G.podK);C.position.lerpVectors(snapP,q.p,e);C.position.y+=Math.sin(Math.PI*e)*8;look.lerpVectors(snapL,q.l,e)},
  render(mode,introS){
    if(innerHeight>0&&!(Math.abs(C.aspect-innerWidth/innerHeight)<=1e-4)){fitExt();R.setPixelRatio(quality.pixelRatio());C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight,false);CR.setSize(innerWidth,innerHeight)}
    const now=performance.now(),dt=Math.min(.1,(now-lastT)/1000);lastT=now;podsTick(mode,dt);
    if(G.focus){const k=reduce?1:Math.min(1,(now-G.focus.t0)/900);Rcur.slerpQuaternions(G.focus.q0,G.focus.q1,sm(0,1,k));if(k>=1)G.focus=null}
    if(G.done)G.arcs=Math.min(1,G.arcs+dt*(reduce?9:.6));
    G.panelE+=((G.panel?1:0)-G.panelE)*Math.min(1,dt*5);
    globeG.quaternion.copy(Rcur);
    factoryG.matrix.compose(GC,Rcur,ONE).multiply(TMPM.compose(NF.clone().multiplyScalar(GR),QF,V(G.fs,G.fs,G.fs))).multiply(T30);factoryG.matrixWorldNeedsUpdate=true;
    gSphere.visible=G.gV>.001;
    {const k=sm(.2,.85,G.gV);BG.copy(PAPER).lerp(DARK,k);R.setClearColor(BG,1);(S.fog as THREE.Fog).color.copy(BG);GLP.copy(BG);
     (Object.keys(GLC) as Tone[]).forEach(t=>GLC[t].copy(TONES[t]).lerp(GLOW_T[t],k));sphereMat.color.copy(PAPER).lerp(SPHERE_DARK,k);LAND_PM?.color.copy(INK).lerp(GLOW_T.fine,k)}
    const hf=Math.max(0,C.position.y-18);G.fogB+=((G.wf&&G.stop===4?1:0)-G.fogB)*Math.min(1,dt*2);const fog=S.fog as THREE.Fog;fog.near=45+G.gV*70+hf*2+G.fogB*80;fog.far=190+G.gV*220+hf*5+G.fogB*160;FOGU.value.set(fog.near,fog.far);
    G.shE+=(G.sh-G.shE)*Math.min(1,dt*3);lt.copy(look);if(G.shE>.001){tmp.copy(lt).sub(C.position);const dd=tmp.length(),tx=Math.tan(C.fov*Math.PI/360)*Math.min(1.9,Math.max(1.3,C.aspect));tmp.normalize().cross(C.up).normalize();lt.addScaledVector(tmp,G.shE*dd*tx/3)}if(G.done)lt.x+=G.panelE*6;if(!reduce){lt.x+=mx*(G.done?.3:1.2);lt.y-=my*(G.done?.15:.6)}if(!reduce&&mode==='intro'){lt.x+=Math.sin(now/5200)*.5;lt.y+=Math.sin(now/7400)*.2}if(G.gl){const t=(performance.now()-G.gl.t0)/3400,w=sm(0,.28,t)*(1-sm(.72,1,t));lt.lerp(G.gl.p,w);if(t>=1)G.gl=null}dioTick(now,dt);C.lookAt(lt);
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
      const hl=G.gl&&G.gl.i===i;g.ln.visible=et.on;g.lnM.opacity=hl?.95:.28;g.dots.forEach((d,j)=>{const raw=raw0-j/7;d.visible=et.on&&raw>=0;if(!d.visible)return;const u=raw%1;g.cv.getPointAt(u,d.position);const sc=hl?1.8:1;d.scale.set(sc,sc,sc)});g.dm.opacity=et.on?.95:0});
     if(TRACE.cv&&TRACE.i>=0){const g=GATES[TRACE.i],u0=((now-TRACE.t0)/2600)%1;TRACE.dots.forEach((d,j)=>{TRACE.cv!.getPointAt((u0+j/6)%1,d.position)});if(g.sm2.map!==g.sm2.userData.lit)g.sm2.map=g.sm2.userData.lit;g.lm.opacity=Math.max(g.lm.opacity,.32)}}
    HOV.forEach(o=>{o.a+=((G.hover===o.k?1:0)-o.a)*Math.min(1,dt*6);o.dots.forEach((d,i)=>{d.visible=o.a>.01;if(!d.visible)return;const u=(now/(o.up?1700:2600)+i/o.dots.length)%1;o.curve.getPointAt(u,d.position);if(!o.up)d.position.y=.07;else{const s=1+u*2.2;d.scale.set(s,s,s)}d.material.opacity=o.a*Math.sin(Math.PI*u)*.95})});
    {const on=mode==='route'&&G.car>0;frostM.opacity=.62*G.car;recM.opacity=.28*G.car;gateM.opacity=(.16+.1*Math.sin(now/420))*G.car;COR.forEach((o,i)=>{o.visible=on;o.material=G.sample&&i===1?recM:frostM});GATE.visible=on;
     const inR=mode==='route';scanR.visible=inR;if(inR){scanR.position.y=6.4+(Math.sin(now/650)*.5+.5)*2.2}}
    SPM.forEach((m,i)=>{const t=G.spine&&now-G.spT0>i*380?m.userData.lit:m.userData.dark;if(m.map!==t)m.map=t});
    spMk.position.set(-19+((now/5200)%1)*38,SPY-.95,SPZ);
    G.gdE+=((G.gsel>=0&&G.gV>.5?1:0)-G.gdE)*Math.min(1,dt*4);[gA,gRim,gArc].forEach(a=>{if(a.dimU)a.dimU.value=.8*G.gdE});selR.visible=G.gsel>=0&&G.gV>.5&&G.zoomE<.05;if(selR.visible){const n=NODES[G.gsel].n;selR.position.copy(n).multiplyScalar(GR+.12);selR.quaternion.setFromUnitVectors(V(0,0,1),n);selM.opacity=.95*G.gdE}
    const im=mode==='intro'||mode==='globe';
    AREAS.forEach(a=>{
      if(a.name.startsWith('msn'))a.r=im?0:1;
      else if(a.name.startsWith('dio'))a.r=G.done&&a===DIOS.find(D=>D.node===G.zoomL)?.a?sm(.5,1,G.zoomE):0;
      else if(a===grd)a.r=1-sm(0,.5,G.gV);
      else if(a===brand.skyline)a.r=1-sm(.75,1,G.gV);
      else if(a===gA)a.r=G.gV;
      else if(a===gRim)a.r=G.done?sm(0,.35,G.arcs):Math.min(a.r,G.gV);
      else if(a===gArc)a.r=G.done?G.arcs:Math.min(G.arcs,G.gV);
      // The civic city ring is part of the visible city now (its paper fills always occluded anyway).
      else if(a===city)a.r=Math.max(G.dist,1-sm(.75,1,G.gV));
      else if(a===cityArcs)a.r=G.dist;
      else if(a===opA)a.r=im?0:1;
      else if(a.at!==undefined)a.r=mode==='intro'?(reduce?(introS>=a.at-.6?1:0):sm(a.at-.95,a.at-.05,introS)):1;
      else if(a.hy){const tg=im?0:sm(a.hy[0],a.hy[1],C.position.y);a.r=reduce?tg:a.r+(tg-a.r)*Math.min(1,dt*2.2)}
      else{const tg=im?0:1-sm(a.full!,a.start!,C.position.distanceTo(a.c!));
        if(reduce)a.r=im?0:Math.max(a.r,tg>.3?1:0);
        else if(tg>a.r)a.r=Math.min(tg,a.r+dt*1.1);
        else if(im)a.r=Math.max(0,a.r-dt*1.6);}
      a.u.value=a.r;a.mats.forEach(m=>{const op=m.userData.base*a.r;m.opacity=op;m.visible=a.r>.002;
        // Fully revealed solids draw in the opaque pass (hundreds of sorted transparent draws were the frame-rate cost).
        const tr=op<.999||m.blending!==THREE.NormalBlending||m.depthWrite===false;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}})});
    brand.tick(reduce||quality.light?0:now,dt);msnTick(now,dt);
    {const t0=performance.now();R.render(S,C);STATS.ms=STATS.ms*.9+(performance.now()-t0)*.1;STATS.calls=R.info.render.calls;STATS.tris=R.info.render.triangles}CR.render(S,C);
  },
  globeBegin(dir){G.dir=dir;G.done=false;G.focus=null;G.panel=0;G.A={p:C.position.clone(),l:lt.clone(),s:G.fs,q:Rcur.clone()};G.B=dir==='in'?{p:GPOS,l:GLOOK,s:SF,q:Rg}:{p:EXTP,l:EXTL,s:1,q:R0};if(dir==='in'){const a=G.A;G.cp=new THREE.CatmullRomCurve3([a.p.clone(),V(2,31,-4),V(0,62,-18),GPOS.clone()],false,'centripetal');G.cl=new THREE.CatmullRomCurve3([a.l.clone(),V(0,26.4,-10),V(0,4,-30),GLOOK.clone()],false,'centripetal')}},
  globeStep(t){const A=G.A!,B=G.B!;if(G.dir==='in'){const e=sm(0,1,t),e2=sm(.3,.92,t);G.cp!.getPoint(e,C.position);G.cl!.getPoint(e,look);G.fs=Math.exp(Math.log(A.s)+(Math.log(B.s)-Math.log(A.s))*e2);Rcur.slerpQuaternions(A.q,B.q,sm(.42,.95,t));G.gV=sm(.42,.88,t);G.dist=sm(.1,.3,t)*(1-sm(.6,.8,t));return}G.dist=0;const e=sm(0,1,t),e2=sm(.1,.9,t);C.position.lerpVectors(A.p,B.p,e);C.position.y+=Math.sin(Math.PI*e)*(G.dir==='in'?14:8);look.lerpVectors(A.l,B.l,e);G.fs=Math.exp(Math.log(A.s)+(Math.log(B.s)-Math.log(A.s))*e2);Rcur.slerpQuaternions(A.q,B.q,e2);G.gV=G.dir==='in'?sm(.3,.9,t):Math.min(G.gV,1-sm(.05,.55,t))},
  globeArrive(){G.done=true;C.position.copy(GPOS);look.copy(GLOOK)},
  globeHold(){C.position.copy(GPOS);look.copy(GLOOK)},
  globeReset(){G.zoom=-1;G.zoomE=0;G.dist=0;G.fs=1;Rcur.copy(R0);G.gV=0;G.arcs=0;G.done=false;G.dir=null;G.panel=0;G.panelE=0},
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
  drag(dx,dy){if(G.zoom>=0)return;G.focus=null;Rcur.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),dx*.006)).premultiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),dy*.006))},
  nodes(){globeG.updateMatrixWorld();const cam=C.position.clone().sub(GC).normalize();return NODES.map(nd=>{const w=nd.tip.clone().applyMatrix4(globeG.matrixWorld),n=nd.n.clone().applyQuaternion(Rcur),p=this.project(w.x,w.y,w.z);p.face=n.dot(cam);return p})},
  project(x,y,z){tmp.set(x,y,z).project(C);return{x:(tmp.x*.5+.5)*innerWidth,y:(-tmp.y*.5+.5)*innerHeight,vis:tmp.z>-1&&tmp.z<1&&Math.abs(tmp.x)<1.1&&Math.abs(tmp.y)<1.1}},
};
addEventListener('resize',()=>{C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix();R.setSize(innerWidth,innerHeight,false);CR.setSize(innerWidth,innerHeight)});
}
