// Places real (downloaded) glTF props across the casino, reusing the few models we
// have for every spot: ornate CHAIRS for table seating and FLOWER VASES for decor.
// Driven by window.FLOOR_ZONES so every room/station gets dressed. No animals.
//
// Models are cloned from cache, so all chairs share one geometry/material upload.

(function () {
  const CHAIR_URL = 'models/Chair.glb';
  const VASE_URL = 'models/VaseFlowers.glb';
  const CHAIR_YAW = 0;      // global tweak if chairs face the wrong way
  const CHAIR_H = 1.0;      // target chair height (m)
  const VASE_H = 0.72;      // target vase height (m)

  // poker seat offsets (local to the poker table), mirrors SEAT_POS in poker-table.js
  const POKER_SEATS = [
    { x: 0, z: 1.05 }, { x: -0.9, z: 0.45 }, { x: -0.9, z: -0.55 }, { x: 0.9, z: -0.55 }, { x: 0.9, z: 0.45 },
  ];

  function fitOnFloor(obj, targetH) {
    let box = new THREE.Box3().setFromObject(obj);
    const h = (box.max.y - box.min.y) || targetH;
    obj.scale.multiplyScalar(targetH / h);
    box = new THREE.Box3().setFromObject(obj);
    obj.position.y = -box.min.y;
    return obj;
  }

  async function placeChair(scene, x, z, faceX, faceZ) {
    const chair = await loadModel(CHAIR_URL, { castShadow: true });
    if (!chair) return null;
    fitOnFloor(chair, CHAIR_H);
    chair.position.x = x; chair.position.z = z;
    chair.rotation.y = Math.atan2(faceX - x, faceZ - z) + CHAIR_YAW; // face toward (faceX,faceZ)
    scene.add(chair);
    return chair;
  }

  async function placeVase(scene, x, z, scale) {
    const vase = await loadModel(VASE_URL, { castShadow: true });
    if (!vase) return null;
    fitOnFloor(vase, VASE_H * (scale || 1));
    vase.position.x = x; vase.position.z = z;
    vase.rotation.y = Math.random() * Math.PI * 2;
    scene.add(vase);
    return vase;
  }

  // a row of chairs on the boulevard side of a station, all facing the station
  async function rowChairs(scene, p, f, n, spread, dist) {
    const perp = { x: -f.z, z: f.x };
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * spread;
      const x = p.x + f.x * dist + perp.x * t;
      const z = p.z + f.z * dist + perp.z * t;
      await placeChair(scene, x, z, p.x, p.z);
    }
  }

  // a vase to each side of a station
  async function flankVases(scene, p, f, side) {
    const perp = { x: -f.z, z: f.x };
    await placeVase(scene, p.x + perp.x * side - f.x * 0.4, p.z + perp.z * side - f.z * 0.4, 1);
    await placeVase(scene, p.x - perp.x * side - f.x * 0.4, p.z - perp.z * side - f.z * 0.4, 1);
  }

  // dress an empty "coming soon" room: a couple of vases deeper in the room (away from
  // the boulevard), plus a chair or two so it doesn't look bare
  async function dressSoonRoom(scene, p, f) {
    const perp = { x: -f.z, z: f.x };
    // back of the room is opposite the boulevard-facing direction
    const back = { x: p.x - f.x * 2.4, z: p.z - f.z * 2.4 };
    await placeVase(scene, back.x + perp.x * 2.2, back.z + perp.z * 2.2, 1.1);
    await placeVase(scene, back.x - perp.x * 2.2, back.z - perp.z * 2.2, 1.1);
    await placeChair(scene, p.x + perp.x * 1.6, p.z + perp.z * 1.6, p.x, p.z);
    await placeChair(scene, p.x - perp.x * 1.6, p.z - perp.z * 1.6, p.x, p.z);
  }

  window.placeRealModels = async function (scene) {
    if (!scene || !window.loadModel) return;
    const zones = window.FLOOR_ZONES || [];
    try {
      for (const z of zones) {
        const p = { x: z.x, z: z.z };
        const f = { x: (z.face && z.face[0]) || 0, z: (z.face && z.face[2]) || 1 };

        if (z.game === 'poker') {
          // chairs at all five seats (table center = poker zone; face is +z so local = world)
          for (const sp of POKER_SEATS) {
            const cx = p.x + sp.x * 1.55, cz = p.z + sp.z * 1.55;
            await placeChair(scene, cx, cz, p.x, p.z);
          }
          await flankVases(scene, p, f, 2.6);
        } else if (z.game === 'blackjack') {
          await rowChairs(scene, p, f, 3, 0.8, 1.7);
          await flankVases(scene, p, f, 2.3);
        } else if (z.type === 'game') {
          await flankVases(scene, p, f, 1.9);
        } else if (z.type === 'soon') {
          await dressSoonRoom(scene, p, f);
        } else if (z.type === 'lobby') {
          await flankVases(scene, p, f, 3.0);
        }
      }
      console.log('[models] casino dressed with real props');
    } catch (e) {
      console.warn('[models] placeRealModels error', e && e.message ? e.message : e);
    }
  };
})();
