// In-world casino game stations + VR panels for all games.
// VR panels: floating canvas-button UI at each station, controller-clickable.

let gameBoards = {};

function placeStation(group, pos, face) {
  pos = pos || { x:0, z:-4 }; face = face || [0,0,1];
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = Math.atan2(face[0], face[2]);
  group.userData.faceDir = face;
}

// ---------- shared helpers ----------

let _vgFeltTex = null;
function vgFeltTex() {
  if (_vgFeltTex) return _vgFeltTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#0d6e33'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(${Math.random()<0.5?'0,0,0':'255,255,255'},0.03)`;
    x.fillRect(Math.random()*256, Math.random()*256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2,2);
  if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
  _vgFeltTex = t; return t;
}

const MAT = {
  cabinet: () => new THREE.MeshStandardMaterial({ color:0x14101f, roughness:0.5, metalness:0.4 }),
  trim: (c) => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.9, roughness:0.4, metalness:0.6 }),
  gold: () => new THREE.MeshStandardMaterial({ color:0xffcc55, emissive:0xffaa33, emissiveIntensity:0.5, metalness:0.9, roughness:0.25 }),
  felt: () => new THREE.MeshStandardMaterial({ color:0x0e7a38, roughness:0.95, metalness:0.0, map:vgFeltTex() }),
  dark: () => new THREE.MeshStandardMaterial({ color:0x07040d, roughness:0.8 }),
  mannequin: () => new THREE.MeshStandardMaterial({ color:0xd4cfc8, roughness:0.7, metalness:0.1 }),
};

function signMesh(text, color, w, h) {
  const c = document.createElement('canvas'); c.width=512; c.height=128;
  const x = c.getContext('2d');
  x.fillStyle='rgba(6,4,14,0.92)'; x.fillRect(0,0,512,128);
  x.strokeStyle=color; x.lineWidth=8; x.strokeRect(6,6,500,116);
  x.fillStyle=color; x.font='bold 64px Arial'; x.textAlign='center'; x.textBaseline='middle';
  x.shadowColor=color; x.shadowBlur=18; x.fillText(text,256,64);
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true}));
}

function neonFrame(w, h, color) {
  const g=new THREE.Group(), mat=MAT.trim(color), t=0.06;
  const top=new THREE.Mesh(new THREE.BoxGeometry(w,t,t),mat); top.position.y=h/2;
  const bot=new THREE.Mesh(new THREE.BoxGeometry(w,t,t),mat); bot.position.y=-h/2;
  const lft=new THREE.Mesh(new THREE.BoxGeometry(t,h,t),mat); lft.position.x=-w/2;
  const rgt=new THREE.Mesh(new THREE.BoxGeometry(t,h,t),mat); rgt.position.x=w/2;
  g.add(top,bot,lft,rgt); return g;
}

// ---- shared VR panel canvas helpers ----

function vrRoundRect(x, px, py, pw, ph, r) {
  x.beginPath(); x.moveTo(px+r,py); x.lineTo(px+pw-r,py); x.quadraticCurveTo(px+pw,py,px+pw,py+r);
  x.lineTo(px+pw,py+ph-r); x.quadraticCurveTo(px+pw,py+ph,px+pw-r,py+ph);
  x.lineTo(px+r,py+ph); x.quadraticCurveTo(px,py+ph,px,py+ph-r);
  x.lineTo(px,py+r); x.quadraticCurveTo(px,py,px+r,py); x.closePath();
}

function vrBtnTex(label, accent) {
  const c=document.createElement('canvas'); c.width=256; c.height=110;
  const x=c.getContext('2d'); x.clearRect(0,0,256,110);
  vrRoundRect(x,5,5,246,100,18); x.fillStyle='rgba(18,12,30,0.96)'; x.fill();
  x.lineWidth=6; x.strokeStyle=accent; x.shadowColor=accent; x.shadowBlur=12; x.stroke(); x.shadowBlur=0;
  x.fillStyle='#fff'; x.font='bold 34px Arial'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(label,128,57);
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

function vrLblTex(text, color) {
  const c=document.createElement('canvas'); c.width=512; c.height=72;
  const x=c.getContext('2d'); x.clearRect(0,0,512,72);
  vrRoundRect(x,2,2,508,68,14); x.fillStyle='rgba(8,5,18,0.82)'; x.fill();
  x.fillStyle=color||'#c9a3ff'; x.font='bold 28px Arial'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(text||'',256,38);
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

function vrLabel(w, h, color) {
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:vrLblTex('',color),transparent:true}));
  m.userData.setText=(t,c)=>{m.material.map.dispose();m.material.map=vrLblTex(t,c);m.material.needsUpdate=true;};
  return m;
}

