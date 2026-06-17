// In-world casino game stations. Floor-standing, production-styled machines
// arranged in a row in front of spawn. Each group is tagged userData.game so the
// controller can open it; the actual bet/play controls are the vr-ui.js panels.

let gameBoards = {};

// place a station group at a zone: position on the floor + face the boulevard
function placeStation(group, pos, face) {
  pos = pos || { x: 0, z: -4 };
  face = face || [0, 0, 1];
  group.position.set(pos.x, 0, pos.z);
  group.rotation.y = Math.atan2(face[0], face[2]); // local +z aligns with face
  group.userData.faceDir = face;
}

// ---------- shared helpers ----------

const MAT = {
  cabinet: () => new THREE.MeshStandardMaterial({ color: 0x14101f, roughness: 0.5, metalness: 0.4 }),
  trim:    (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.6 }),
  gold:    () => new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffaa33, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.25 }),
  felt:    () => new THREE.MeshStandardMaterial({ color: 0x0a5c2a, roughness: 0.95, metalness: 0.0 }),
  dark:    () => new THREE.MeshStandardMaterial({ color: 0x07040d, roughness: 0.8 }),
};

function signMesh(text, color, w, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(6,4,14,0.92)';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = color; x.lineWidth = 8; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = color;
  x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 18;
  x.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return m;
}

// a glowing neon frame (4 thin bars) around a w x h face on the XY plane
function neonFrame(w, h, color) {
  const g = new THREE.Group();
  const mat = MAT.trim(color);
  const t = 0.06;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), mat); top.position.y = h / 2;
  const bot = new THREE.Mesh(new THREE.BoxGeometry(w, t, t), mat); bot.position.y = -h / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), mat); left.position.x = -w / 2;
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), mat); right.position.x = w / 2;
  g.add(top, bot, left, right);
  return g;
}

// ---------- Blackjack: felt table ----------

function createBlackjackBoard(scene, pos, face) {
  const group = new THREE.Group();
  placeStation(group, pos, face);

  // pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.95, 16), MAT.cabinet());
  ped.position.y = 0.47; ped.castShadow = true; group.add(ped);

  // round felt top
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 40), MAT.felt());
  top.position.y = 0.98; top.castShadow = true; top.receiveShadow = true; group.add(top);
  // gold rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 12, 48), MAT.gold());
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.04; group.add(rim);

  // bet circles on the felt
  const circleMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x553300, emissiveIntensity: 0.3, roughness: 0.6 });
  for (let i = -1; i <= 1; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 24), circleMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(i * 0.45, 1.05, 0.4);
    group.add(ring);
  }

  // backboard sign
  const sign = signMesh('BLACKJACK', '#ffd24a', 1.6, 0.42);
  sign.position.set(0, 1.9, -0.6);
  group.add(sign);

  group.userData.game = 'blackjack';
  gameBoards.blackjack = group;
  scene.add(group);
  return group;
}

// ---------- Plinko: tall pegboard cabinet ----------

function createPlinkoBoard(scene, pos, face) {
  const group = new THREE.Group();
  placeStation(group, pos, face);

  // cabinet
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.3), MAT.cabinet());
  cab.position.y = 1.3; cab.castShadow = true; group.add(cab);
  // recessed dark play face
  const playFace = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.6, 0.05), MAT.dark());
  playFace.position.set(0, 1.45, 0.16); group.add(playFace);

  // peg grid
  const pegMat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, emissive: 0x334466, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.4 });
  for (let row = 0; row < 7; row++) {
    const n = row + 3;
    for (let col = 0; col < n; col++) {
      const peg = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), pegMat);
      peg.position.set((col - (n - 1) / 2) * 0.16, 1.95 - row * 0.18, 0.2);
      group.add(peg);
    }
  }

  // multiplier slots at the bottom
  const slotColors = [0xff3355, 0xff8833, 0x33cc66, 0x33ccff, 0x33cc66, 0xff8833, 0xff3355];
  const slotVals = ['5x', '2x', '1x', '0.5', '1x', '2x', '5x'];
  for (let i = 0; i < 7; i++) {
    const sx = (i - 3) * 0.16;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), MAT.trim(slotColors[i]));
    slot.position.set(sx, 0.78, 0.2); group.add(slot);
    const lbl = signMesh(slotVals[i], '#ffffff', 0.14, 0.1);
    lbl.position.set(sx, 0.78, 0.25); group.add(lbl);
  }

  // neon frame + sign
  const frame = neonFrame(1.3, 1.75, 0x33ccff);
  frame.position.set(0, 1.45, 0.18); group.add(frame);
  const sign = signMesh('PLINKO', '#33ccff', 1.3, 0.4);
  sign.position.set(0, 2.55, 0.18); group.add(sign);

  group.userData.game = 'plinko';
  gameBoards.plinko = group;
  scene.add(group);
  return group;
}

