// Info boards: Leaderboard, Room ID, Host Line — placed in the lobby area.

const INFO_BOARD = {
  W: 2.4, H: 3.2,   // world metres
  CW: 512, CH: 682,  // canvas pixels
};

function _ibCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

function _ibBg(ctx, W, H, borderCol) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6,3,16,0.96)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 6, W - 12, H - 12, 22); else ctx.rect(6, 6, W - 12, H - 12);
  ctx.fill();
  ctx.strokeStyle = borderCol; ctx.lineWidth = 6;
  ctx.shadowColor = borderCol; ctx.shadowBlur = 20;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 6, W - 12, H - 12, 22); else ctx.rect(6, 6, W - 12, H - 12);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function _ibMesh(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(INFO_BOARD.W, INFO_BOARD.H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  mesh._tex = tex;
  return mesh;
}

function _ibFrame(color, scene, x, y, z) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.7 });
  const W = INFO_BOARD.W + 0.08, H = INFO_BOARD.H + 0.08;
  // top/bottom bars
  [[0, H/2],[0, -H/2]].forEach(([ox, oy]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.05, 0.04), mat);
    m.position.set(x + ox, y + oy, z - 0.02); scene.add(m);
  });
  // side bars
  [[-W/2, 0],[W/2, 0]].forEach(([ox, oy]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, H + 0.06, 0.04), mat);
    m.position.set(x + ox, y + oy, z - 0.02); scene.add(m);
  });
  // post behind
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, H + 0.5, 0.06), mat);
  post.position.set(x, y, z - 0.05); scene.add(post);
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

function _drawLeaderboard(ctx, data) {
  const W = INFO_BOARD.CW, H = INFO_BOARD.CH;
  _ibBg(ctx, W, H, '#ffd700');

  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
  ctx.fillText('🏆 LEADERBOARD', W/2, 54); ctx.shadowBlur = 0;

  const rows = (data || []).slice(0, 8);
  if (!rows.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '28px Arial';
    ctx.fillText('Loading…', W/2, H/2); return;
  }
  const top3 = ['#ffd700', '#c0c0c0', '#cd7f32'];
  rows.forEach((p, i) => {
    const y = 110 + i * 72;
    // row bg
    ctx.fillStyle = i < 3 ? `rgba(255,255,255,0.07)` : 'rgba(255,255,255,0.03)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(18, y - 28, W - 36, 58, 8); ctx.fill(); }
    else { ctx.fillRect(18, y - 28, W - 36, 58); }
    // rank
    ctx.fillStyle = top3[i] || 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${i < 3 ? 30 : 24}px Arial`; ctx.textAlign = 'left';
    ctx.fillText(`#${i+1}`, 30, y + 10);
    // name
    ctx.fillStyle = '#fff'; ctx.font = `${i < 3 ? 'bold ' : ''}26px Arial`;
    ctx.fillText(p.username || '?', 80, y + 10);
    // balance
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'right';
    ctx.fillText('P$' + Math.floor(p.balance || 0).toLocaleString(), W - 26, y + 10);
  });
}

// ── Room ID ───────────────────────────────────────────────────────────────────

function _drawRoomId(ctx) {
  const W = INFO_BOARD.CW, H = INFO_BOARD.CH;
  _ibBg(ctx, W, H, '#33ccff');

  ctx.fillStyle = '#33ccff'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
  ctx.shadowColor = '#33ccff'; ctx.shadowBlur = 12;
  ctx.fillText('ROOM', W/2, 60); ctx.shadowBlur = 0;

  const mp = window.MP || {};
  const roomName = mp.roomIndex != null ? 'a' + mp.roomIndex : '—';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 88px Arial';
  ctx.fillText(roomName, W/2, 200);

  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '26px Arial';
  ctx.fillText(mp.isHost ? '👑 You are host' : 'Connected', W/2, 270);

  // player count
  const count = (mp.roster && mp.roster.length) || 0;
  const max = 8;
  ctx.fillStyle = '#33ccff'; ctx.font = 'bold 36px Arial';
  ctx.fillText(`${count} / ${max} players`, W/2, 350);

  // dot row
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < count ? '#33ccff' : 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(W/2 - (max/2 - 0.5 - i) * 48, 420, 16, 0, Math.PI*2); ctx.fill();
  }

  // share tip
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '20px Arial';
  ctx.fillText('share room code to invite friends', W/2, H - 36);
}