function vrBtn(parent, label, x, y, w, h, accent, onSelect) {
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:vrBtnTex(label,accent),transparent:true}));
  mesh.position.set(x,y,0.001);
  mesh.userData.onSelect=onSelect; mesh.userData.vrButton=true;
  parent.add(mesh);
  (window.vrInteractables=window.vrInteractables||[]).push(mesh);
  return mesh;
}

function vrRow(parent, defs, y) {
  // clear old buttons from parent
  const toRemove=parent.children.filter(c=>c.userData&&c.userData.vrButton);
  toRemove.forEach(c=>{
    parent.remove(c);
    if(window.vrInteractables){const idx=window.vrInteractables.indexOf(c);if(idx>=0)window.vrInteractables.splice(idx,1);}
  });
  if(!defs||!defs.length) return;
  const single=defs.length===1, w=single?0.62:0.42, gap=0.04, h=0.2;
  const yy=y||-0.32;
  const total=defs.length*w+(defs.length-1)*gap;
  defs.forEach((d,i)=>{
    const bx=-total/2+w/2+i*(w+gap);
    vrBtn(parent,d.label,bx,yy,w,h,d.accent||'#aa88ff',d.fn);
  });
}

// ---- Blackjack ----

function createBlackjackBoard(scene, pos, face) {
  const group=new THREE.Group(); placeStation(group,pos,face);
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,0.95,16),MAT.cabinet());
  ped.position.y=0.47; ped.castShadow=true; group.add(ped);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.12,40),MAT.felt());
  top.position.y=0.98; top.castShadow=true; group.add(top);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.06,12,48),MAT.gold());
  rim.rotation.x=Math.PI/2; rim.position.y=1.04; group.add(rim);
  const circleMat=new THREE.MeshStandardMaterial({color:0xffd24a,emissive:0x553300,emissiveIntensity:0.3,roughness:0.6});
  for(let i=-1;i<=1;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.015,8,24),circleMat);
    ring.rotation.x=Math.PI/2; ring.position.set(i*0.45,1.05,0.4); group.add(ring);
  }
  const sign=signMesh('BLACKJACK','#ffd24a',1.6,0.42); sign.position.set(0,1.9,-0.6); group.add(sign);
  group.userData.game='blackjack';
  gameBoards.blackjack=group;
  _buildBjVrPanel(group);
  scene.add(group);
  return group;
}

