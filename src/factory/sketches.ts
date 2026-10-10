// Line-drawn SVG sketches for the factory's scroll scenes (#svgA, #svgW, #svgB).
import { POSES, HEAD, type Pose } from '../data/content';

type Pt = [number, number];
type Sketch = ReturnType<typeof mk>;

function mk(id: string){
  const el=document.getElementById(id)!,P: string[]=[];
  const dx=(x: number)=>((x/1600)*.42+Math.random()*.08).toFixed(3);
  const at=(o: Record<string, number>)=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
  const g={
    line(x1: number,y1: number,x2: number,y2: number,c='ln'){P.push(`<line ${at({x1,y1,x2,y2})} pathLength="1" class="${c}" style="--d:${dx(Math.min(x1,x2))}"></line>`)},
    rect(x: number,y: number,w: number,h: number,c='ln',ex=''){P.push(`<rect ${at({x,y,width:w,height:h})} ${ex} pathLength="1" class="${c}" style="--d:${dx(x)}"></rect>`)},
    poly(pts: Pt[],c='ln',closed=true,ex=''){const t=closed?'polygon':'polyline';P.push(`<${t} points="${pts.map(p=>p.join(',')).join(' ')}" ${ex} pathLength="1" class="${c}" style="--d:${dx(Math.min(...pts.map(p=>p[0])))}"></${t}>`)},
    circ(cx: number,cy: number,r: number,c='ln',ex=''){P.push(`<circle ${at({cx,cy,r})} ${ex} pathLength="1" class="${c}" style="--d:${dx(cx-r)}"></circle>`)},
    path(d: string,x: number,c='ln'){P.push(`<path d="${d}" pathLength="1" class="${c}" style="--d:${dx(x)}"></path>`)},
    text(x: number,y: number,s: string,st: string){P.push(`<text x="${x}" y="${y}" class="fl" style="--d:${dx(x)};${st}">${s}</text>`)},
    fig(pose: Pose,x: number,y: number,h: number,f=1){const pts=POSES[pose].map((p): Pt=>[+(x+p[0]*h*f).toFixed(1),+(y-p[1]*h).toFixed(1)]);g.poly(pts,'ln fig');const hd=HEAD[pose];g.circ(+(x+hd[0]*h*f).toFixed(1),+(y-hd[1]*h).toFixed(1),+(.075*h).toFixed(1),'ln fig')},
    done(){el.innerHTML=P.join('')}
  };
  return g;
}
const GOLDF='fill="#C9A33A"',INKF='fill="#1E4632"';
function hex(g: Sketch,cx: number,cy: number,r: number,c: string,ex?: string){const p: Pt[]=[];for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;p.push([+(cx+Math.cos(a)*r).toFixed(1),+(cy+Math.sin(a)*r).toFixed(1)])}g.poly(p,c,true,ex)}
function rosette(g: Sketch,cx: number,cy: number,r: number){g.poly([[cx-r*.6,cy],[cx-r*1.1,cy+r*2.3],[cx-r*.3,cy+r*1.8],[cx,cy]],'fl',true,GOLDF);g.poly([[cx+r*.6,cy],[cx+r*1.1,cy+r*2.3],[cx+r*.3,cy+r*1.8],[cx,cy]],'fl',true,GOLDF);g.circ(cx,cy,r,'fl',GOLDF);g.circ(cx,cy,r,'ln')}
function cert(g: Sketch,x: number,y: number,w: number,h: number){g.rect(x,y,w,h,'ln fig');g.rect(x+7,y+7,w-14,h-14,'lf');g.line(x+w*.2,y+h*.3,x+w*.72,y+h*.3,'lf');g.line(x+w*.2,y+h*.46,x+w*.6,y+h*.46,'lf');const r=Math.max(6,Math.min(w,h)*.1);rosette(g,x+w-r*2.4,y+h-r*3,r)}

