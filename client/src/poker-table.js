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

  // ---- update from game state ----
  window.updatePokerTable = function (state) {
    if (!pkTableGroup) return;
    const seats = state.seats || [];

    // dealer button
    if (pkDealerDisc) {
      const di = typeof state.dealerIndex === 'number' ? state.dealerIndex : -1;
      if (di >= 0 && di < seats.length && di < SEAT_POS.length) {
        const sp = SEAT_POS[di];
        // place dealer button clockwise-adjacent from seat, between seat and next
        pkDealerDisc.position.set(sp.x * 0.88, TABLE_Y + 0.063, sp.z * 0.88);
        pkDealerDisc.visible = true;
      } else {
        pkDealerDisc.visible = false;
      }
    }

    // pot chips
    clearGroup(pkPotGroup);
    if (state.pot > 0) {
      const stacks = Math.min(5, Math.ceil(state.pot / 300));
      for (let i = 0; i < stacks; i++) {
        const stack = makeChipStack(state.pot / stacks, 2);
        stack.position.set((i - (stacks - 1) / 2) * 0.12, 0, 0);
        pkPotGroup.add(stack);
      }
    }

    // seats
    pkSeatSlots.forEach((slot, i) => {
      clearGroup(slot.chipGroup);
      slot.cardGroups.forEach(cg => { clearGroup(cg); cg.visible = false; });

      if (i >= seats.length) {
        slot.nameTag.visible = false;
        return;
      }

      const s = seats[i];
      const isMe = window.pokerMyId && s.id === pokerMyId();
      const isTurn = s.id === state.currentTurn;

      drawNameTag(slot, s.name, isMe, isTurn, s.folded, s.winner);

      // committed chips
      if (s.totalCommitted > 0 && !s.folded) {
        const stack = makeChipStack(s.totalCommitted, i);
        slot.chipGroup.add(stack);
      }

      // cards
      if (state.phase !== 'idle') {
        slot.cardGroups.forEach((cg, j) => {
          if (s.folded) return;
          let mesh;
          if (state.phase === 'showdown' && s.hand && s.hand[j]) {
            mesh = makeCardMesh(s.hand[j]);      // face up
          } else {
            mesh = makeCardMesh(null);            // face down
          }
          cg.add(mesh);
          cg.visible = true;
        });
      }
    });
  };

  window.createPokerBoard = createPokerBoard;

})();