function _buildBjVrPanel(parent) {
  const panel=new THREE.Group(); panel.position.set(0,1.5,1.5); parent.add(panel);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.82,0.96),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:0.08}));
  panel.add(glow);
  const frame=neonFrame(1.86,1.0,0xffd24a); panel.add(frame);
  const info=vrLabel(1.7,0.18,'#ffd24a'); info.position.set(0,0.35,0.002); panel.add(info);
  const dealer=vrLabel(1.7,0.14,'#cccccc'); dealer.position.set(0,0.18,0.002); panel.add(dealer);
  const player=vrLabel(1.7,0.14,'#00ff88'); player.position.set(0,0.02,0.002); panel.add(player);
  const btns=new THREE.Group(); btns.position.set(0,-0.18,0); panel.add(btns);
  const _bj={panel,info,dealer,player,btns};
  gameBoards._bjVr=_bj;
  window.updateBjVrPanel=function(bj){
    bj=bj||window._bj||{phase:'idle',bet:200,player:[],dealer:[],result:'',payout:0};
    const p=window.currentPlayer,bal=p?Math.floor(p.balance):0;
    const phase=bj.phase||'idle';
    const cs=c=>c.r+c.s;
    const val=hand=>{let v=0,a=0;for(const c of hand){if(c.r==='A'){a++;v+=11;}else if('JQK'.includes(c.r))v+=10;else v+=parseInt(c.r);}while(v>21&&a--)v-=10;return v;};
    const pv=bj.player&&bj.player.length?val(bj.player):'';
    const dv=bj.dealer&&bj.dealer.length&&phase!=='playing'?val(bj.dealer):'?';
    const dc=bj.dealer&&bj.dealer.length?(phase==='playing'?cs(bj.dealer[0])+' ?':bj.dealer.map(cs).join(' ')):'--';
    const pc=bj.player&&bj.player.length?bj.player.map(cs).join(' '):'--';
    const labels={win:`WIN +${bj.payout}P$`,lose:'DEALER WINS',bust:'BUST!',push:'PUSH'};
    const infoTxt=bj.result?labels[bj.result]||bj.result:`P$ ${bal}  |  BET ${bj.bet}`;
    const infoCol=bj.result?{win:'#00ff88',lose:'#ff4444',bust:'#ff4444',push:'#ffd700'}[bj.result]:'#ffd24a';
    _bj.info.userData.setText(infoTxt,infoCol);
    _bj.dealer.userData.setText('Dealer: '+dc+(phase!=='playing'&&dv?' ('+dv+')':''),'#cccccc');
    _bj.player.userData.setText('You: '+pc+(pv?' ('+pv+')':''),'#00ff88');
    if(phase==='playing'){
      vrRow(_bj.btns,[
        {label:'HIT',  accent:'#0066ff',fn:()=>window.bjHit&&bjHit()},
        {label:'STAND',accent:'#ff6600',fn:()=>window.bjStand&&bjStand()},
        {label:'DBL',  accent:'#9900cc',fn:()=>window.bjDouble&&bjDouble()},
      ]);
    } else {
      vrRow(_bj.btns,[
        {label:'BET -50', accent:'#555',fn:()=>{if(window._bj)window._bj.bet=Math.max(50,window._bj.bet-50);window.updateBjVrPanel&&updateBjVrPanel(window._bj);}},
        {label:'DEAL',    accent:'#00cc44',fn:()=>window.bjDeal&&bjDeal()},
        {label:'BET +50', accent:'#555',fn:()=>{if(window._bj)window._bj.bet=window._bj.bet+50;window.updateBjVrPanel&&updateBjVrPanel(window._bj);}},
      ]);
    }
  };
  window.updateBjVrPanel(null);
}

// ---- Plinko ----

function createPlinkoBoard(scene, pos, face) {
  const group=new THREE.Group(); placeStation(group,pos,face);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.2,0.3),MAT.cabinet());
  cab.position.y=1.3; cab.castShadow=true; group.add(cab);
  const playFace=new THREE.Mesh(new THREE.BoxGeometry(1.15,1.6,0.05),MAT.dark());
  playFace.position.set(0,1.45,0.16); group.add(playFace);
  const pegMat=new THREE.MeshStandardMaterial({color:0xeeeeff,emissive:0x334466,emissiveIntensity:0.4,metalness:0.5,roughness:0.4});
  for(let row=0;row<7;row++){
    const n=row+3;
    for(let col=0;col<n;col++){
      const peg=new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8),pegMat);
      peg.position.set((col-(n-1)/2)*0.16,1.95-row*0.18,0.2); group.add(peg);
    }
  }
  const mults=window.PLINKO_MULTS||[10,3,2,1.5,0.5,1.5,2,3,10];
  const cols=window.PLINKO_COLS||['#ffd700','#ff8833','#33cc66','#3399ff','#555','#3399ff','#33cc66','#ff8833','#ffd700'];
  mults.forEach((m,i)=>{
    const n=mults.length, sx=(i-(n-1)/2)*0.14;
    const slot=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.16,0.06),MAT.trim(parseInt(cols[i].replace('#',''),16)));
    slot.position.set(sx,0.78,0.2); group.add(slot);
    const lbl=signMesh(m+'x','#ffffff',0.12,0.09); lbl.position.set(sx,0.78,0.25); group.add(lbl);
  });
  const frame=neonFrame(1.3,1.75,0x33ccff); frame.position.set(0,1.45,0.18); group.add(frame);
  const sign=signMesh('PLINKO','#33ccff',1.3,0.4); sign.position.set(0,2.55,0.18); group.add(sign);
  group.userData.game='plinko';
  gameBoards.plinko=group;
  _buildPlinkoVrPanel(group);
  scene.add(group); return group;
}

