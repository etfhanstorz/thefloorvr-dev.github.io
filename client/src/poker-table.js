// Poker Stage 3: 3D table, chip models, card meshes.
// createPokerBoard() builds the scene object; window.updatePokerTable(state) drives visuals.

(function () {

  // ---- chip geometry (shared) ----
  const CHIP_R = 0.045, CHIP_H = 0.018;
  let _chipGeo = null;
  function chipGeo() { return _chipGeo || (_chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 32)); }

  const CHIP_COLORS = ['#e63946', '#4361ee', '#06d6a0', '#ffd166', '#f4a261'];

  function chipSideTex(hex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 6, 256, 10);
    ctx.fillRect(0, 48, 256, 10);
    return new THREE.CanvasTexture(c);
  }

  const _chipMats = {};
  function getChipMats(colorIdx) {
    if (_chipMats[colorIdx]) return _chipMats[colorIdx];
    const hex = CHIP_COLORS[colorIdx % CHIP_COLORS.length];
    const num = parseInt(hex.slice(1), 16);
    const mats = [
      new THREE.MeshStandardMaterial({ map: chipSideTex(hex), roughness: 0.5, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: num, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: num, roughness: 0.5 }),
    ];
    _chipMats[colorIdx] = mats;
    return mats;
  }

  function makeChipStack(amount, colorIdx) {
    const group = new THREE.Group();
    const count = Math.min(Math.max(1, Math.ceil(amount / 50)), 12);
    const mats = getChipMats(colorIdx);
    for (let i = 0; i < count; i++) {
      const chip = new THREE.Mesh(chipGeo(), mats);
      chip.position.y = i * (CHIP_H + 0.002);
      chip.castShadow = true;
      group.add(chip);
    }
    return group;
  }

  // ---- card geometry ----
  const CARD_W = 0.065, CARD_H = 0.002, CARD_D = 0.09;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  function rankStr(r) { return RANKS[r] || (r === 10 ? '10' : String(r)); }

  function cardFaceTex(card) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8f4ff'; ctx.fillRect(0, 0, 128, 192);
    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 122, 186);
    const red = card.s === 1 || card.s === 2;
    ctx.fillStyle = red ? '#cc2233' : '#111133';
    ctx.font = 'bold 32px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(rankStr(card.r), 8, 6);
    ctx.font = '28px Arial'; ctx.fillText(SUITS[card.s], 8, 38);
    ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SUITS[card.s], 64, 112);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  let _backTex = null;
  function cardBackTex() {
    if (_backTex) return _backTex;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a0a3a'; ctx.fillRect(0, 0, 128, 192);
    ctx.strokeStyle = '#6633cc'; ctx.lineWidth = 2;
    for (let x = -20; x < 148; x += 20) {
      for (let y = -20; y < 212; y += 20) {
        ctx.beginPath();
        ctx.moveTo(x + 10, y); ctx.lineTo(x + 20, y + 10);
        ctx.lineTo(x + 10, y + 20); ctx.lineTo(x, y + 10);
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#aa66ff'; ctx.lineWidth = 5; ctx.strokeRect(6, 6, 116, 180);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    _backTex = tex;
    return tex;
  }

  const _edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  function makeCardMesh(card) {
    // card lies flat in XZ plane (thin in Y). +y face = top.
    // BoxGeometry material order: +x,-x,+y,-y,+z,-z → face=+y(idx2), back=-y(idx3)
    const geo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
    const mats = [
      _edgeMat, _edgeMat,
      card
        ? new THREE.MeshStandardMaterial({ map: cardFaceTex(card), roughness: 0.4 })
        : new THREE.MeshStandardMaterial({ map: cardBackTex(), roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: cardBackTex(), roughness: 0.5 }),
      _edgeMat, _edgeMat,
    ];
    return new THREE.Mesh(geo, mats);
  }

  // ---- seat positions (local to table group, table center = 0,0,0) ----
  // Oval table: CylinderGeometry r=1 scaled x=1.5 → 3m wide, 2m deep
  const SEAT_POS = [
    { x:  0.00, z:  1.05 },   // south
    { x: -0.90, z:  0.45 },   // SW
    { x: -0.90, z: -0.55 },   // NW
    { x:  0.90, z: -0.55 },   // NE
    { x:  0.90, z:  0.45 },   // SE
  ];
  const TABLE_Y = 0.88; // table surface Y in group space

  // perpendicular spread direction for card fan at each seat
  function spreadDir(sp) {
    const len = Math.sqrt(sp.x * sp.x + sp.z * sp.z) || 1;
    return { x: -sp.z / len, z: sp.x / len };
  }

  // ---- state ----
  let pkTableGroup = null;
  let pkSeatSlots = [];  // { chipGroup, cardGroups[5], nameTag, nameCanvas, nameTex, nameCtx }
  let pkPotGroup = null;
  let pkDealerDisc = null;

  // ---- sign helper (mirrors vr-games.js signMesh) ----
  function pokerSign(text, color, w, h) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(6,4,14,0.92)'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = color;
    ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
  }

  // ---- build table ----
  function createPokerBoard(scene, pos, face) {
    const group = new THREE.Group();
    pos = pos || { x: -12, z: -18 };
    face = face || [0, 0, 1];
    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = Math.atan2(face[0], face[2]);
    group.userData.faceDir = face;
    group.userData.game = 'poker';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b1e08, roughness: 0.7, metalness: 0.1 });
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x0a5c2a, roughness: 0.95 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c2e0a, roughness: 0.6, metalness: 0.1 });

    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, TABLE_Y - 0.06, 16), woodMat);
    ped.position.y = (TABLE_Y - 0.06) / 2;
    ped.castShadow = true;
    group.add(ped);

    // pedestal base plate
    const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 20), woodMat);
    pedBase.position.y = 0.03;
    group.add(pedBase);

    // oval felt top (cylinder scaled in X)
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 64), feltMat);
    tableTop.scale.x = 1.5;
    tableTop.position.y = TABLE_Y;
    tableTop.castShadow = true; tableTop.receiveShadow = true;
    group.add(tableTop);

    // wooden rail (torus scaled oval)
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.1, 10, 64), railMat);
    rail.scale.x = 1.5;
    rail.rotation.x = Math.PI / 2;
    rail.position.y = TABLE_Y + 0.06;
    rail.castShadow = true;
    group.add(rail);

    // gold trim ring on rail top
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffaa33, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.2 });
    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.018, 8, 64), goldMat);
    goldRing.scale.x = 1.5;
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = TABLE_Y + 0.14;
    group.add(goldRing);

    // dealer button
    pkDealerDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.016, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xddddff, emissiveIntensity: 0.5, metalness: 0.5 })
    );
    pkDealerDisc.position.y = TABLE_Y + 0.063;
    pkDealerDisc.visible = false;
    // dealer "D" label
    const dSign = pokerSign('D', '#222255', 0.09, 0.09);
    dSign.position.y = 0.009;
    dSign.rotation.x = -Math.PI / 2;
    pkDealerDisc.add(dSign);
    group.add(pkDealerDisc);

    // pot group (center of table)
    pkPotGroup = new THREE.Group();
    pkPotGroup.position.set(0, TABLE_Y + 0.065, 0);
    group.add(pkPotGroup);

    // seat slots
    pkSeatSlots = [];
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x553300, emissiveIntensity: 0.35, roughness: 0.6 });
    SEAT_POS.forEach((sp) => {
      const slot = {};

      // seat ring on table surface
      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 32), markerMat);
      marker.rotation.x = Math.PI / 2;
      marker.position.set(sp.x, TABLE_Y + 0.055, sp.z);
      group.add(marker);

      // chip group (between seat and center)
      const chipGroup = new THREE.Group();
      chipGroup.position.set(sp.x * 0.55, TABLE_Y + 0.062, sp.z * 0.55);
      group.add(chipGroup);
      slot.chipGroup = chipGroup;

      // 5 card groups
      const sd = spreadDir(sp);
      slot.cardGroups = [];
      for (let j = 0; j < 5; j++) {
        const cg = new THREE.Group();
        const offset = (j - 2) * (CARD_W + 0.012);
        cg.position.set(
          sp.x + sd.x * offset,
          TABLE_Y + 0.062,
          sp.z + sd.z * offset
        );
        cg.visible = false;
        group.add(cg);
        slot.cardGroups.push(cg);
      }

      // name tag (canvas plane above the seat rail)
      const nc = document.createElement('canvas');
      nc.width = 256; nc.height = 64;
      const nctx = nc.getContext('2d');
      const ntex = new THREE.CanvasTexture(nc);
      const nameTag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.52, 0.13),
        new THREE.MeshBasicMaterial({ map: ntex, transparent: true, depthWrite: false })
      );
      nameTag.position.set(sp.x, TABLE_Y + 0.38, sp.z);
      nameTag.rotation.x = -Math.PI / 3;
      nameTag.visible = false;
      group.add(nameTag);
      slot.nameTag = nameTag;
      slot.nameCanvas = nc;
      slot.nameTex = ntex;
      slot.nameCtx = nctx;

      pkSeatSlots.push(slot);
    });

    // POKER sign on back wall of room (behind the table from boulevard POV)
    const sign = pokerSign('POKER', '#aa66ff', 1.6, 0.42);
    sign.position.set(0, TABLE_Y + 1.25, -1.15);
    group.add(sign);

    // subtle under-table glow
    const glow = new THREE.PointLight(0x6633ff, 0.6, 3.5);
    glow.position.set(0, 0.3, 0);
    group.add(glow);

    // in-world VR control panel (controller-clickable; faces the boulevard)
    buildPkVrPanel(group);

    pkTableGroup = group;
    if (window.gameBoards) window.gameBoards.poker = group;
    scene.add(group);
    return group;
  }

  // ---- helpers ----
  function clearGroup(g) { while (g.children.length) g.remove(g.children[0]); }

  function drawNameTag(slot, name, isMe, isTurn, folded, winner) {
    const ctx = slot.nameCtx, c = slot.nameCanvas;
    ctx.clearRect(0, 0, c.width, c.height);
    let bg;
    if (winner)       bg = 'rgba(93,255,143,0.85)';
    else if (folded)  bg = 'rgba(30,20,50,0.6)';
    else if (isTurn)  bg = 'rgba(255,210,74,0.88)';
    else if (isMe)    bg = 'rgba(170,102,255,0.72)';
    else              bg = 'rgba(10,6,20,0.75)';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(4, 4, c.width - 8, c.height - 8, 8)
                  : ctx.rect(4, 4, c.width - 8, c.height - 8);
    ctx.fill();
    ctx.fillStyle = folded ? '#777' : winner ? '#0a3a1a' : isTurn ? '#1a1006' : '#fff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = (name || 'Player').substring(0, 14) + (folded ? ' ❌' : winner ? ' 🏆' : '');
    ctx.fillText(label, c.width / 2, c.height / 2);
    slot.nameTex.needsUpdate = true;
    slot.nameTag.visible = true;
  }

  // ---- animation system (driven by main.js render loop via sceneUpdaters) ----
  const ZERO = new THREE.Vector3(0, 0, 0);
  const pkAnims = [];
  let pkAnimHooked = false;
  function ensureAnimHook() {
    if (pkAnimHooked) return;
    pkAnimHooked = true;
    (window.sceneUpdaters = window.sceneUpdaters || []).push((t, dt) => {
      for (let i = pkAnims.length - 1; i >= 0; i--) {
        const a = pkAnims[i];
        a.e += dt;
        const tt = a.e - a.delay;
        if (tt < 0) continue;
        const k = a.d > 0 ? Math.min(1, tt / a.d) : 1;
        a.tick(easeOut(k));
        if (k >= 1) pkAnims.splice(i, 1);
      }
    });
  }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function animate(o) { ensureAnimHook(); o.e = 0; o.delay = o.delay || 0; pkAnims.push(o); }

  // chip stack pops in from flat
  function popIn(group, delay) {
    group.scale.set(1, 0.01, 1);
    animate({ d: 0.22, delay: delay || 0, tick: (k) => group.scale.set(1, Math.max(0.01, k), 1) });
  }
  // card flies from table center to its seat slot, with a small arc
  function dealAnim(mesh, cg, delay) {
    const from = new THREE.Vector3(0, TABLE_Y + 0.32, 0).sub(cg.position); // center, in cg-local space
    mesh.position.copy(from);
    animate({
      d: 0.34, delay,
      tick: (k) => { mesh.position.lerpVectors(from, ZERO, k); mesh.position.y += Math.sin(k * Math.PI) * 0.12; }
    });
  }
  // card flips face-up (starts showing its back, rotates to reveal)
  function flipAnim(mesh, delay) {
    mesh.rotation.x = Math.PI;
    animate({ d: 0.4, delay, tick: (k) => { mesh.rotation.x = Math.PI * (1 - k); } });
  }

  function cardKey(s, phase) {
    if (!s) return 'X';
    if (s.folded) return 'F';
    if (phase === 'idle') return '-';
    if (phase === 'showdown' && s.hand) return 'S' + s.hand.map(c => c.r + '.' + c.s).join(',');
    return 'D';
  }

  // ---- update from game state (diff-aware so animations only fire on change) ----
  window.updatePokerTable = function (state) {
    if (!pkTableGroup) return;
    ensureAnimHook();
    const seats = state.seats || [];

    // dealer button
    if (pkDealerDisc) {
      const di = typeof state.dealerIndex === 'number' ? state.dealerIndex : -1;
      if (state.phase !== 'idle' && di >= 0 && di < seats.length && di < SEAT_POS.length) {
        const sp = SEAT_POS[di];
        pkDealerDisc.position.set(sp.x * 0.88, TABLE_Y + 0.063, sp.z * 0.88);
        pkDealerDisc.visible = true;
      } else {
        pkDealerDisc.visible = false;
      }
    }

    // pot chips — rebuild only when the amount changes; pop when it grows
    if (state.pot !== pkPotGroup._amt) {
      const grew = state.pot > (pkPotGroup._amt || 0);
      pkPotGroup._amt = state.pot;
      clearGroup(pkPotGroup);
      if (state.pot > 0) {
        const stacks = Math.min(5, Math.ceil(state.pot / 300));
        for (let i = 0; i < stacks; i++) {
          const stack = makeChipStack(state.pot / stacks, 2);
          stack.position.set((i - (stacks - 1) / 2) * 0.12, 0, 0);
          pkPotGroup.add(stack);
        }
        if (grew) popIn(pkPotGroup);
      }
    }

    // seats
    pkSeatSlots.forEach((slot, i) => {
      const s = i < seats.length ? seats[i] : null;

      // name tag
      if (!s) { slot.nameTag.visible = false; }
      else {
        const isMe = window.pokerMyId && s.id === pokerMyId();
        drawNameTag(slot, s.name, isMe, s.id === state.currentTurn, s.folded, s.winner);
      }

      // committed chips — rebuild only when the amount changes; pop when it grows
      const amt = s && !s.folded ? (s.totalCommitted || 0) : 0;
      if (amt !== slot._chipAmt) {
        const grew = amt > (slot._chipAmt || 0);
        slot._chipAmt = amt;
        clearGroup(slot.chipGroup);
        if (amt > 0) { slot.chipGroup.add(makeChipStack(amt, i)); if (grew) popIn(slot.chipGroup); }
      }

      // cards — rebuild only when the card layout changes; animate the transition
      const key = cardKey(s, state.phase);
      if (key !== slot._cardKey) {
        const prev = slot._cardKey;
        slot._cardKey = key;
        slot.cardGroups.forEach(cg => { clearGroup(cg); cg.visible = false; });
        if (key === 'D' || key[0] === 'S') {
          slot.cardGroups.forEach((cg, j) => {
            const card = key[0] === 'S' ? (s.hand && s.hand[j]) : null;
            if (key[0] === 'S' && !card) return;
            const mesh = makeCardMesh(card);
            cg.add(mesh); cg.visible = true;
            if (key === 'D' && prev === '-') dealAnim(mesh, cg, i * 0.09 + j * 0.05);
            else if (key[0] === 'S' && prev === 'D') flipAnim(mesh, i * 0.1);
          });
        }
      }
    });
  };

  // ============================ in-world VR control panel ============================
  // A controller-clickable 3D panel at the table that mirrors the DOM poker UI:
  // Sit/Deal/Leave, the betting actions (Fold/Check/Call/Bet/Raise/All-in), and a
  // pointable hand (tap cards to keep) + Draw. Driven by window.onPokerUiChange.

  let pkVr = null;
  const pkVrButtons = [];   // poker meshes currently registered in window.vrInteractables

  function vrArr() { return (window.vrInteractables = window.vrInteractables || []); }

  function disposeObj(o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    (o.children || []).slice().forEach(disposeObj);
  }
  function disposeChildren(group) { group.children.slice().forEach(c => { disposeObj(c); group.remove(c); }); }

  function clearPkVrButtons() {
    const arr = vrArr();
    pkVrButtons.forEach(b => { const i = arr.indexOf(b); if (i >= 0) arr.splice(i, 1); });
    pkVrButtons.length = 0;
  }

  function roundRectPath(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py); x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py); x.closePath();
  }

  function pkBtnTex(label, accent) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 110;
    const x = c.getContext('2d'); x.clearRect(0, 0, 256, 110);
    roundRectPath(x, 5, 5, 246, 100, 18);
    x.fillStyle = 'rgba(18,12,30,0.96)'; x.fill();
    x.lineWidth = 6; x.strokeStyle = accent; x.shadowColor = accent; x.shadowBlur = 12; x.stroke(); x.shadowBlur = 0;
    x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(label, 128, 57);
    const tex = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function pkLblTex(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 72;
    const x = c.getContext('2d'); x.clearRect(0, 0, 512, 72);
    roundRectPath(x, 2, 2, 508, 68, 14);
    x.fillStyle = 'rgba(8,5,18,0.82)'; x.fill();
    x.fillStyle = '#c9a3ff'; x.font = 'bold 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text || '', 256, 38);
    const tex = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function pkVrLabel(w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: pkLblTex(''), transparent: true }));
    m.userData.setText = (t) => { m.material.map.dispose(); m.material.map = pkLblTex(t); m.material.needsUpdate = true; };
    return m;
  }

  // a clickable button added to a parent group AND to window.vrInteractables
  function pkVrBtn(parent, label, x, y, w, h, accent, onSelect) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: pkBtnTex(label, accent), transparent: true }));
    mesh.position.set(x, y, 0.001);
    mesh.userData.onSelect = onSelect;
    mesh.userData.vrButton = true;
    parent.add(mesh);
    vrArr().push(mesh); pkVrButtons.push(mesh);
    return mesh;
  }

  // a standing card for the panel hand (face plane + optional gold "held" backing)
  function makePanelCard(card, held) {
    const g = new THREE.Group();
    if (held) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.185), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
      b.position.z = -0.001; g.add(b);
    }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.165), new THREE.MeshBasicMaterial({ map: cardFaceTex(card), transparent: true }));
    g.add(face);
    g.userData.face = face;
    return g;
  }

  function buildPkVrPanel(parent) {
    const panel = new THREE.Group();
    panel.position.set(0, 1.25, 1.18);    // just past the near edge, facing the boulevard (+z local)
    parent.add(panel);

    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.98), new THREE.MeshBasicMaterial({ color: 0x0a0614, transparent: true, opacity: 0.72 }));
    panel.add(back);

    const title = pokerSign('POKER', '#c9a3ff', 0.7, 0.18);
    title.position.set(0, 0.40, 0.002); panel.add(title);

    const infoLabel = pkVrLabel(1.28, 0.16);
    infoLabel.position.set(0, 0.24, 0.003); panel.add(infoLabel);

    const handGroup = new THREE.Group(); handGroup.position.set(0, 0.05, 0.004); panel.add(handGroup);
    const actionGroup = new THREE.Group(); actionGroup.position.set(0, 0, 0.004); panel.add(actionGroup);

    pkVr = { panel, infoLabel, handGroup, actionGroup };
  }

  // lay out a centered row of buttons
  function pkVrRow(defs, y) {
    const w = 0.3, gap = 0.022, h = 0.13;
    const total = defs.length * w + (defs.length - 1) * gap;
    defs.forEach((d, i) => {
      const x = -total / 2 + w / 2 + i * (w + gap);
      pkVrBtn(pkVr.actionGroup, d.label, x, y, w, h, d.accent || '#aa66ff', d.fn);
    });
  }

  function pkVrShowHand(interactive) {
    const hand = window.pokerHand && pokerHand();
    const holds = window.pokerHolds && pokerHolds();
    if (!hand) return;
    const cw = 0.13, gap = 0.012;
    const total = hand.length * cw + (hand.length - 1) * gap;
    hand.forEach((c, i) => {
      const x = -total / 2 + cw / 2 + i * (cw + gap);
      const held = holds ? holds[i] : true;
      const card = makePanelCard(c, interactive ? held : false);
      card.position.set(x, 0, 0);
      pkVr.handGroup.add(card);
      if (interactive) {
        const face = card.userData.face;
        face.userData.onSelect = (idx => () => { if (window.pkToggleHold) pkToggleHold(idx); })(i);
        face.userData.vrButton = true;
        vrArr().push(face); pkVrButtons.push(face);
      }
    });
  }

  function updatePkVrPanel(state) {
    if (!pkVr) return;
    state = state || { phase: 'idle', pot: 0, seats: [] };
    clearPkVrButtons();
    disposeChildren(pkVr.actionGroup);
    disposeChildren(pkVr.handGroup);

    const me = window.pokerMyId && pokerMyId();
    const STAKE = (window.pokerStake && pokerStake()) || 50;
    const seats = state.seats || [];
    const mySeat = seats.find(s => s.id === me);
    const myBal = Math.floor((window.currentPlayer && window.currentPlayer.balance) || 0);

    let info = `POT P$ ${state.pot || 0}`;
    if (state.phase && state.phase !== 'idle') info += `  ·  ${String(state.phase).toUpperCase()}`;
    if (state.toCall) info += `  ·  CALL ${state.toCall}`;

    if (!mySeat) {
      pkVrRow([{ label: `SIT (${STAKE})`, accent: '#aa66ff', fn: () => window.pkSit && pkSit() }], -0.18);
    } else if (state.phase === 'idle') {
      const defs = [];
      if (seats.length >= 2) defs.push({ label: 'DEAL', accent: '#33cc66', fn: () => window.pkStart && pkStart() });
      else info += '   waiting for players…';
      defs.push({ label: 'LEAVE', accent: '#ff5555', fn: () => window.pkLeave && pkLeave() });
      pkVrRow(defs, -0.18);
    } else if (state.phase === 'bet1' || state.phase === 'bet2') {
      pkVrShowHand(false);
      if (state.currentTurn === me && !mySeat.folded) {
        const callCost = Math.max(0, (state.toCall || 0) - (mySeat.committedRound || 0));
        const defs = [{ label: 'FOLD', accent: '#ff3355', fn: () => pkAct('fold') }];
        if ((state.toCall || 0) === 0) {
          defs.push({ label: 'CHECK', accent: '#777', fn: () => pkAct('check') });
          if (STAKE <= myBal) defs.push({ label: `BET ${STAKE}`, accent: '#cc8800', fn: () => pkAct('bet') });
        } else {
          if (callCost > 0 && callCost <= myBal) defs.push({ label: `CALL ${callCost}`, accent: '#117711', fn: () => pkAct('call') });
          if (state.raises < state.maxRaises && callCost + STAKE <= myBal) defs.push({ label: `RAISE ${STAKE}`, accent: '#cc8800', fn: () => pkAct('raise') });
        }
        if (myBal > 0) defs.push({ label: 'ALL-IN', accent: '#cc33ff', fn: () => pkAct('allin', myBal) });
        pkVrRow(defs, -0.30);
      } else {
        const t = seats.find(s => s.id === state.currentTurn);
        info += `   waiting: ${t ? (t.name || '') : '…'}`;
      }
    } else if (state.phase === 'draw') {
      if (!(mySeat && mySeat.folded)) {
        pkVrShowHand(true);
        pkVrRow([{ label: 'DRAW / STAND', accent: '#ffd24a', fn: () => window.pkDraw && pkDraw() }], -0.30);
      } else {
        info += '   folded — waiting…';
      }
    } else if (state.phase === 'showdown') {
      info += (mySeat && mySeat.winner) ? '   🏆 YOU WON' : '   showdown';
    }

    pkVr.infoLabel.userData.setText(info);
  }

  window.onPokerUiChange = function (view) { updatePkVrPanel(view); };

  window.createPokerBoard = createPokerBoard;

})();
