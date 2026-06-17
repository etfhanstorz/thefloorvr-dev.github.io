// In-world VR game panels: clickable 3D buttons + live result text, so games
// are playable with the controller laser (no flat DOM overlays in VR).
//
// main.js raycasts window.vrInteractables on trigger; each hit mesh runs its
// userData.onSelect(). buildVRGamePanels() is called once when VR starts.

window.vrInteractables = [];
const vrBet = { plinko: 100, wheel: 100, blackjack: 100 };
const vrResultLabels = {};
const vrBetLabels = {};
let vrPanelsBuilt = false;

function vrMakeTextTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
  x.fillStyle = fg;
  x.font = 'bold 40px Arial';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  // wrap to 2 lines if long
  const words = String(text).split(' ');
  if (words.length > 2 && text.length > 12) {
    const mid = Math.ceil(words.length / 2);
    x.fillText(words.slice(0, mid).join(' '), 128, 48);
    x.fillText(words.slice(mid).join(' '), 128, 88);
  } else {
    x.fillText(text, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function vrButton(label, w, h, color, onSelect) {
  const tex = vrMakeTextTexture(label, color, '#ffffff');
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.onSelect = onSelect;
  mesh.userData.vrButton = true;
  window.vrInteractables.push(mesh);
  return mesh;
}

function vrLabel(text, w, h) {
  const tex = vrMakeTextTexture(text, '#0a0614', '#9fe');
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.userData.setText = (t, fg) => {
    mesh.material.map.dispose();
    mesh.material.map = vrMakeTextTexture(t, '#0a0614', fg || '#9fe');
    mesh.material.needsUpdate = true;
  };
  return mesh;
}

// build a panel of bet buttons + an action button + a result label for a game
function buildPanel(scene, game, boardPos, actionLabel, actionColor, onAction) {
  const panel = new THREE.Group();
  panel.position.set(boardPos.x, 2.3, boardPos.z + 0.5); // float above/in front of stand
  scene.add(panel);

  // title
  const title = vrLabel(game.toUpperCase(), 0.8, 0.18);
  title.position.set(0, 0.55, 0);
  title.userData.setText(game.toUpperCase(), '#ffd24a');
  panel.add(title);

  // bet buttons
  const bets = [50, 100, 500];
  bets.forEach((amt, i) => {
    const b = vrButton('P$ ' + amt, 0.26, 0.13, '#225522', () => {
      vrBet[game] = amt;
      if (vrBetLabels[game]) vrBetLabels[game].userData.setText('Bet: P$ ' + amt, '#ffd24a');
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('click');
    });
    b.position.set((i - 1) * 0.3, 0.2, 0);
    panel.add(b);
  });

  // current-bet label
  const betLabel = vrLabel('Bet: P$ ' + vrBet[game], 0.6, 0.12);
  betLabel.position.set(0, 0.04, 0);
  vrBetLabels[game] = betLabel;
  panel.add(betLabel);

  // action button (Play / Spin / Deal)
  const action = vrButton(actionLabel, 0.5, 0.18, actionColor, onAction);
  action.position.set(0, -0.16, 0);
  panel.add(action);

  // result label
  const result = vrLabel('Ready', 0.85, 0.16);
  result.position.set(0, -0.4, 0);
  vrResultLabels[game] = result;
  panel.add(result);

  return panel;
}

function buildVRGamePanels(scene) {
  if (vrPanelsBuilt) return;
  if (typeof gameBoards === 'undefined') return;
  vrPanelsBuilt = true;

  if (gameBoards.plinko) {
    buildPanel(scene, 'plinko', gameBoards.plinko.position, 'PLAY', '#117711', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('plinko_drop');
      socket.emit('plinko_play', { betAmount: vrBet.plinko });
    });
  }
  if (gameBoards.wheel) {
    buildPanel(scene, 'wheel', gameBoards.wheel.position, 'SPIN', '#aa6600', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('wheel_spin');
      socket.emit('wheel_spin', { baseAmount: vrBet.wheel });
    });
  }
  if (gameBoards.blackjack) {
    buildPanel(scene, 'blackjack', gameBoards.blackjack.position, 'DEAL', '#117711', () => {
      if (window.playSoundIfNotMuted) playSoundIfNotMuted('blackjack_deal');
      socket.emit('blackjack_bet', { amount: vrBet.blackjack });
    });
  }

  hookResults();
}

// chain onto the existing DOM result callbacks so VR labels update too
function hookResults() {
  const prevPlinko = window.onPlinkoResult;
  window.onPlinkoResult = (r) => {
    if (prevPlinko) prevPlinko(r);
    if (vrResultLabels.plinko && r && r.success) {
      const win = r.multiplier > 1;
      vrResultLabels.plinko.userData.setText(`${r.multiplier}x  P$ ${r.payout}${r.crit ? ' CRIT!' : ''}`, win ? '#6f6' : '#f99');
    }
  };

  const prevWheel = window.onWheelResult;
  window.onWheelResult = (r) => {
    if (prevWheel) prevWheel(r);
    if (vrResultLabels.wheel && r && r.success) {
      const win = r.multiplier > 1;
      vrResultLabels.wheel.userData.setText(`${r.multiplier}x  P$ ${r.payout}${r.crit ? ' CRIT!' : ''}`, win ? '#6f6' : '#f99');
    }
  };

  const prevBj = window.onBlackjackStateUpdate;
  window.onBlackjackStateUpdate = (state) => {
    if (prevBj) prevBj(state);
    if (vrResultLabels.blackjack && state && state.status === 'results') {
      const p = state.players && state.players[0];
      if (p) {
        const win = p.result === 'win';
        vrResultLabels.blackjack.userData.setText(`${win ? 'WIN' : 'LOSS'}  P$ ${p.payout}${p.crit ? ' CRIT!' : ''}`, win ? '#6f6' : '#f99');
      }
    }
  };
}

window.buildVRGamePanels = buildVRGamePanels;