function _buildPlinkoVrPanel(parent) {
  const panel=new THREE.Group(); panel.position.set(0,1.5,1.5); parent.add(panel);
  const frame=neonFrame(1.86,0.86,0x33ccff); panel.add(frame);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.82,0.82),new THREE.MeshBasicMaterial({color:0x33ccff,transparent:true,opacity:0.07})); panel.add(glow);
  const info=vrLabel(1.7,0.18,'#33ccff'); info.position.set(0,0.25,0.002); panel.add(info);
  const btns=new THREE.Group(); btns.position.set(0,-0.08,0); panel.add(btns);
  const _pl2={panel,info,btns};
  window.updatePlinkoVrPanel=function(pl){
    pl=pl||window._pl||{bet:200,dropping:false};
    const p=window.currentPlayer,bal=p?Math.floor(p.balance):0;
    const infoTxt=pl._msg||(pl.dropping?'Dropping…':`P$ ${bal}  |  BET ${pl.bet}`);
    const col=pl.lastMult&&pl.lastMult>1?'#00ff88':pl.lastMult===0.5?'#ffd700':'#33ccff';
    _pl2.info.userData.setText(infoTxt,col);
    vrRow(_pl2.btns,[
      {label:'BET -',accent:'#555',fn:()=>{if(window._pl)window._pl.bet=Math.max(50,window._pl.bet-50);window.updatePlinkoVrPanel&&updatePlinkoVrPanel(window._pl);}},
      {label:'DROP!',accent:'#33ccff',fn:()=>window.playPlinko&&playPlinko()},
      {label:'BET +',accent:'#555',fn:()=>{if(window._pl)window._pl.bet=window._pl.bet+50;window.updatePlinkoVrPanel&&updatePlinkoVrPanel(window._pl);}},
    ]);
    pl._msg='';
  };
  window.updatePlinkoVrPanel(null);
}

// ---- Wheel ----

function wheelFaceTexture() {
  const segs=window.WHEEL_SEGS||[];
  const c=document.createElement('canvas'); c.width=c.height=512;
  const x=c.getContext('2d');
  const cx=256,cy=256,r=250,n=segs.length||10;
  for(let i=0;i<n;i++){
    const a0=(i/n)*Math.PI*2,a1=((i+1)/n)*Math.PI*2;
    x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,r,a0,a1); x.closePath();
    x.fillStyle=segs[i]?segs[i].col:'#333'; x.fill();
    x.strokeStyle='#1a0f25'; x.lineWidth=4; x.stroke();
    x.save(); x.translate(cx,cy); x.rotate((a0+a1)/2);
    x.fillStyle='#fff'; x.font='bold 32px Arial'; x.textAlign='right'; x.textBaseline='middle';
    x.fillText(segs[i]?segs[i].label:'?',r-18,0); x.restore();
  }
  x.beginPath(); x.arc(cx,cy,34,0,Math.PI*2); x.fillStyle='#ffcc55'; x.fill();
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

let _wheelDisc=null;
function createWheelBoard(scene, pos, face) {
  const group=new THREE.Group(); placeStation(group,pos,face);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.6,0.2,20),MAT.cabinet()); base.position.y=0.1; group.add(base);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,1.4,12),MAT.cabinet()); pole.position.y=0.9; group.add(pole);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(0.75,48),new THREE.MeshStandardMaterial({roughness:0.5,metalness:0.2}));
  disc.position.set(0,1.65,0.12); disc.name='wheelDisc'; group.add(disc);
  _wheelDisc=disc;
  // build texture after WHEEL_SEGS is available (next tick)
  setTimeout(()=>{disc.material.map=wheelFaceTexture();disc.material.needsUpdate=true;},50);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.75,0.05,12,48),MAT.gold()); rim.position.set(0,1.65,0.12); group.add(rim);
  const ptr=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.2,12),MAT.trim(0xff3355)); ptr.position.set(0,2.5,0.14); ptr.rotation.z=Math.PI; group.add(ptr);
  const sign=signMesh('WHEEL','#ff33aa',1.1,0.36); sign.position.set(0,2.85,0.12); group.add(sign);
  group.userData.game='wheel';
  gameBoards.wheel=group;
  _buildWheelVrPanel(group);
  scene.add(group); return group;
}

