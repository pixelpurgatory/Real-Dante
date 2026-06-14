'use strict';
// Feature regression: buffs/pickups, ranged enemies, neutral NPCs, gore,
// Death boss, and player double-jump / damage / fireball / regen.
const fs = require('fs'), vm = require('vm');
function ctxStub(){const g={addColorStop(){}};const c={};['save','restore','translate','scale','rotate','beginPath','closePath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','rect','roundRect','fill','stroke','clip','fillRect','strokeRect','clearRect','drawImage','fillText','strokeText','setTransform','setLineDash'].forEach(m=>c[m]=()=>{});c.createLinearGradient=()=>g;c.createRadialGradient=()=>g;c.measureText=s=>({width:0});return c;}
function cv(){return{width:960,height:540,style:{},getContext:ctxStub,addEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:960,height:540};}};}
const sb={Math,Date,console,parseInt,parseFloat,isNaN,isFinite,Object,Array,String,Number,Boolean,JSON,setTimeout,window:{innerWidth:1280,innerHeight:720,addEventListener(){}},document:{getElementById:()=>cv(),createElement:()=>cv(),addEventListener(){}},performance:{now:()=>0},requestAnimationFrame(){}};
sb.globalThis=sb;sb.global=sb;vm.createContext(sb);
const files=['core.js','audio.js','level.js','background.js','actors.js','systems.js','boss.js','ui.js','touch.js','newsletter.js','main.js'];
let b='';for(const f of files)b+='\n'+fs.readFileSync('js/'+f,'utf8');
b+='\nglobalThis.Game=Game;globalThis.Input=Input;globalThis.Particles=Particles;globalThis.Dialogue=Dialogue;'
 +'globalThis.spawnEnemy=spawnEnemy;globalThis.makeNPC=makeNPC;globalThis.Gore=Gore;';
vm.runInContext(b,sb);
const {Game,Input,Particles,Dialogue,spawnEnemy,makeNPC,Gore}=sb;
let fails=0; const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL')+'  '+m); if(!c)fails++;};
Input.pressed['Enter']=true;Game.update(1/60);Input.endFrame();
const pl=Game.player;

console.log('--- player buffs ---');
pl.addBuff('damage'); ok(pl.dmgMult()===2,'WRATH doubles damage');
pl.addBuff('doublejump'); pl.onGround=true; Game.update(1/60); ok(pl.airJumps>=1,'WINGS grants air jump');
pl.addBuff('fireball'); Game.shots=[]; for(let i=0;i<90;i++){Game.update(1/60);Input.endFrame();}
ok(Game.shots.some(s=>s.kind==='fireball'),'HELLFIRE auto-fires fireballs');
pl.hp=2; pl.addBuff('regen'); for(let i=0;i<300;i++){Game.update(1/60);Input.endFrame();} ok(pl.hp>2,'GRACE regenerates HP');

console.log('--- pickups ---');
const pk=Game.pickups[0]; pl.buffs={}; pl.x=pk.x-8; pl.y=pk.y-8; pk.update(1/60,pl);
ok(pk.taken && Object.keys(pl.buffs).length>0,'shrine pickup grants a buff');

console.log('--- ranged enemies fire ---');
Game.shots=[];
const bow=spawnEnemy({type:'bowman',x:1000,gy:430,min:900,max:1100});
const tp={x:1180,y:394,w:24,h:42,facing:1,invuln:0,hurt(){return false;}};
for(let i=0;i<200;i++) bow.update(1/60, tp);
ok(Game.shots.some(s=>s.kind==='arrow'),'bowman looses arrows');
Game.shots=[];
const soul=spawnEnemy({type:'soul',x:1000,y:240,min:900,max:1100});
for(let i=0;i<260;i++) soul.update(1/60, tp);
ok(Game.shots.some(s=>s.kind==='soulbolt'),'tormented soul casts soul-bolts');

console.log('--- gore (blood vs bone) ---');
let before=Particles.list.length;
const harpy=spawnEnemy({type:'harpy',x:1000,y:240,min:900,max:1100});
harpy.takeHit(1,1,0); ok(Particles.list.length>before,'non-skeleton bleeds (particles spawned)');
ok(harpy.gore==='blood','harpy gore = blood');
const skel=spawnEnemy({type:'hoplite',x:1000,gy:430,min:900,max:1100});
ok(skel.gore==='bone','hoplite gore = bone (falling bones)');

console.log('--- neutral NPC speaks then dies ---');
const npc=makeNPC({x:1000,gy:430,name:'Test',lines:['ow','i die']});
Game.player.x=980; // so facing/positions resolve
npc.takeHit(1,1); ok(Dialogue.busy(),'NPC speaks when struck');
const wasKills=Game.stats.kills;
npc.takeHit(5,1); ok(npc.dead,'NPC can be killed');

console.log('--- birds are 1-hit + boss rewards ---');
ok(spawnEnemy({type:'harpy',x:1,y:1,min:0,max:2}).maxHp===1,'harpy (bird) is a 1-hit kill');
Game.bossDefeated=false; Game.bonusHp=0; Game.permaDoubleJump=false;
Game.onBossDead();
ok(Game.permaDoubleJump===true,'permanent double jump granted after first boss');
ok(Game.player.maxHp===10,'+5 max HP after first boss (maxHp='+Game.player.maxHp+')');
Game.player.buffs={}; Game.player.airJumps=0; Game.player.onGround=true; Game.update(1/60);
ok(Game.player.airJumps>=1,'perma double-jump arms an air jump without a buff');

console.log('--- shrines rekindle every 5 deaths ---');
Game.stats.deaths=0;
Game.pickups.forEach(p=>p.taken=true);
let stillTakenAt4=false;
for(let d=1;d<=5;d++){ Game.respawnPlayer(); if(d===4) stillTakenAt4=Game.pickups.some(p=>p.taken); }
ok(stillTakenAt4,'buffs stay used between death 1–4');
ok(Game.pickups.every(p=>!p.taken),'all shrines respawn on the 5th death');

console.log('--- Death boss activates + dies ---');
Game.deathBoss.reset();
Game.player.x=(15260+16640)/2; Game.player.y=400; Game.player.dead=false; Game.player.hp=5;
for(let i=0;i<30;i++){Game.update(1/60);Input.endFrame();}
ok(Game.deathBoss.active,'Death activates at the summit');
for(let i=0;i<6000 && !Game.deathDefeated;i++){ if(Game.player.dead){Game.player.dead=false;Game.player.hp=5;} Game.player.invuln=1; if(i%8===0&&Game.deathBoss.active&&!Game.deathBoss.dead)Game.deathBoss.takeHit(1,1); Game.update(1/60);Input.endFrame(); }
ok(Game.deathDefeated,'Death can be defeated');

console.log(fails?('\nFEATURE TESTS: '+fails+' FAILURES'):'\nFEATURE TESTS: all passed');
process.exit(fails?1:0);
