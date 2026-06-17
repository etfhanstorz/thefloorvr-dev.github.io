// Decor + ambient "life": furniture in every room, plus animated elements
// (drifting sparkles, pulsing neon, a chasing marquee, color-cycling lights, a
// disco orb, an idle-spinning wheel). main.js calls each fn in window.sceneUpdaters
// every frame with (elapsedSeconds, dt).

window.sceneUpdaters = window.sceneUpdaters || [];

// ---- shared materials ----
const D = {
  pot:    () => new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }),
  leaf:   () => new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.8 }),
  wood:   () => new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7, metalness: 0.1 }),
  fabric: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
  metal:  () => new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.4, metalness: 0.7 }),
  glow:   (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.0, roughness: 0.4 }),
};

// ---- furniture ----
function makePlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.4, 12), D.pot());
  pot.position.y = 0.2; pot.castShadow = true; g.add(pot);
  const leafMat = D.leaf();
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 - i * 0.04, 0), leafMat);
    f.position.y = 0.5 + i * 0.22; f.castShadow = true; g.add(f);
  }
  return g;
}

function makeStool(color) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), D.fabric(color || 0x882233));
  seat.position.y = 0.6; seat.castShadow = true; g.add(seat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), D.metal());
  pole.position.y = 0.3; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), D.metal());
  base.position.y = 0.02; g.add(base);
  return g;
}

function makeCouch(color) {
  const g = new THREE.Group();
  const mat = D.fabric(color);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.7), mat); base.position.y = 0.3; base.castShadow = true; g.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.18), mat); back.position.set(0, 0.65, -0.26); g.add(back);
  [-1, 1].forEach(s => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.7), mat); arm.position.set(s * 0.71, 0.5, 0); g.add(arm); });
  return g;
}

function makeTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), D.wood()); top.position.y = 0.5; top.castShadow = true; g.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8), D.metal()); leg.position.y = 0.25; g.add(leg);
  return g;
}

function makeColumn(accent) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 5.0, 16), new THREE.MeshStandardMaterial({ color: 0x1a1730, roughness: 0.6, metalness: 0.3 }));
  shaft.position.y = 2.5; shaft.castShadow = true; g.add(shaft);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 24), D.glow(accent));
  cap.rotation.x = Math.PI / 2; cap.position.y = 4.6; g.add(cap);
  return g;
}

function makeBanner(accent) {
  const mat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25, roughness: 0.8, side: THREE.DoubleSide });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), mat);
  return b;
}

function makeRug(color, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: true, opacity: 0.5 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
  return m;
}

// place props into a room (local space; local +z faces the boulevard)
function decorateRoom(scene, zone) {
  const g = new THREE.Group();
  g.position.set(zone.x, 0, zone.z);
  g.rotation.y = Math.atan2(zone.face[0], zone.face[2]);
  scene.add(g);

  const halfW = 8, halfD = 5.5;

  // plants in the back corners
  [-1, 1].forEach(s => { const p = makePlant(); p.position.set(s * (halfW - 0.8), 0, -halfD + 0.8); g.add(p); });

  // banner on the back wall
  const banner = makeBanner(zone.accent);
  banner.position.set(0, 2.6, -halfD - 0.18); g.add(banner);

  // a soft rug under the room
  g.add(makeRug(zone.accent, 6, 6));

  if (zone.type === 'lobby') {
    // reception desk + a seating lounge
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.8), D.wood());
    desk.position.set(0, 0.5, -2.5); desk.castShadow = true; g.add(desk);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.0), D.glow(zone.accent));
    deskTop.position.set(0, 1.02, -2.5); deskTop.material.emissiveIntensity = 0.4; g.add(deskTop);
    g.add(place(makeCouch(0x33324a), -3, 0, 2.5, 0));
    g.add(place(makeCouch(0x33324a), 3, 0, 2.5, Math.PI));
    g.add(place(makeTable(), 0, 0, 2.5, 0));
  } else if (zone.key === 'hangout') {
    g.add(place(makeCouch(0x2b4a3a), -2.5, 0, 0, Math.PI / 2));
    g.add(place(makeCouch(0x2b4a3a), 2.5, 0, 0, -Math.PI / 2));
    g.add(place(makeTable(), 0, 0, 0, 0));
  } else if (zone.type === 'game') {
    // stools flanking the station + a drinks table to the side
    g.add(place(makeStool(0x882233), -3, 0, 3.2, 0));
    g.add(place(makeStool(0x223388), 3, 0, 3.2, 0));
    const t = makeTable(); t.scale.set(0.7, 0.7, 0.7); t.position.set(5.5, 0, 2.5); g.add(t);
    const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.18, 8), D.glow(0xffcc66));
    drink.material.emissiveIntensity = 0.5; drink.position.set(5.5, 0.62, 2.5); g.add(drink);
  }
  return g;
}