// spin animation: rotate disc to the winning segment then call cb
window.animateWheelSpin=function(segIdx,nSegs,cb){
  if(!_wheelDisc){setTimeout(cb,800);return;}
  const target=(segIdx/nSegs)*Math.PI*2+Math.PI*2*6;
  const start=_wheelDisc.rotation.z, dur=2800, t0=performance.now();
  function tick(){
    const dt=performance.now()-t0, frac=Math.min(dt/dur,1);
    const ease=1-Math.pow(1-frac,3);
    _wheelDisc.rotation.z=start+target*ease;
    if(frac<1)requestAnimationFrame(tick); else{cb&&cb();}
  }
  tick();
};

function _buildWheelVrPanel(parent) {
  const panel=new THREE.Group(); panel.position.set(0,1.5,1.4); parent.add(panel);
  const frame=neonFrame(1.86,0.86,0xff33aa); panel.add(frame);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.82,0.82),new THREE.MeshBasicMaterial({color:0xff33aa,transparent:true,opacity:0.07})); panel.add(glow);
  const info=vrLabel(1.7,0.18,'#ff33aa'); info.position.set(0,0.25,0.002); panel.add(info);
  const btns=new THREE.Group(); btns.position.set(0,-0.08,0); panel.add(btns);
  const _wvr={panel,info,btns};
  window.updateWheelVrPanel=function(wh){
    wh=wh||window._wh||{bet:200,spinning:false};
    const p=window.currentPlayer,bal=p?Math.floor(p.balance):0;
    const infoTxt=wh._msg||(wh.spinning?'Spinning…':`P$ ${bal}  |  BET ${wh.bet}`);
    const col=wh.lastMult&&wh.lastMult>1?'#00ff88':wh.lastMult===0?'#ff4444':'#ff33aa';
    _wvr.info.userData.setText(infoTxt,col);
    vrRow(_wvr.btns,[
      {label:'BET -',accent:'#555',fn:()=>{if(window._wh)window._wh.bet=Math.max(50,window._wh.bet-50);window.updateWheelVrPanel&&updateWheelVrPanel(window._wh);}},
      {label:'SPIN!',accent:'#ff33aa',fn:()=>window.spinWheel&&spinWheel()},
      {label:'BET +',accent:'#555',fn:()=>{if(window._wh)window._wh.bet=window._wh.bet+50;window.updateWheelVrPanel&&updateWheelVrPanel(window._wh);}},
    ]);
    wh._msg='';
  };
  window.updateWheelVrPanel(null);
}

// ---- Shop: mannequin room ----

function _mannequinMesh(color, hatType, shirtColor) {
  const g=new THREE.Group();
  // pedestal
  const pedMat=new THREE.MeshStandardMaterial({color:0x1a1830,roughness:0.4,metalness:0.5});
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.38,1.05,20),pedMat); ped.position.y=0.525; g.add(ped);
  const pedTop=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.06,20),MAT.gold()); pedTop.position.y=1.08; g.add(pedTop);
  // body (torso cylinder)
  const bodyMat=new THREE.MeshStandardMaterial({color:0xcfc9c0,roughness:0.7,metalness:0.05});
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,0.55,16),bodyMat); torso.position.y=1.51; g.add(torso);
  // shirt band
  if(shirtColor!=null){
    const sm=new THREE.MeshStandardMaterial({color:shirtColor,roughness:0.6,emissive:shirtColor,emissiveIntensity:0.15});
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.17,0.32,16),sm); sh.position.y=1.44; g.add(sh);
  }
  // color disc on chest
  if(color!=null){
    const dm=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.4,roughness:0.5});
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.065,0.02,24),dm); disc.position.y=1.61; disc.rotation.x=Math.PI/2; g.add(disc);
  }
  // neck
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.07,0.1,12),bodyMat); neck.position.y=1.84; g.add(neck);
  // head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.155,20,16),bodyMat); head.position.y=2.02; g.add(head);
  // simple arms (held down)
  for(const side of[-1,1]){
    const sh2=new THREE.Mesh(new THREE.SphereGeometry(0.052,10,8),bodyMat); sh2.position.set(side*0.2,1.71,0); g.add(sh2);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.04,0.42,10),bodyMat); arm.position.set(side*0.2,1.5,0); g.add(arm);
  }
  // hat
  if(hatType==='horse') { _addMannequinHorseHat(g); } else if(hatType) _addMannequinHat(g, hatType);
  return g;
}

