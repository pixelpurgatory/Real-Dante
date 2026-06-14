'use strict';
// Mobile/orientation harness: verify fullscreen-fill layout, portrait band +
// control strip, rotation re-layout, on-screen button bounds, and that drawing
// works after rotating (no stale-state crashes / artifacts).
const fs = require('fs'), vm = require('vm');

function ctxStub(){const g={addColorStop(){}};const c={};
  ['save','restore','translate','scale','rotate','beginPath','closePath','moveTo','lineTo',
   'quadraticCurveTo','bezierCurveTo','arc','ellipse','rect','roundRect','fill','stroke','clip',
   'fillRect','strokeRect','clearRect','drawImage','fillText','strokeText','setTransform','setLineDash']
   .forEach(m=>c[m]=()=>{});
  c.createLinearGradient=()=>g;c.createRadialGradient=()=>g;c.createPattern=()=>({});
  c.measureText=s=>({width:(s?s.length:0)*6});return c;}
const cv={width:960,height:540,style:{},getContext:ctxStub,addEventListener(){},
  getBoundingClientRect(){return{left:0,top:0,width:cv.width,height:cv.height};}};
const win={innerWidth:960,innerHeight:540,addEventListener(){}};
const sb={Math,Date,console,parseInt,parseFloat,isNaN,isFinite,Object,Array,String,Number,Boolean,JSON,setTimeout,
  window:win,document:{getElementById:()=>cv,createElement:()=>({width:0,height:0,style:{},getContext:ctxStub}),addEventListener(){}},
  performance:{now:()=>0},requestAnimationFrame(){}};
sb.globalThis=sb;sb.global=sb;vm.createContext(sb);
const files=['core.js','audio.js','level.js','background.js','actors.js','boss.js','ui.js','touch.js','main.js'];
let b='';for(const f of files)b+='\n'+fs.readFileSync('js/'+f,'utf8');
b+='\nglobalThis.Game=Game;globalThis.Input=Input;globalThis.TouchUI=TouchUI;globalThis.STAGE=STAGE;'
 +'globalThis.fitCanvas=fitCanvas;globalThis.canvas=canvas;globalThis.getVW=()=>VW;globalThis.VH=VH;globalThis.Vignette=Vignette;';
vm.runInContext(b,sb);
const {Game,Input,TouchUI,STAGE,fitCanvas,canvas}=sb;
const VH = sb.VH;

let fails=0;
function ok(cond,msg){ console.log((cond?'  ok  ':'  FAIL')+'  '+msg); if(!cond) fails++; }
function ev(pts){return {preventDefault(){},touches:pts,changedTouches:pts};}
function setSize(w,h){ win.innerWidth=w; win.innerHeight=h; fitCanvas(); }

const devices = [
  ['iPhone14 landscape', 2532, 1170, false],
  ['iPhone14 portrait',  1170, 2532, true],
  ['Pixel8 landscape',   2400, 1080, false],
  ['Pixel8 portrait',    1080, 2400, true],
  ['iPad landscape',     1180, 820,  false],
  ['iPad portrait',      820, 1180,  true],
  ['Laptop 16:9',        1920, 1080, false],
  ['Laptop 16:10',       1680, 1050, false],
];

// start the game once (so draw exercises play state)
Input.pressed['Enter']=true; Game.update(1/60); Input.endFrame();
for(let i=0;i<10;i++){Game.update(1/60);Input.endFrame();}

console.log('--- per-device layout ---');
for(const [name,w,h,wantPortrait] of devices){
  setSize(w,h);
  const W=canvas.width, H=canvas.height;
  const capOk = Math.max(W,H) <= 1600;
  const fills = !STAGE.portrait ? (Math.abs(STAGE.ox) <= 2 && STAGE.oy >= 0) : true;
  // all buttons + the movement stick fully on-screen
  let inB=true, minY=1e9;
  const parts = TouchUI.buttons.concat([TouchUI.stick]);
  for(const btn of parts){
    if(btn.x-btn.r < -1 || btn.x+btn.r > W+1 || btn.y-btn.r < -1 || btn.y+btn.r > H+1) inB=false;
    minY=Math.min(minY, btn.y-btn.r);
  }
  // portrait: controls must sit below the game band (no overlap with gameplay)
  const bandH = VH * STAGE.scale;
  const stripOk = !STAGE.portrait || (minY >= bandH - 2);
  // draw must not throw after this size
  let drew=true; try{ Game.draw(1/60); }catch(e){ drew=false; console.log('   draw error:',e.message); }
  console.log(`${name}: ${W}x${H} portrait=${STAGE.portrait} VW=${sb.getVW()} scale=${STAGE.scale.toFixed(2)}`);
  ok(capOk, '  internal res within perf cap');
  ok(STAGE.portrait===wantPortrait, '  orientation detected');
  ok(fills, '  landscape fills (no side letterbox)');
  ok(inB, '  all buttons on-screen');
  ok(stripOk, '  portrait controls below game band');
  ok(drew, '  draw() ran without error');
  ok(sb.Vignette.cv.width === sb.getVW(), '  vignette matches view width (no seam)');
}