// ── Host Line ─────────────────────────────────────────────────────────────────

function _drawHostLine(ctx) {
  const W = INFO_BOARD.CW, H = INFO_BOARD.CH;
  _ibBg(ctx, W, H, '#cc44ff');

  ctx.fillStyle = '#cc44ff'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
  ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 12;
  ctx.fillText('HOST LINE', W/2, 58); ctx.shadowBlur = 0;

  const mp = window.MP || {};
  const roster = (mp.roster || []);
  const host = roster[0];
  const queue = roster.slice(1);

  // current host block
  ctx.fillStyle = 'rgba(204,68,255,0.12)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(18, 82, W-36, 110, 14); ctx.fill(); }
  else { ctx.fillRect(18, 82, W-36, 110); }

  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left';
  ctx.fillText('👑  CURRENT HOST', 36, 114);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Arial';
  ctx.fillText(host ? host.name : '—', 36, 162);

  // divider
  ctx.strokeStyle = 'rgba(204,68,255,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, 210); ctx.lineTo(W - 18, 210); ctx.stroke();

  // queue
  ctx.fillStyle = '#cc44ff'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'left';
  ctx.fillText('UP NEXT', 36, 252);

  if (!queue.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
    ctx.fillText('no queue', W/2, 320);
  } else {
    queue.slice(0, 5).forEach((p, i) => {
      const y = 290 + i * 70;
      ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(18, y - 26, W - 36, 54, 8); ctx.fill(); }
      else { ctx.fillRect(18, y - 26, W - 36, 54); }

      ctx.fillStyle = 'rgba(204,68,255,0.8)'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left';
      ctx.fillText(`${i+1}.`, 30, y + 10);
      ctx.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.font = `${i===0?'bold ':' '}26px Arial`;
      ctx.fillText(p.name || '?', 60, y + 10);

      if (i === 0) {
        ctx.fillStyle = '#33ccff'; ctx.font = '18px Arial'; ctx.textAlign = 'right';
        ctx.fillText('next up', W - 26, y + 10);
      }
    });
  }

  // self indicator
  const myName = (window.currentPlayer && window.currentPlayer.username) || window.currentUsername || '';
  const myPos = roster.findIndex(p => p.name === myName);
  if (myPos >= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText(myPos === 0 ? '▲ You are hosting' : `▲ You are #${myPos+1} in line`, W/2, H - 36);
  }
}

// ── Public: buildInfoBoards ───────────────────────────────────────────────────

window.buildInfoBoards = function(scene) {
  // Place 3 boards along the north wall of the lobby boulevard, facing south.
  // Y centre = 2.0m (eye level), boards are 3.2m tall.
  const boards = [
    { x: -54, label: 'leaderboard', color: 0xffd700, draw: (ctx) => _drawLeaderboard(ctx, window._lbCache) },
    { x: -47, label: 'roomid',      color: 0x33ccff, draw: _drawRoomId },
    { x: -40, label: 'hostline',    color: 0xcc44ff, draw: _drawHostLine },
  ];

  const meshes = {};
  boards.forEach(({ x, label, color, draw }) => {
    const y = 2.0, z = -5.5;

    _ibFrame(color, scene, x, y, z);

    const canvas = _ibCanvas(INFO_BOARD.CW, INFO_BOARD.CH);
    const ctx = canvas.getContext('2d');
    draw(ctx);
    const mesh = _ibMesh(canvas);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    meshes[label] = { mesh, ctx, canvas, draw };
  });

  // Refresh all boards every 5 seconds
  setInterval(() => {
    Object.values(meshes).forEach(({ mesh, ctx, draw }) => {
      draw(ctx);
      mesh._tex.needsUpdate = true;
    });
  }, 5000);

  // Pull leaderboard data every 30s
  async function fetchLb() {
    if (window.sbFetchLeaderboard) {
      window._lbCache = await sbFetchLeaderboard('balance', 8);
      const lb = meshes['leaderboard'];
      if (lb) { _drawLeaderboard(lb.ctx, window._lbCache); lb.mesh._tex.needsUpdate = true; }
    }
  }
  fetchLb();
  setInterval(fetchLb, 30000);

  window._infoBoardMeshes = meshes;
};