function _addMannequinHorseHat(g) {
  if (!window.loadModel) return;
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 2.18, 0);
  g.add(hatGroup);
  loadModel('models/Horse.glb', {}).then(root => {
    if (!root) return;
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y || 1;
    root.scale.setScalar(0.26 / h);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y = -box2.min.y;
    hatGroup.add(root);
  });
}

const MANNEQUIN_HAT_MODELS = {
  'gold-crown':    { file:'models/HatCrown.glb',      h:0.18, dy:0.02 },
  'top-hat':       { file:'models/HatTopHat.glb',     h:0.28, dy:0.02 },
  'cowboy':        { file:'models/HatCowboy.glb',     h:0.20, dy:0.02 },
  'wizard':        { file:'models/HatWizard.glb',     h:0.34, dy:0.04 },
  'viking':        { file:'models/HatVikingHelm.glb', h:0.22, dy:0.0  },
  'halo':          { file:'models/HatHalo.glb',       h:0.10, dy:0.24 },
  'hardhat':       { file:'models/HatHardHat.glb',    h:0.20, dy:0.02 },
  'party-hat':     { file:'models/HatParty.glb',      h:0.26, dy:0.06 },
  'cap':           { file:'models/HatCap.glb',        h:0.15, dy:0.0  },
  'jester':        { file:'models/HatMagician.glb',   h:0.28, dy:0.02 },
  'crown-diamond': { file:'models/HatKingCrown.glb',  h:0.22, dy:0.02 },
  'beret':         { file:'models/HatPirate.glb',     h:0.16, dy:0.02 },
};
function _addMannequinHat(g, type) {
  const def = MANNEQUIN_HAT_MODELS[type];
  if (!def || !window.loadModel) return;
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 2.16 + def.dy, 0);
  g.add(hatGroup);
  loadModel(def.file, {}).then(root => {
    if (!root) return;
    const box = new THREE.Box3().setFromObject(root);
    const h = (box.max.y - box.min.y) || def.h;
    root.scale.setScalar(def.h / h);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y = -box2.min.y;
    root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    hatGroup.add(root);
  });
}