console.log('--- rotation sequence (artifact / re-layout) ---');
const seq=[[2532,1170],[1170,2532],[2532,1170],[1170,2532],[1170,2532]];
let rotOk=true;
for(const [w,h] of seq){
  setSize(w,h);
  try{ Game.update(1/60); Game.draw(1/60); Input.endFrame(); }catch(e){ rotOk=false; console.log('  rotate err',e.message); }
  for(const btn of TouchUI.buttons.concat([TouchUI.stick]))
    if(btn.x+btn.r>canvas.width+1||btn.y+btn.r>canvas.height+1||btn.x-btn.r<-1||btn.y-btn.r<-1) rotOk=false;
}
ok(rotOk, 'survives repeated rotation, buttons stay in bounds');

console.log('--- touch mapping landscape ---');
setSize(2532,1170);
function btn(id){return TouchUI.buttons.find(x=>x.id===id);}
function stick(){return TouchUI.stick;}
let S=stick();
TouchUI.onTouch(ev([{identifier:1,clientX:S.x - S.r, clientY:S.y}]),'start'); // push stick left
ok(!!Input.left() && !Input.right(), 'landscape stick pushes LEFT');
TouchUI.onTouch(ev([{identifier:1,clientX:S.x + S.r, clientY:S.y}]),'move');  // push right
ok(!!Input.right() && !Input.left(), 'landscape stick pushes RIGHT');
TouchUI.onTouch(ev([{identifier:1,clientX:S.x, clientY:S.y - S.r}]),'move');  // push up
ok(!!Input.up(), 'landscape stick pushes UP (for up-strike)');
TouchUI.onTouch(ev([{identifier:1,clientX:S.x, clientY:S.y}]),'move');        // center = neutral
ok(!Input.left() && !Input.right() && !Input.up() && !Input.down(), 'stick centered = neutral (deadzone)');
TouchUI.onTouch(ev([]),'end');
const J=btn('jump'); TouchUI.onTouch(ev([{identifier:2,clientX:J.x,clientY:J.y}]),'start');
ok(!!Input.jumpP(), 'landscape JUMP triggers');
TouchUI.onTouch(ev([]),'end');

console.log('--- touch mapping portrait ---');
setSize(1170,2532);
S=stick();
ok(S.y - S.r > VH*STAGE.scale, 'portrait stick sits in the strip below the band');
TouchUI.onTouch(ev([{identifier:3,clientX:S.x - S.r, clientY:S.y}]),'start');
ok(!!Input.left(), 'portrait stick pushes LEFT');
TouchUI.onTouch(ev([]),'end');
const Ap=btn('atk'); TouchUI.onTouch(ev([{identifier:4,clientX:Ap.x,clientY:Ap.y}]),'start');
ok(!!Input.atkP(), 'portrait HIT triggers (held -> autofire)');
TouchUI.onTouch(ev([]),'end');

console.log('--- menu tap-to-start both orientations ---');
for(const [w,h] of [[2532,1170],[1170,2532]]){
  setSize(w,h);
  Game.state='title'; Input.vpressed={};
  TouchUI.onTouch(ev([{identifier:9,clientX:w*0.5*(canvas.width/ (win.innerWidth)),clientY:h*0.3}]),'start');
  // coords: rect width = canvas.width, so clientX in canvas px; use center
  Input.vpressed={};
  TouchUI.onTouch(ev([{identifier:9,clientX:canvas.width*0.5,clientY:canvas.height*0.3}]),'start');
  ok(!!Input.vpressed.confirm, (h>w?'portrait':'landscape')+' menu tap = confirm');
}

console.log(fails? ('\nMOBILE TESTS: '+fails+' FAILURES') : '\nMOBILE TESTS: all passed');
process.exit(fails?1:0);
