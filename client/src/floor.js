// Casino environment — a central boulevard with rooms off each side.
// Layout is a single source of truth (window.FLOOR_ZONES) consumed by main.js
// (to place game stations) and built here (floor pads, walls, signage).
//
// Coords: boulevard runs along X (lobby at the west end, x negative). Rooms sit
// on the north (z = -18) and south (z = +18) sides, opening toward the boulevard.

window.FLOOR_ZONES = [
  { key: 'lobby',     label: 'LOBBY',            accent: 0xffd24a, x: -56, z: 0,   face: [1, 0, 0],  type: 'lobby' },
  // north side (open toward +z)
  { key: 'hangout',   label: 'HANGOUT',          accent: 0x66ddff, x: -36, z: -18, face: [0, 0, 1],  type: 'soon', note: 'CHILL ZONE' },
  { key: 'poker',     label: 'POKER',            accent: 0xaa66ff, x: -12, z: -18, face: [0, 0, 1],  type: 'soon', note: 'COMING 0.9.0' },
  { key: 'tbd1',      label: '???',              accent: 0x888899, x: 12,  z: -18, face: [0, 0, 1],  type: 'soon', note: 'COMING SOON' },
  { key: 'shop',      label: 'SHOP',             accent: 0xff8833, x: 36,  z: -18, face: [0, 0, 1],  type: 'game', game: 'shop' },
  // south side (open toward -z)
  { key: 'upgrades',  label: 'UPGRADES',         accent: 0xffd24a, x: -36, z: 18,  face: [0, 0, -1], type: 'soon', note: 'IN SHOP' },
  { key: 'blackjack', label: 'BLACKJACK',        accent: 0xffd24a, x: -12, z: 18,  face: [0, 0, -1], type: 'game', game: 'blackjack' },
  { key: 'wheel',     label: 'WHEEL',            accent: 0xff33aa, x: 12,  z: 18,  face: [0, 0, -1], type: 'game', game: 'wheel' },
  { key: 'plinko',    label: 'PLINKO',           accent: 0x33ccff, x: 36,  z: 18,  face: [0, 0, -1], type: 'game', game: 'plinko' },
  { key: 'slots',     label: 'SLOTS',            accent: 0x33cc66, x: 56,  z: 18,  face: [0, 0, -1], type: 'soon', note: 'COMING 1.1.0' },
  { key: 'tokens',    label: 'TOKEN EXCHANGE',   accent: 0xffd24a, x: 56,  z: -18, face: [0, 0, 1],  type: 'soon', note: 'COMING 1.1.5' },
];

const ROOM_W = 18, ROOM_D = 13, WALL_H = 5;
const FLOOR_W = 150, FLOOR_D = 62;

function makeCarpetTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#3a0d18'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(200,160,60,0.35)'; x.lineWidth = 3;
  for (let i = -256; i < 256; i += 48) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke();
    x.beginPath(); x.moveTo(i, 256); x.lineTo(i + 256, 0); x.stroke();
  }
  x.fillStyle = 'rgba(220,180,80,0.5)';
  for (let a = 0; a <= 256; a += 48) for (let b = 0; b <= 256; b += 48) { x.beginPath(); x.arc(a, b, 3, 0, Math.PI * 2); x.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 12);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function floorSign(text, colorHex, w, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  const col = '#' + colorHex.toString(16).padStart(6, '0');
  x.fillStyle = 'rgba(6,4,14,0.9)'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = col; x.lineWidth = 8; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
  // auto-shrink the font so long labels (e.g. TOKEN EXCHANGE) aren't cropped
  let fontSize = 60;
  const maxW = 460;
  do { x.font = `bold ${fontSize}px Arial`; fontSize -= 2; }
  while (x.measureText(text).width > maxW && fontSize > 16);
  x.shadowColor = col; x.shadowBlur = 18; x.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

function buildZone(scene, zone) {
  const g = new THREE.Group();
  g.position.set(zone.x, 0, zone.z);
  g.rotation.y = Math.atan2(zone.face[0], zone.face[2]); // local +z -> faces boulevard
  scene.add(g);

  const accentMat = new THREE.MeshStandardMaterial({ color: zone.accent, emissive: zone.accent, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.6 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x171433, roughness: 0.7, metalness: 0.2 });

  // floor pad (tinted)
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshStandardMaterial({ color: zone.accent, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.18 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, 0); g.add(pad);

  // back + side walls (alcove opens toward +z = boulevard)
  const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, WALL_H, 0.4), wallMat);
  back.position.set(0, WALL_H / 2, -ROOM_D / 2); g.add(back);
  [-1, 1].forEach((s) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.4, WALL_H, ROOM_D), wallMat);
    sw.position.set(s * ROOM_W / 2, WALL_H / 2, 0); g.add(sw);
  });

  // neon trim along the top of the back wall
  const trim = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.25, 0.25), accentMat);
  trim.position.set(0, WALL_H - 0.3, -ROOM_D / 2 + 0.2); g.add(trim);

  // signs over the opening
  const sign = floorSign(zone.label, zone.accent, ROOM_W * 0.7, 1.4);
  sign.position.set(0, WALL_H - 1.2, ROOM_D / 2 - 0.2); g.add(sign);

  if (zone.type === 'soon' && zone.note) {
    const note = floorSign(zone.note, zone.accent, ROOM_W * 0.55, 1.0);
    note.position.set(0, 1.6, -ROOM_D / 2 + 0.3); g.add(note);
    // soft barrier so it reads as "not open yet"
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 1.0, 0.15), new THREE.MeshStandardMaterial({ color: zone.accent, emissive: zone.accent, emissiveIntensity: 0.4, transparent: true, opacity: 0.4 }));
    barrier.position.set(0, 0.5, ROOM_D / 2 - 0.3); g.add(barrier);
  }
  return g;
}

function createCasinoFloor(scene) {
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), roughness: 0.9, metalness: 0.0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), new THREE.MeshStandardMaterial({ color: 0x12091f, roughness: 1.0, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = WALL_H + 1; scene.add(ceiling);

  // ceiling light panels along the boulevard
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0xfff0c0, emissiveIntensity: 0.7 });
  for (let gx = -60; gx <= 60; gx += 20) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 4), panelMat);
    panel.position.set(gx, WALL_H + 0.8, 0); scene.add(panel);
  }

  // perimeter walls
  const peri = new THREE.MeshStandardMaterial({ color: 0x100e24, roughness: 0.8, metalness: 0.2 });
  const W = FLOOR_W / 2, D = FLOOR_D / 2;
  [[0, -D, FLOOR_W, 1], [0, D, FLOOR_W, 1], [-W, 0, 1, FLOOR_D], [W, 0, 1, FLOOR_D]].forEach(([px, pz, w, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H + 2, d), peri);
    wall.position.set(px, (WALL_H + 2) / 2, pz); scene.add(wall);
  });

  // lighting
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a1530, 0.55));
  scene.add(new THREE.AmbientLight(0x404060, 0.4));
  const key = new THREE.DirectionalLight(0xfff2d6, 0.85);
  key.position.set(20, 50, 20); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -90; key.shadow.camera.right = 90; key.shadow.camera.top = 50; key.shadow.camera.bottom = -50;
  scene.add(key);
  // accent lights down the boulevard
  [[-40, 0xff2266], [0, 0xffd28a], [40, 0x22ccff]].forEach(([x, col]) => {
    const p = new THREE.PointLight(col, 0.6, 60); p.position.set(x, WALL_H - 0.5, 0); scene.add(p);
  });

  // lobby chandelier
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffaa33, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 12, 48), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.set(-56, WALL_H - 0.6, 0); scene.add(ring);

  // big lobby sign
  const big = floorSign('THE FLOOR', 0xffd24a, 10, 2);
  big.position.set(-56, 3.2, 0); big.rotation.y = Math.PI / 2; scene.add(big);

  // build every zone's room
  window.FLOOR_ZONES.forEach((z) => buildZone(scene, z));
}