function _shopBtnTex(label, sub, owned) {
  const c=document.createElement('canvas'); c.width=256; c.height=90;
  const x=c.getContext('2d'); x.clearRect(0,0,256,90);
  const accent=owned?'#00aaff':'#ff8833';
  vrRoundRect(x,3,3,250,84,14); x.fillStyle='rgba(14,9,26,0.94)'; x.fill();
  x.lineWidth=5; x.strokeStyle=accent; x.shadowColor=accent; x.shadowBlur=10; x.stroke(); x.shadowBlur=0;
  x.fillStyle='#fff'; x.font='bold 30px Arial'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(label,128,36);
  x.fillStyle='#aaa'; x.font='22px Arial'; x.fillText(sub||'',128,64);
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

function createShopBoard(scene, pos, face) {
  const group=new THREE.Group(); placeStation(group,pos,face);
  group.userData.game='shop';
  // "SHOP" sign at the back wall
  const sign=signMesh('SHOP','#ff8833',4.0,0.7); sign.position.set(0,3.8,-5.8); group.add(sign);
  const frame=neonFrame(4.1,0.75,0xff8833); frame.position.set(0,3.8,-5.8); group.add(frame);

  const items=window.SHOP_ITEMS||[];
  // show 8 mannequins in 2 rows of 4
  const featured=[
    items.find(i=>i.id==='color-gold'),
    items.find(i=>i.id==='hat-crown'),
    items.find(i=>i.id==='shirt-navy'),
    items.find(i=>i.id==='hat-wizard'),
    items.find(i=>i.id==='color-neon'),
    items.find(i=>i.id==='hat-cowboy'),
    items.find(i=>i.id==='shirt-gold'),
    items.find(i=>i.id==='hat-party'),
  ].filter(Boolean);

  const shopBtns=[]; // [{mesh, item}] so we can refresh
  gameBoards._shopBtns=shopBtns;

  featured.forEach((item,idx)=>{
    const row=Math.floor(idx/4), col=idx%4;
    const mx=-4.5+col*3.0, mz=-2.2-row*3.5;
    // mannequin
    const color=item.type==='bodyColor'?item.value:null;
    const hat=item.type==='hat'?item.value:null;
    const shirt=item.type==='shirt'?item.value:null;
    const mq=_mannequinMesh(color,hat,shirt);
    mq.position.set(mx,0,mz); group.add(mq);
    // item name sign
    const ns=signMesh(item.name,'#ff8833',1.5,0.35); ns.position.set(mx,1.18,mz+0.4); group.add(ns);
    // buy/equip button
    const bm=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.75),new THREE.MeshBasicMaterial({transparent:true}));
    bm.position.set(mx,0.5,mz+0.42);
    bm.userData.onSelect=()=>{ window.shopBuyItem&&shopBuyItem(item.id); };
    bm.userData.vrButton=true;
    bm.userData._shopItemId=item.id;
    group.add(bm);
    (window.vrInteractables=window.vrInteractables||[]).push(bm);
    shopBtns.push({mesh:bm,item});
  });

  window.refreshShopVrPanel=function(){
    const p=window.currentPlayer;
    const cos=(p&&p.cosmetics)||{owned:[]};
    const owned=cos.owned||[];
    shopBtns.forEach(({mesh,item})=>{
      const isOwned=owned.includes(item.id);
      const isEq=(item.type==='bodyColor'&&cos.bodyColor===item.value)||
                 (item.type==='hat'&&cos.hat===item.value)||
                 (item.type==='shirt'&&cos.shirt===item.value);
      const label=isEq?'EQUIPPED':isOwned?'EQUIP':`BUY ${item.cost}P$`;
      const sub=isEq?'✓':isOwned?'owned':'';
      mesh.material.map=_shopBtnTex(label,sub,isOwned||isEq);
      mesh.material.needsUpdate=true;
    });
  };

  // refresh once items load
  setTimeout(()=>window.refreshShopVrPanel&&refreshShopVrPanel(),200);
  gameBoards.shop=group; scene.add(group); return group;
}

// ---- Upgrade wall ----

