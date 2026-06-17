// Casino environment. Tuned to look good in VR while staying cheap on the Quest
// (one shadow-casting light; accent point lights cast no shadows; emissive
// materials do the "glow" without extra lights).

function makeCarpetTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  // deep red base
  x.fillStyle = '#3a0d18';
  x.fillRect(0, 0, 256, 256);
  // gold diamond lattice
  x.strokeStyle = 'rgba(200,160,60,0.35)';
  x.lineWidth = 3;
  for (let i = -256; i < 256; i += 48) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke();
    x.beginPath(); x.moveTo(i, 256); x.lineTo(i + 256, 0); x.stroke();
  }
  // small dots at intersections
  x.fillStyle = 'rgba(220,180,80,0.5)';
  for (let a = 0; a <= 256; a += 48) for (let b = 0; b <= 256; b += 48) {
    x.beginPath(); x.arc(a, b, 3, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function createCasinoFloor(scene) {
  // ---- floor: carpet ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), roughness: 0.9, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- ceiling ----
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x12091f, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 20;
  scene.add(ceiling);

  // glowing ceiling light panels (emissive, no extra real lights needed)
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0xfff0c0, emissiveIntensity: 0.8 });
  for (let gx = -30; gx <= 30; gx += 30) {
    for (let gz = -30; gz <= 30; gz += 30) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8), panelMat);
      panel.position.set(gx, 19.8, gz);
      scene.add(panel);
    }
  }

  // ---- walls ----
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x161430, roughness: 0.6, metalness: 0.2 });
  const walls = [
    [0, 10, -50, 100, 20, 1],
    [0, 10, 50, 100, 20, 1],
    [50, 10, 0, 1, 20, 100],
    [-50, 10, 0, 1, 20, 100],
  ];
  walls.forEach(([px, py, pz, w, h, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(px, py, pz);
    wall.receiveShadow = true;
    scene.add(wall);
  });

  // neon trim strips along the top of each wall (emissive, glow)
  const neonColors = [0xff2266, 0x22ccff, 0xff2266, 0x22ccff];
  const trimDefs = [
    [0, 18, -49.4, 100, 0.4, 0.3],
    [0, 18, 49.4, 100, 0.4, 0.3],
    [49.4, 18, 0, 0.3, 0.4, 100],
    [-49.4, 18, 0, 0.3, 0.4, 100],
  ];
  trimDefs.forEach((d, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: neonColors[i], emissive: neonColors[i], emissiveIntensity: 1.0 });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(d[3], d[4], d[5]), mat);
    trim.position.set(d[0], d[1], d[2]);
    scene.add(trim);
  });

  // ---- lighting ----
  const hemi = new THREE.HemisphereLight(0x9fb4ff, 0x2a1530, 0.55);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x404060, 0.4);
  scene.add(ambient);

  // single shadow-casting key light
  const key = new THREE.DirectionalLight(0xfff2d6, 0.9);
  key.position.set(20, 40, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60;
  key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
  scene.add(key);

  // warm center glow + a couple of casino accent lights (no shadows = cheap)
  const center = new THREE.PointLight(0xffd28a, 0.8, 70);
  center.position.set(0, 16, 0);
  scene.add(center);
  const accentA = new THREE.PointLight(0xff2266, 0.5, 50);
  accentA.position.set(-35, 6, -20);
  scene.add(accentA);
  const accentB = new THREE.PointLight(0x22ccff, 0.5, 50);
  accentB.position.set(35, 6, 20);
  scene.add(accentB);

  // ---- center chandelier ----
  const chandelier = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffaa33, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 12, 48), ringMat);
  ring1.rotation.x = Math.PI / 2; ring1.position.y = 17;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 12, 40), ringMat);
  ring2.rotation.x = Math.PI / 2; ring2.position.y = 16;
  chandelier.add(ring1); chandelier.add(ring2);
  scene.add(chandelier);

  // ---- "THE FLOOR" sign on the north wall ----
  const sign = makeTextPanel('THE FLOOR', 1024, 256, '#ffd24a');
  sign.scale.set(20, 5, 1);
  sign.position.set(0, 13, -49.3);
  scene.add(sign);

  // ---- slot-machine decor along both side walls ----
  const slotBodyMat = new THREE.MeshStandardMaterial({ color: 0x6a0d1a, roughness: 0.4, metalness: 0.5, emissive: 0x220008, emissiveIntensity: 0.3 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x001a0a, emissive: 0x00ff88, emissiveIntensity: 0.7 });
  for (let i = 0; i < 8; i++) {
    const z = -30 + i * 8.5;
    [-1, 1].forEach((side) => {
      const x = side * 47;
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), slotBodyMat);
      body.position.set(x, 2, z);
      body.castShadow = true; body.receiveShadow = true;
      scene.add(body);

      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), screenMat);
      screen.position.set(x - side * 1.02, 2.4, z);
      screen.rotation.y = side * Math.PI / 2;
      scene.add(screen);
    });
  }
}

// emissive text panel that "glows" regardless of lighting
function makeTextPanel(text, w, h, color) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,5,16,0.85)';
  x.fillRect(0, 0, w, h);
  x.fillStyle = color;
  x.font = `bold ${Math.floor(h * 0.55)}px Arial`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return mesh;
}
