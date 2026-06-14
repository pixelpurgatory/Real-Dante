'use strict';
// Navigation bot: heuristic player that detects gaps/walls and jumps,
// to verify the level is traversable end-to-end through normal movement.
const fs = require('fs'), vm = require('vm');
function ctxStub(){const g={addColorStop(){}};const c={};
  ['save','restore','translate','scale','rotate','beginPath','closePath','moveTo','lineTo',
   'quadraticCurveTo','bezierCurveTo','arc','ellipse','rect','roundRect','fill','stroke','clip',
   'fillRect','strokeRect','clearRect','drawImage','fillText','strokeText','setTransform','setLineDash']
   .forEach(m=>c[m]=()=>{});
  c.createLinearGradient=()=>g;c.createRadialGradient=()=>g;c.createPattern=()=>({});
  c.measureText=s=>({width:(s?s.length:0)*6});return c;}
function canvas(w,h){return{width:w||300,height:h||150,style:{},getContext(){return ctxStub()},
  addEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:this.width,height:this.height}}};}
const cv=canvas(960,540);
const sb={Math,Date,console,parseInt,parseFloat,isNaN,isFinite,Object,Array,String,Number,Boolean,JSON,
  window:{innerWidth:1280,innerHeight:720,addEventListener(){}},
  document:{getElementById:id=>id==='game'?cv:canvas(),createElement:()=>canvas(),addEventListener(){}},
  performance:{now:()=>Date.now()},requestAnimationFrame(){}};
sb.globalThis=sb;sb.global=sb;vm.createContext(sb);
const files=['core.js','audio.js','level.js','background.js','actors.js','boss.js','ui.js','touch.js','newsletter.js','main.js'];
let b='';for(const f of files)b+='\n'+fs.readFileSync('js/'+f,'utf8');
b+='\nglobalThis.Game=Game;globalThis.Input=Input;globalThis.PLATFORMS=PLATFORMS;globalThis.HAZARDS=HAZARDS;';
vm.runInContext(b,sb,{filename:'bundle.js'});
const {Game,Input,PLATFORMS,HAZARDS}=sb;

const STEP=1/60;
function press(c){Input.pressed[c]=true;}

// solid ground top at world x (highest platform top under x within y range)
function groundTopAt(x, yRef){
  let best=Infinity;
  for(const p of PLATFORMS){
    if(p.x<-50||p.x>11000)continue;
    if(x>=p.x&&x<=p.x+p.w){
      if(p.y>=yRef-40 && p.y<best) best=p.y;
    }
  }
  return best;
}
function hazardAt(x){
  for(const hz of HAZARDS){ if(x>=hz.x&&x<=hz.x+hz.w) return hz.type; }
  return null;
}

press('Enter');Game.update(STEP);Input.endFrame();
const PURE = process.argv.includes('--pure');
if(PURE) Game.enemies=[]; // isolate geometry reachability

let stuckX=0,stuckFrames=0,maxX=0,reachedBoss=false,jumps=0;
const MAXF=20000;
let f=0;
for(;f<MAXF;f++){
  const pl=Game.player;
  if(!pl){break;}
  if(pl.dead){ Game.update(STEP);Input.endFrame(); continue; }
  if(PURE && process.env.TRACE && pl.x>2950 && pl.x<3260)
    console.log('  T x',Math.round(pl.x),'y',Math.round(pl.y),'vy',Math.round(pl.vy),'onG',pl.onGround);

  const footY=pl.y+pl.h;
  // commit a jump ~30px before the ledge while still grounded
  const probe=pl.x+pl.w+30;
  const gProbe=groundTopAt(probe, footY);
  const gNext=groundTopAt(pl.x+pl.w+80, footY);
  const hzAhead=hazardAt(probe);

  Input.keys={KeyD:true};

  const gap     = gProbe===Infinity || gProbe>footY+40;
  const gapNext = gNext===Infinity || gNext>footY+40;
  const stepUp  = gProbe!==Infinity && gProbe<footY-14;
  const blocked = pl.hitWall>0;
  if(pl.onGround && (gap || stepUp || hzAhead==='spikes' || blocked)){
    press('Space'); jumps++;
  }
  // hold jump while ascending over a gap for a full-height arc
  if(!pl.onGround && pl.vy<0 && (gap||gapNext||hzAhead)) Input.keys.Space=true;

  // attack anything in front sometimes (skip in pure-traversal mode)
  if(!PURE && f%10===0) press('KeyJ');
  if(PURE) Game.enemies=[];
  // pogo if above spikes and falling
  if(!pl.onGround && pl.vy>0 && hazardAt(pl.x+pl.w/2)==='spikes'){ Input.keys.KeyS=true; press('KeyJ'); }

  Game.update(STEP);Input.endFrame();

  if(pl.x>maxX+1){maxX=pl.x;stuckFrames=0;}else{stuckFrames++;}
  if(Game.boss&&Game.boss.active)reachedBoss=true;
  if(reachedBoss) break; // stop at boss; combat tested separately
  if(stuckFrames>600){ break; } // stuck 10s
}
console.log('navbot: frames',f,'maxX',Math.round(maxX),'reachedBoss',reachedBoss,
  'deaths',Game.stats.deaths,'jumps',jumps,'stuckFrames',stuckFrames);
// report what's near the stuck point
if(!reachedBoss){
  const x=Math.round(maxX);
  console.log('  stuck near x='+x+', ground here='+groundTopAt(x,500)+', ahead='+groundTopAt(x+40,500)+', hazard='+hazardAt(x+30));
}
