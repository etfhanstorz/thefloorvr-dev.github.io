// In-world VR game panels: polished clickable 3D buttons + live result text, so
// games are playable with the controller laser. main.js raycasts
// window.vrInteractables on trigger and runs the hit mesh's userData.onSelect().

window.vrInteractables = [];
const vrBet = { plinko: 100, wheel: 100, blackjack: 100 };
const vrResultLabels = {};
const vrBetLabels = {};
let vrPanelsBuilt = false;

function roundRect(x, ctx, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
}

// styled button/label texture. kind: 'button' | 'label' | 'title'
function vrTexture(text, accent, kind) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 160;
  const x = c.getContext('2d');
  const W = 320, H = 160, pad = 8;
  x.clearRect(0, 0, W, H);

  if (kind === 'title') {
    x.fillStyle = accent; x.font = 'bold 54px Arial';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = accent; x.shadowBlur = 16;
    x.fillText(text, W / 2, H / 2);
    return finishTex(c);
  }

  // panel/button background
  roundRect(pad, x, W - pad * 2, H - pad * 2, 22);
  x.translate(pad, pad);
  roundRect(0, x, W - pad * 2, H - pad * 2, 22);
  x.fillStyle = kind === 'button' ? 'rgba(20,16,34,0.96)' : 'rgba(8,5,18,0.92)';
  x.fill();
  x.lineWidth = 6; x.strokeStyle = accent;
  x.shadowColor = accent; x.shadowBlur = kind === 'button' ? 14 : 6;
  x.stroke();
  x.shadowBlur = 0;

  // text (wrap to 2 lines if needed)
  x.fillStyle = '#ffffff';
  x.font = `bold ${kind === 'button' ? 44 : 38}px Arial`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const cw = W - pad * 2, ch = H - pad * 2;
  const words = String(text).split(' ');
  if (words.length > 2 && String(text).length > 12) {
    const mid = Math.ceil(words.length / 2);
    x.fillText(words.slice(0, mid).join(' '), cw / 2, ch / 2 - 24);
    x.fillText(words.slice(mid).join(' '), cw / 2, ch / 2 + 24);
  } else {
    x.fillText(text, cw / 2, ch / 2);
  }
  return finishTex(c);
}

function finishTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function vrButton(label, w, h, accent, onSelect) {
  const mat = new THREE.MeshBasicMaterial({ map: vrTexture(label, accent, 'button'), transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.onSelect = onSelect;
  mesh.userData.vrButton = true;
  window.vrInteractables.push(mesh);
  return mesh;
}

function vrLabel(text, w, h, accent) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: vrTexture(text, accent || '#5fd0ff', 'label'), transparent: true }));
  mesh.userData.setText = (t, a) => {
    mesh.material.map.dispose();
    mesh.material.map = vrTexture(t, a || accent || '#5fd0ff', 'label');
    mesh.material.needsUpdate = true;
  };
  return mesh;
}

function vrTitle(text, w, h, accent) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: vrTexture(text, accent, 'title'), transparent: true }));
}

function buildPanel(scene, game, boardPos, actionLabel, accent, onAction) {
  const panel = new THREE.Group();
  // sit in front of the machine at a comfortable interaction height, facing player
  panel.position.set(boardPos.x, 1.35, boardPos.z + 0.75);
  scene.add(panel);

  // backing board
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.15),
    new THREE.MeshBasicMaterial({ color: 0x0a0614, transparent: true, opacity: 0.55 })
  );
  back.position.z = -0.01;
  panel.add(back);

  // title
  const title = vrTitle(game.toUpperCase(), 0.9, 0.22, accent);
  title.position.set(0, 0.45, 0);
  panel.add(title);

  // bet buttons
  const bets = [50, 100, 500];
  bets.forEach((amt, i) => {
    const b = vrButton('P$' + amt, 0.32, 0.16, '#33cc88', () => {
      vrBet[game] = amt;
      if (vrBetLabels[game]) vrBetLabels[game].userData.setText('Bet: P$ ' + amt, '#ffd24a');
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('click');
    });
    b.position.set((i - 1) * 0.36, 0.2, 0);
    panel.add(b);
  });

  // current bet
  const betLabel = vrLabel('Bet: P$ ' + vrBet[game], 0.7, 0.14, '#ffd24a');
  betLabel.position.set(0, 0.0, 0);
  vrBetLabels[game] = betLabel;
  panel.add(betLabel);

  // action button
  const action = vrButton(actionLabel, 0.6, 0.2, accent, onAction);
  action.position.set(0, -0.21, 0);
  panel.add(action);

  // result readout
  const result = vrLabel('Ready', 0.95, 0.16, '#9fe');
  result.position.set(0, -0.45, 0);
  vrResultLabels[game] = result;
  panel.add(result);

  return panel;
}

function buildVRGamePanels(scene) {
  if (vrPanelsBuilt) return;
  if (typeof gameBoards === 'undefined') return;
  vrPanelsBuilt = true;

  if (gameBoards.plinko) {
    buildPanel(scene, 'plinko', gameBoards.plinko.position, 'PLAY', '#33ccff', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('plinko_drop');
      socket.emit('plinko_play', { betAmount: vrBet.plinko });
    });
  }
  if (gameBoards.wheel) {
    buildPanel(scene, 'wheel', gameBoards.wheel.position, 'SPIN', '#ff33aa', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('wheel_spin');
      socket.emit('wheel_spin', { baseAmount: vrBet.wheel });
    });
  }
  if (gameBoards.blackjack) {
    buildPanel(scene, 'blackjack', gameBoards.blackjack.position, 'DEAL', '#ffd24a', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('blackjack_deal');
      socket.emit('blackjack_bet', { amount: vrBet.blackjack });
    });
  }

  hookResults();
}

// chain onto the existing result callbacks so the in-world readouts update too
function hookResults() {
  const prevPlinko = window.onPlinkoResult;
  window.onPlinkoResult = (r) => {
    if (prevPlinko) prevPlinko(r);
    if (vrResultLabels.plinko && r && r.success) {
      vrResultLabels.plinko.userData.setText(`${r.multiplier}x  P$ ${r.payout}${r.crit ? '  CRIT!' : ''}`, r.multiplier > 1 ? '#6f6' : '#f99');
    }
  };
  const prevWheel = window.onWheelResult;
  window.onWheelResult = (r) => {
    if (prevWheel) prevWheel(r);
    if (vrResultLabels.wheel && r && r.success) {
      vrResultLabels.wheel.userData.setText(`${r.multiplier}x  P$ ${r.payout}${r.crit ? '  CRIT!' : ''}`, r.multiplier > 1 ? '#6f6' : '#f99');
    }
  };
  const prevBj = window.onBlackjackStateUpdate;
  window.onBlackjackStateUpdate = (state) => {
    if (prevBj) prevBj(state);
    if (vrResultLabels.blackjack && state && state.status === 'results') {
      const p = state.players && state.players[0];
      if (p) vrResultLabels.blackjack.userData.setText(`${p.result === 'win' ? 'WIN' : 'LOSS'}  P$ ${p.payout}${p.crit ? '  CRIT!' : ''}`, p.result === 'win' ? '#6f6' : '#f99');
    }
  };
}

window.buildVRGamePanels = buildVRGamePanels;