export function drawSketches(): void {
(function buildA(){
  const g=mk('svgA');
  g.rect(360,150,880,470,'ln');
  g.line(360,150,0,-40);g.line(1240,150,1600,-40);g.line(360,620,0,900);g.line(1240,620,1600,900);
  for(let k=0;k<=8;k++){const x=360+k*110;g.line(x,620,800+(x-800)*2.9,900,'lf')}
  [690,780,870].forEach(y=>{const o=(y-620)*360/280;g.line(360-o,y,1240+o,y,'lf')});
  [80,180,280].forEach(x=>{const t=150-(360-x)*190/360,b=620+(360-x)*280/360;g.line(x,t+50,x,b-150,'lf')});
  g.line(80,250,280,210,'lf');g.line(80,520,280,500,'lf');
  [1320,1420,1520].forEach(x=>{const t=150-(x-1240)*190/360,b=620+(x-1240)*280/360;g.line(x,t+60,x,b-170,'lf')});
  [[392,170,150,106],[562,166,112,84],[694,180,128,92],[842,168,112,84],[972,176,150,100],[1140,168,80,110],[392,300,120,86],[400,410,100,76],[1160,300,64,90]].forEach(([x,y,w,h])=>cert(g,x,y,w,h));
  g.rect(600,300,300,180,'ln fig');g.rect(612,312,276,130,'lf');g.circ(750,377,24,'ln');g.poly([[742,364],[742,390],[764,377]],'ln');g.rect(612,455,276,8,'lf');g.rect(612,455,170,8,'fl',GOLDF);
  g.rect(930,300,210,150,'fl',INKF);g.rect(930,300,210,150,'ln');[120,90,150,70,130,100,60].forEach((w,i)=>g.line(948,322+i*18,948+w,322+i*18,i%3?'lg':'lf'));
  hex(g,560,330,36,'fl',GOLDF);hex(g,560,330,36,'ln');g.text(546,340,'AI','font:800 26px Manrope,sans-serif;fill:#1E4632');
  hex(g,1190,480,30,'fl',INKF);g.text(1177,489,'AI','font:800 22px Manrope,sans-serif;fill:#C9A33A');
  g.fig('walk',150,880,330,1);
  g.line(385,790,372,650);g.line(378,790,470,790);g.line(392,790,380,860);g.line(462,790,472,860);
  g.poly([[480,640],[1040,640],[1120,715],[400,715]],'ln fig');g.poly([[400,715],[1120,715],[1120,728],[400,728]],'ln fig');
  g.line(410,728,410,880);g.line(1110,728,1110,880);g.line(490,640,490,760,'lf');g.line(1030,640,1030,760,'lf');
  g.fig('sit',430,860,300,1);
  g.rect(640,520,220,120,'ln fig');g.rect(652,532,196,88,'lf');g.poly([[735,558],[735,598],[770,578]],'ln');g.rect(660,626,180,6,'lf');g.rect(660,626,110,6,'fl',GOLDF);
  g.rect(925,606,126,18,'ln fig');g.rect(940,624,100,18,'ln fig');g.rect(930,642,120,18,'ln fig');
  g.fig('stand',1330,870,370,1);
  g.rect(1280,660,100,72,'ln fig');g.rect(1287,667,86,58,'lf');rosette(g,1358,700,9);
  g.done();
})();

function cvSheet(g: Sketch,x: number,y: number,w: number,hh: number,top: boolean){g.rect(x,y,w,hh,'ln fig');if(top)g.rect(x,y,w,hh*.08,'fl',GOLDF);g.circ(x+w*.2,y+hh*.18,w*.09,'lf');g.line(x+w*.36,y+hh*.15,x+w*.84,y+hh*.15,'ln');g.line(x+w*.36,y+hh*.24,x+w*.68,y+hh*.24,'lf');for(let k=0;k<5;k++)g.line(x+w*.12,y+hh*(.4+k*.1),x+w*(.88-(k%2)*.22),y+hh*(.4+k*.1),'lf')}
(function buildW(){
  const g=mk('svgW');
  g.rect(360,150,880,470,'ln');
  g.line(360,150,0,-40);g.line(1240,150,1600,-40);g.line(360,620,0,900);g.line(1240,620,1600,900);
  for(let k=0;k<=8;k++){const x=360+k*110;g.line(x,620,800+(x-800)*2.9,900,'lf')}
  [690,780,870].forEach(y=>{const o=(y-620)*360/280;g.line(360-o,y,1240+o,y,'lf')});
  [80,180,280].forEach(x=>{const t=150-(360-x)*190/360,b=620+(360-x)*280/360;g.line(x,t+50,x,b-150,'lf')});
  g.rect(420,200,300,230,'ln');g.line(570,200,570,430,'lf');g.line(420,315,720,315,'lf');
  g.circ(1150,236,34,'ln');g.line(1150,236,1150,212);g.line(1150,236,1166,246);
  g.rect(960,196,130,160,'ln fig');g.rect(960,196,130,24,'fl',GOLDF);g.text(972,213,'OPEN ROLE','font:800 12px Manrope,sans-serif;letter-spacing:1.5px;fill:#1E4632');[250,272,294,316].forEach((y,i)=>g.line(976,y,976+[92,70,84,56][i],y,'lf'));
  g.rect(730,410,150,180,'ln fig');g.rect(744,424,122,150,'lf');g.line(805,590,805,610);
  g.poly([[480,600],[1080,600],[1160,680],[400,680]],'ln fig');g.poly([[400,680],[1160,680],[1160,694],[400,694]],'ln fig');
  g.line(420,694,420,880);g.line(1140,694,1140,880);g.line(500,600,500,760,'lf');g.line(1060,600,1060,760,'lf');
  g.rect(540,480,170,110,'ln fig');g.rect(552,492,146,86,'lf');g.line(625,590,625,612);g.line(595,612,655,612);
  for(let i=0;i<7;i++){const x=870+(i%3)*5-(i%2)*8,y=660-i*8;g.poly([[x,y],[x+170,y],[x+184,y+9],[x+14,y+9]],'ln fig')}
  [[880,470,-1],[900,462,0],[924,456,1]].forEach(([x,y,t],i)=>cvSheet(g,x,y,110,150,i===2));
  for(let i=0;i<9;i++){const x=1250+(i%2)*9-(i%3)*4,y=868-i*11;g.poly([[x,y],[x+200,y],[x+220,y+11],[x+20,y+11]],'ln fig')}
  cvSheet(g,1270,640,120,160,false);cvSheet(g,1300,630,120,160,true);
  cvSheet(g,180,760,100,136,false);
  g.done();
})();

(function buildB(){
  const g=mk('svgB');
  g.rect(300,120,1000,520,'ln');
  g.line(300,120,0,-60);g.line(1300,120,1600,-60);g.line(300,640,0,900);g.line(1300,640,1600,900);
  for(let k=0;k<=8;k++){const x=300+k*125;g.line(x,640,800+(x-800)*3,900,'lf')}
  [720,820].forEach(y=>{const o=(y-640)*300/260;g.line(300-o,y,1300+o,y,'lf')});
  g.rect(880,180,360,280,'ln');g.line(1000,180,1000,460,'lf');g.line(1120,180,1120,460,'lf');g.line(880,320,1240,320,'lf');
  g.rect(360,180,260,330,'ln fig');g.text(382,236,'ASPIRANT','font:800 30px Manrope,sans-serif;fill:#1E4632');g.text(383,262,'ENTERPRISE-TECH','font:700 12px Manrope,sans-serif;letter-spacing:2px;fill:#1E4632');
  [300,322,344,380,402,424,446].forEach((y,i)=>g.line(384,y,384+[190,170,200,150,180,120,160][i],y,'lf'));
  g.path('M388 488 q12 -22 22 0 t22 0 t22 -6',388,'ln');
  g.line(620,300,700,300,'lf');g.circ(704,300,4,'ln');g.line(700,300,700,470,'lf');
  g.rect(560,470,170,100,'lg');[0,1,2,3,4].forEach(i=>{const h=[30,48,22,60,40][i];g.rect(580+i*28,556-h,16,h,'fl',GOLDF)});g.line(576,488,660,488,'lg');
  g.rect(880,500,160,90,'lg');g.poly([[896,570],[926,550],[956,560],[986,528],[1022,536]],'lg',false);g.line(896,516,960,516,'lg');
  g.line(290,790,276,640);g.line(270,790,370,790);g.line(282,790,272,868);g.line(360,790,370,868);
  g.line(1310,790,1324,640);g.line(1230,790,1330,790);g.line(1318,790,1328,868);g.line(1240,790,1230,868);
  g.fig('sit',330,870,330,1);g.fig('sit',1270,870,330,-1);
  g.poly([[470,620],[1130,620],[1230,700],[370,700]],'ln fig');g.poly([[370,700],[1230,700],[1230,712],[370,712]],'ln fig');
  g.line(420,712,430,880);g.line(1180,712,1170,880);g.line(520,620,520,760,'lf');g.line(1080,620,1080,760,'lf');
  g.rect(1170,690,48,32,'ln fig');g.rect(700,650,120,40,'lf');
  g.done();
})();
}