function place(obj, x, y, z, ry) { obj.position.set(x, y, z); obj.rotation.y = ry || 0; return obj; }

// ---- ambient animated life ----

function buildAmbientLife(scene) {
  // drifting golden sparkles along the boulevard
  const N = 350;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 140;
    pos[i * 3 + 1] = Math.random() * 6 + 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.06, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(sparkles);
  window.sceneUpdaters.push((t, dt) => {
    const p = sparkles.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] += dt * 0.25;
      p[i * 3] += Math.sin(t + i) * dt * 0.05;
      if (p[i * 3 + 1] > 6.5) p[i * 3 + 1] = 0.5;
    }
    sparkles.geometry.attributes.position.needsUpdate = true;
  });

  // chasing marquee bulbs along the boulevard ceiling edges
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.08, 8, 8);
  for (let x = -64; x <= 64; x += 4) {
    [-12, 12].forEach(z => {
      const b = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffcc55, emissiveIntensity: 0.3 }));
      b.position.set(x, 5.6, z); scene.add(b); bulbs.push(b);
    });
  }
  window.sceneUpdaters.push((t) => {
    const phase = Math.floor(t * 6);
    for (let i = 0; i < bulbs.length; i++) {
      bulbs[i].material.emissiveIntensity = ((i + phase) % 4 === 0) ? 1.6 : 0.25;
    }
  });

  // color-cycling casino lights over the boulevard
  const cyc = [new THREE.PointLight(0xff2266, 0.6, 55), new THREE.PointLight(0x22ccff, 0.6, 55)];
  cyc[0].position.set(-20, 4.5, 0); cyc[1].position.set(20, 4.5, 0);
  cyc.forEach(l => scene.add(l));
  window.sceneUpdaters.push((t) => {
    cyc[0].color.setHSL((t * 0.05) % 1, 0.8, 0.55);
    cyc[1].color.setHSL((t * 0.05 + 0.5) % 1, 0.8, 0.55);
  });

  // disco orb over the lobby
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.15, emissive: 0x333355, emissiveIntensity: 0.4 }));
  orb.position.set(-56, 3.8, 0); scene.add(orb);
  window.sceneUpdaters.push((t, dt) => { orb.rotation.y += dt * 0.6; });

  // idle-spin the wheel
  window.sceneUpdaters.push((t, dt) => {
    if (typeof gameBoards !== 'undefined' && gameBoards.wheel) {
      const disc = gameBoards.wheel.getObjectByName('wheelDisc');
      if (disc) disc.rotation.z += dt * 0.4;
    }
  });
}

function buildBoulevardDecor(scene) {
  // columns + planters down both sides
  for (let x = -50; x <= 60; x += 22) {
    [-11, 11].forEach(z => {
      const col = makeColumn(z < 0 ? 0x33ccff : 0xff33aa);
      col.position.set(x, 0, z); scene.add(col);
    });
  }
  // hanging banners across the boulevard
  const accents = [0xffd24a, 0x33ccff, 0xff33aa, 0x33cc66];
  for (let i = 0, x = -45; x <= 55; x += 25, i++) {
    const b = makeBanner(accents[i % accents.length]);
    b.scale.set(1.4, 1.6, 1); b.position.set(x, 4.2, 0); scene.add(b);
  }
}

function buildDecor(scene) {
  (window.FLOOR_ZONES || []).forEach(z => decorateRoom(scene, z));
  buildBoulevardDecor(scene);
  buildAmbientLife(scene);
}

window.buildDecor = buildDecor;