// ---------- Wheel of Fortune: vertical spinning wheel ----------

function wheelFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const cx = 256, cy = 256, r = 250;
  const labels = ['50x', '2x', '5x', '1x', '10x', '0.5', '25x', '1.5', '-5x', '2x', '5x', '-2x'];
  const cols = ['#ffd24a', '#3366ff', '#33cc66', '#888', '#ff8833', '#555', '#ff33aa', '#999', '#cc2222', '#3366ff', '#33cc66', '#aa2222'];
  const n = labels.length;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0, a1); x.closePath();
    x.fillStyle = cols[i]; x.fill();
    x.strokeStyle = '#1a0f25'; x.lineWidth = 4; x.stroke();
    // label
    x.save(); x.translate(cx, cy); x.rotate((a0 + a1) / 2);
    x.fillStyle = '#0a0614'; x.font = 'bold 34px Arial'; x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText(labels[i], r - 18, 0); x.restore();
  }
  // hub
  x.beginPath(); x.arc(cx, cy, 34, 0, Math.PI * 2); x.fillStyle = '#ffcc55'; x.fill();
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function createWheelBoard(scene, pos, face) {
  const group = new THREE.Group();
  placeStation(group, pos, face);

  // stand pole + base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.2, 20), MAT.cabinet());
  base.position.y = 0.1; group.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12), MAT.cabinet());
  pole.position.y = 0.9; group.add(pole);

  // wheel disc (faces +z)
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 48),
    new THREE.MeshStandardMaterial({ map: wheelFaceTexture(), roughness: 0.5, metalness: 0.2, emissiveIntensity: 0.2 })
  );
  disc.position.set(0, 1.65, 0.12);
  disc.name = 'wheelDisc';
  group.add(disc);
  // gold rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 12, 48), MAT.gold());
  rim.position.set(0, 1.65, 0.12); group.add(rim);

  // pointer at top
  const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12), MAT.trim(0xff3355));
  ptr.position.set(0, 2.5, 0.14); ptr.rotation.z = Math.PI; group.add(ptr);

  const sign = signMesh('WHEEL', '#ff33aa', 1.1, 0.36);
  sign.position.set(0, 2.85, 0.12); group.add(sign);

  group.userData.game = 'wheel';
  gameBoards.wheel = group;
  scene.add(group);
  return group;
}

// ---------- Shop: glowing kiosk ----------

function createShopBoard(scene, pos, face) {
  const group = new THREE.Group();
  placeStation(group, pos, face);

  // counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.7), MAT.cabinet());
  counter.position.y = 0.5; counter.castShadow = true; group.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.8), MAT.gold());
  counterTop.position.y = 1.02; group.add(counterTop);

  // back shelf with sample cosmetic cubes
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.15), MAT.cabinet());
  shelf.position.set(0, 1.8, -0.5); group.add(shelf);
  const cosColors = [0xff3333, 0x3366ff, 0xaa33ff, 0xffcc00];
  cosColors.forEach((c, i) => {
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), MAT.trim(c));
    item.position.set(-0.6 + i * 0.4, 1.6, -0.4); group.add(item);
  });

  const frame = neonFrame(1.7, 1.4, 0xff8833);
  frame.position.set(0, 1.8, -0.42); group.add(frame);
  const sign = signMesh('SHOP', '#ff8833', 1.3, 0.4);
  sign.position.set(0, 2.7, -0.42); group.add(sign);

  group.userData.game = 'shop';
  gameBoards.shop = group;
  scene.add(group);
  return group;
}

window.onControllerGrip = (handedness) => {
  if (window.onVRGameInteract) window.onVRGameInteract(handedness);
};
window.onControllerTrigger = () => {};