function _upgradeTileTex(def, lvl) {
  const c=document.createElement('canvas'); c.width=512; c.height=256;
  const x=c.getContext('2d'); x.clearRect(0,0,512,256);
  const maxed=lvl>=def.max;
  const accent=maxed?'#ffd700':'#7733ff';
  vrRoundRect(x,6,6,500,244,22); x.fillStyle='rgba(10,7,22,0.95)'; x.fill();
  x.lineWidth=7; x.strokeStyle=accent; x.shadowColor=accent; x.shadowBlur=14; x.stroke(); x.shadowBlur=0;
  x.fillStyle='#fff'; x.font='bold 42px Arial'; x.textAlign='center'; x.textBaseline='top';
  x.fillText(def.icon+' '+def.name,256,20);
  x.fillStyle='#aaa'; x.font='26px Arial'; x.textBaseline='top'; x.fillText(def.desc,256,75);
  // level dots
  const dots='●'.repeat(lvl)+'○'.repeat(def.max-lvl);
  x.fillStyle=maxed?'#ffd700':'#aa66ff'; x.font='bold 32px Arial'; x.fillText(dots,256,118);
  // cost / maxed
  if(maxed){
    x.fillStyle='#ffd700'; x.font='bold 34px Arial'; x.fillText('MAX LEVEL',256,168);
  } else {
    const cost=def.costs[lvl];
    x.fillStyle='#00ff88'; x.font='bold 34px Arial'; x.fillText(`UPGRADE → ${cost} P$`,256,168);
  }
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

function _upgradeBtnTex(def, lvl) {
  const maxed=lvl>=def.max;
  const c=document.createElement('canvas'); c.width=256; c.height=100;
  const x=c.getContext('2d'); x.clearRect(0,0,256,100);
  const accent=maxed?'#ffd700':'#7733ff';
  vrRoundRect(x,4,4,248,92,16); x.fillStyle='rgba(14,9,28,0.96)'; x.fill();
  x.lineWidth=6; x.strokeStyle=accent; x.shadowColor=accent; x.shadowBlur=12; x.stroke(); x.shadowBlur=0;
  x.fillStyle=maxed?'#ffd700':'#fff'; x.font='bold 36px Arial'; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(maxed?'MAX ✓':'UPGRADE',128,50);
  const tex=new THREE.CanvasTexture(c); if(THREE.sRGBEncoding)tex.encoding=THREE.sRGBEncoding;
  return tex;
}

function createUpgradeBoard(scene, pos, face) {
  const group=new THREE.Group(); placeStation(group,pos,face);
  group.userData.game='upgrades';
  const sign=signMesh('UPGRADES','#7733ff',4.5,0.7); sign.position.set(0,4.2,-5.8); group.add(sign);
  const frame2=neonFrame(4.6,0.75,0x7733ff); frame2.position.set(0,4.2,-5.8); group.add(frame2);

  const defs=window.UPGRADE_DEFS||[];
  const tiles=[]; // {tileMesh,btnMesh,def}
  gameBoards._upgradeTiles=tiles;

  defs.forEach((def,idx)=>{
    const row=Math.floor(idx/3), col=idx%3;
    const tx=-3.6+col*3.6, tz=-2.0-row*3.2;
    // tile display
    const lvl=(window.currentPlayer&&window.currentPlayer.upgrades&&window.currentPlayer.upgrades[def.key])||0;
    const tileMat=new THREE.MeshBasicMaterial({map:_upgradeTileTex(def,lvl),transparent:true});
    const tile=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),tileMat); tile.position.set(tx,2.0,tz+0.05); group.add(tile);
    tiles.push({tile,def});
    // upgrade button
    const btnMat=new THREE.MeshBasicMaterial({map:_upgradeBtnTex(def,lvl),transparent:true});
    const btn=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.62),btnMat); btn.position.set(tx,1.1,tz+0.06);
    btn.userData.onSelect=()=>window.shopPurchaseUpgrade&&shopPurchaseUpgrade(def.key);
    btn.userData.vrButton=true;
    group.add(btn);
    (window.vrInteractables=window.vrInteractables||[]).push(btn);
    tiles[tiles.length-1].btn=btn;
  });

  window.refreshUpgradeWall=function(){
    tiles.forEach(({tile,btn,def})=>{
      const lvl=(window.currentPlayer&&window.currentPlayer.upgrades&&window.currentPlayer.upgrades[def.key])||0;
      tile.material.map=_upgradeTileTex(def,lvl); tile.material.needsUpdate=true;
      btn.material.map=_upgradeBtnTex(def,lvl); btn.material.needsUpdate=true;
    });
  };

  // decorative floor glow
  const glowMat=new THREE.MeshStandardMaterial({color:0x7733ff,emissive:0x7733ff,emissiveIntensity:0.5,transparent:true,opacity:0.12});
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(12,12),glowMat); glow.rotation.x=-Math.PI/2; glow.position.y=0.02; group.add(glow);

  gameBoards.upgrades=group; scene.add(group); return group;
}

window.onControllerGrip=(handedness)=>{ if(window.onVRGameInteract)window.onVRGameInteract(handedness); };
window.onControllerTrigger=()=>{};
window.createBlackjackBoard=createBlackjackBoard;
window.createPlinkoBoard=createPlinkoBoard;
window.createWheelBoard=createWheelBoard;
window.createShopBoard=createShopBoard;
window.createUpgradeBoard=createUpgradeBoard;
