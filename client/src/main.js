// Main game initialization + movement (desktop first-person & VR locomotion)
let scene, camera, renderer, localAvatar;
let playerRig;                 // holds the camera; moving it moves the player (needed for VR)
let keys = {};
let xrSession = null;
let isVR = false;
let moveUpdateTimer = 0;
let xrRefSpace = null;
let controllerLeft = null, controllerRight = null;

// look/movement state
let yaw = -Math.PI / 2, pitch = 0;  // start facing east down the boulevard
let pointerLocked = false;
let lastFrameTime = 0;
let snapTurnArmed = true;      // debounce for VR snap turn
let thirdPerson = false;       // desktop camera mode (C to toggle)
const TP_DIST = 4.0, TP_HEIGHT = 1.2;

const WALK_SPEED = 4.0;        // metres / second
const SPRINT_SPEED = 8.0;
const EYE_HEIGHT = 1.7;
const BOUND = 72;              // X extent (boulevard length)
const BOUND_Z = 28;           // Z extent (room depth)
const SNAP_TURN_RAD = 30 * Math.PI / 180;

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0614);
  scene.fog = new THREE.Fog(0x0a0614, 45, 150);

  // Camera inside a movable rig (rig moves the player; headset drives camera in VR)
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, EYE_HEIGHT, 0);

  playerRig = new THREE.Group();
  playerRig.position.set(-50, 0, 0); // spawn in the lobby (west end)
  playerRig.add(camera);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, xrCompatible: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  createCasinoFloor(scene);
  scene.add(playerRig);
  buildGameStations();
  if (window.buildDecor) buildDecor(scene);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // third-person is a dev-only PC tool (keyboard, non-VR, .devtest accounts)
    if (e.key.toLowerCase() === 'c' && !e.repeat && !isVR && isDevAccount()) {
      thirdPerson = !thirdPerson;
    }
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  setupMouseLook();
  buildHUD();

  // VR button
  const vrButton = document.createElement('button');
  vrButton.id = 'vrButton';
  vrButton.innerHTML = 'Enter VR';
  vrButton.style.cssText = 'position: absolute; bottom: 20px; right: 20px; padding: 10px 20px; background: #ff6600; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 210; font-size: 16px;';
  document.body.appendChild(vrButton);

  // Game buttons (exit pointer lock so the overlay is clickable)
  const gameButtonsDiv = document.createElement('div');
  gameButtonsDiv.style.cssText = 'position: absolute; bottom: 60px; right: 20px; display: flex; flex-direction: column; gap: 5px; z-index: 100;';
  const mkBtn = (label, bg, fg, fn) => {
    const b = document.createElement('button');
    b.innerHTML = label;
    b.style.cssText = `padding: 10px 15px; background: ${bg}; color: ${fg}; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;`;
    b.addEventListener('click', () => { if (document.exitPointerLock) document.exitPointerLock(); fn(); });
    gameButtonsDiv.appendChild(b);
  };
  mkBtn('♠️ Blackjack', '#00aa00', 'white', showBlackjack);
  mkBtn('🃏 Poker', '#aa66ff', 'white', showPoker);
  mkBtn('🎯 Plinko', '#00ff00', 'black', showPlinko);
  mkBtn('🎡 Wheel', '#ffff00', 'black', showWheel);
  mkBtn('🛍️ Shop', '#ff6600', 'white', showShop);
  document.body.appendChild(gameButtonsDiv);

  vrButton.addEventListener('click', async () => {
    if (!isVR && navigator.xr) {
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hand-tracking', 'dom-overlay'],
          domOverlay: { root: document.body }
        });
        xrSession = session;
        isVR = true;
        vrButton.innerHTML = 'Exit VR';
        enforcePcGate(); // in VR now -> always allowed
        xrRefSpace = await session.requestReferenceSpace('local-floor');

        // Tracked controllers + laser pointers (stations/panels already built at startup)
        setupVRControllers();

        session.addEventListener('end', () => { isVR = false; vrButton.innerHTML = 'Enter VR'; enforcePcGate(); });
        renderer.xr.setSession(session);
      } catch (e) {
        console.error('VR not available:', e);
        alert('WebXR not supported or permission denied');
      }
    } else if (isVR && xrSession) {
      await xrSession.end();
    }
  });

  if (!navigator.xr) {
    vrButton.disabled = true;
    vrButton.innerHTML = 'VR Not Supported';
  }

  renderer.setAnimationLoop(animate);
}

// ---------- desktop mouse-look ----------

function setupMouseLook() {
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => {
    if (!isVR && !pointerLocked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = (document.pointerLockElement === canvas);
  });
  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked || isVR) return;
    const sens = 0.0022;
    yaw -= e.movementX * sens;
    pitch -= e.movementY * sens;
    const lim = Math.PI / 2 - 0.05;
    pitch = Math.max(-lim, Math.min(lim, pitch));
  });
}

// ---------- HUD / QoL ----------

function buildHUD() {
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.style.cssText = 'position:absolute; top:20px; right:20px; z-index:60; font-family:monospace; text-align:right; pointer-events:none;';
  hud.innerHTML = `
    <div id="balanceHud" style="background:rgba(0,0,0,0.7); color:#ffd700; padding:8px 14px; border-radius:8px; font-size:20px; font-weight:bold;">P$ 0</div>
    <div id="roomHud" style="background:rgba(0,0,0,0.5); color:#9fe; padding:4px 10px; border-radius:6px; font-size:12px; margin-top:6px;">solo</div>
  `;
  document.body.appendChild(hud);

  const crosshair = document.createElement('div');
  crosshair.id = 'crosshair';
  crosshair.style.cssText = 'position:absolute; top:50%; left:50%; width:6px; height:6px; margin:-3px 0 0 -3px; background:rgba(255,255,255,0.6); border-radius:50%; z-index:55; pointer-events:none;';
  document.body.appendChild(crosshair);

  // toast notifications (replace alert(); visible in VR via dom-overlay)
  const toasts = document.createElement('div');
  toasts.id = 'toasts';
  toasts.style.cssText = 'position:absolute; top:70px; left:50%; transform:translateX(-50%); z-index:65; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; font-family:Segoe UI, Arial, sans-serif;';
  document.body.appendChild(toasts);

  // floating balance-change number anchored under the balance HUD
  const fl = document.createElement('div');
  fl.id = 'balanceFloat';
  fl.style.cssText = 'position:absolute; top:54px; right:20px; z-index:64; font-family:monospace; font-weight:bold; font-size:18px; opacity:0; transition:opacity .2s, transform .8s; pointer-events:none;';
  document.body.appendChild(fl);
}

window.showToast = function (msg, color) {
  const c = document.getElementById('toasts');
  if (!c) return;
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `background:rgba(12,8,26,0.92); color:${color || '#9fe'}; border:1px solid ${color || '#9fe'}; padding:8px 16px; border-radius:10px; font-size:14px; font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,0.5); opacity:0; transition:opacity .25s, transform .25s; transform:translateY(-8px);`;
  c.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; setTimeout(() => t.remove(), 300); }, 3200);
};

let _lastBalance = null;
function updateHUD() {
  const bal = document.getElementById('balanceHud');
  if (bal && window.currentPlayer) {
    const b = Math.floor(window.currentPlayer.balance);
    bal.textContent = 'P$ ' + b;

    // balance-change feedback: pulse + floating delta
    if (_lastBalance !== null && b !== _lastBalance) {
      const delta = b - _lastBalance;
      const up = delta > 0;
      bal.style.transition = 'color .15s';
      bal.style.color = up ? '#5dff8f' : '#ff6b6b';
      setTimeout(() => { bal.style.color = '#ffd700'; }, 350);
      const fl = document.getElementById('balanceFloat');
      if (fl) {
        fl.textContent = (up ? '+' : '') + delta + ' P$';
        fl.style.color = up ? '#5dff8f' : '#ff6b6b';
        fl.style.transition = 'none'; fl.style.transform = 'translateY(0)'; fl.style.opacity = '1';
        requestAnimationFrame(() => { fl.style.transition = 'opacity .8s, transform .8s'; fl.style.transform = 'translateY(-26px)'; fl.style.opacity = '0'; });
      }
    }
    _lastBalance = b;
  }
  const room = document.getElementById('roomHud');
  if (room && window.getCurrentRoom) {
    room.textContent = 'Room ' + window.getCurrentRoom() + (window.isRoomHost && window.isRoomHost() ? ' (host)' : '');
  }
}

// ---------- main loop ----------

function animate(time, xrFrame) {
  const dt = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 0.016;
  lastFrameTime = time;

  if (isVR && xrFrame) {
    vrLocomotion(dt);          // three.js auto-updates the built-in controllers
  } else if (!isVR) {
    desktopMovement(dt);
  }

  // Keep the local avatar at the player's ground position.
  // VR: headset world position. Desktop: the rig (camera may be offset in 3rd person).
  if (localAvatar) {
    let px, pz;
    if (isVR) {
      const head = new THREE.Vector3();
      camera.getWorldPosition(head);
      px = head.x; pz = head.z;
    } else {
      px = playerRig.position.x; pz = playerRig.position.z;
    }
    localAvatar.setPosition(px, 0, pz);

    moveUpdateTimer++;
    if (moveUpdateTimer > 6) {
      broadcastPosition(px, 0, pz);
      moveUpdateTimer = 0;
    }
    if (typeof updateVoiceVolumes === 'function') updateVoiceVolumes(localAvatar.position, avatars);
  }

  // animated decor (sparkles, pulsing neon, marquee, idle wheel, disco orb...)
  if (window.sceneUpdaters) {
    const t = (time || 0) / 1000;
    for (let i = 0; i < window.sceneUpdaters.length; i++) window.sceneUpdaters[i](t, dt);
  }

  updateHUD();
  renderer.render(scene, camera);
}

function desktopMovement(dt) {
  // don't drive the player while typing in a game input
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

  // apply mouse-look
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const speed = (keys['shift'] ? SPRINT_SPEED : WALK_SPEED) * dt;

  // facing-relative movement on the ground plane
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys['w']) move.add(forward);
  if (keys['s']) move.sub(forward);
  if (keys['d']) move.add(right);
  if (keys['a']) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    playerRig.position.x = clamp(playerRig.position.x + move.x, -BOUND, BOUND);
    playerRig.position.z = clamp(playerRig.position.z + move.z, -BOUND_Z, BOUND_Z);
  }

  if (thirdPerson) {
    // camera sits behind + above the player, still looking forward (yaw/pitch)
    camera.position.set(Math.sin(yaw) * TP_DIST, EYE_HEIGHT + TP_HEIGHT, Math.cos(yaw) * TP_DIST);
  } else {
    camera.position.set(0, EYE_HEIGHT, 0); // first person: rig carries position
  }
}

function vrLocomotion(dt) {
  if (!xrSession) return;
  let moveX = 0, moveZ = 0, turn = 0;
  for (const src of xrSession.inputSources) {
    if (!src.gamepad || !src.handedness) continue;
    const ax = src.gamepad.axes;
    // axes layout: [0,1] touchpad, [2,3] thumbstick (most Quest controllers use 2/3)
    const x = ax.length >= 4 ? ax[2] : ax[0];
    const y = ax.length >= 4 ? ax[3] : ax[1];
    if (src.handedness === 'left') { moveX += x; moveZ += y; }
    else if (src.handedness === 'right') { turn += x; }
  }

  // smooth locomotion relative to where the headset is looking
  if (Math.abs(moveX) > 0.15 || Math.abs(moveZ) > 0.15) {
    const head = new THREE.Vector3();
    camera.getWorldDirection(head);
    head.y = 0; head.normalize();
    const right = new THREE.Vector3(head.z, 0, -head.x); // perpendicular on ground
    const speed = WALK_SPEED * dt;
    const dx = (head.x * -moveZ + right.x * moveX) * speed;
    const dz = (head.z * -moveZ + right.z * moveX) * speed;
    playerRig.position.x = clamp(playerRig.position.x + dx, -BOUND, BOUND);
    playerRig.position.z = clamp(playerRig.position.z + dz, -BOUND_Z, BOUND_Z);
  }

  // snap turn on right stick
  if (Math.abs(turn) > 0.7) {
    if (snapTurnArmed) {
      playerRig.rotation.y -= Math.sign(turn) * SNAP_TURN_RAD;
      snapTurnArmed = false;
    }
  } else {
    snapTurnArmed = true;
  }
}

// build the game stations into their layout zones, then the VR betting panels
function buildGameStations() {
  const zones = window.FLOOR_ZONES || [];
  zones.forEach((z) => {
    if (z.type !== 'game') return;
    const pos = { x: z.x, z: z.z };
    if (z.game === 'blackjack') createBlackjackBoard(scene, pos, z.face);
    else if (z.game === 'wheel') createWheelBoard(scene, pos, z.face);
    else if (z.game === 'plinko') createPlinkoBoard(scene, pos, z.face);
    else if (z.game === 'shop') createShopBoard(scene, pos, z.face);
    else if (z.game === 'poker') createPokerBoard(scene, pos, z.face);
  });
  if (window.buildVRGamePanels) buildVRGamePanels(scene);
}

// ---------- VR controllers (tracked, with laser + point-to-open) ----------

let vrRaycaster = null, vrTmpMatrix = null;

function setupVRControllers() {
  vrRaycaster = new THREE.Raycaster();
  vrTmpMatrix = new THREE.Matrix4();

  // Real controller models (auto-loads the GLTF matching the headset's controllers)
  const factory = THREE.XRControllerModelFactory ? new THREE.XRControllerModelFactory() : null;

  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    ctrl.addEventListener('selectstart', onVRSelect);
    ctrl.add(makeLaser());
    playerRig.add(ctrl);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(factory ? factory.createControllerModel(grip) : makeControllerMesh());
    playerRig.add(grip);
  }
}

function makeLaser() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x33ccff }));
  line.name = 'laser';
  return line;
}

function makeControllerMesh() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.5, metalness: 0.3 });
  return new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), mat);
}

function onVRSelect(e) {
  const controller = e.target;
  vrTmpMatrix.identity().extractRotation(controller.matrixWorld);
  vrRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(vrTmpMatrix);

  // 1) in-world game buttons (bet / play / result) take priority
  if (window.vrInteractables && window.vrInteractables.length) {
    const btnHits = vrRaycaster.intersectObjects(window.vrInteractables, false);
    if (btnHits.length) {
      const btn = btnHits[0].object;
      if (btn.userData && typeof btn.userData.onSelect === 'function') btn.userData.onSelect();
      return;
    }
  }

  // 2) otherwise, pointing at a game stand opens its overlay
  if (typeof gameBoards === 'undefined') return;
  const hits = vrRaycaster.intersectObjects(Object.values(gameBoards), true);
  if (!hits.length) return;
  let o = hits[0].object;
  while (o && !(o.userData && o.userData.game)) o = o.parent;
  if (o && o.userData.game) openGame(o.userData.game);
}

function openGame(name) {
  if (name === 'blackjack') showBlackjack();
  else if (name === 'plinko') showPlinko();
  else if (name === 'wheel') showWheel();
  else if (name === 'shop') showShop();
  else if (name === 'poker') { if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'hello' }); if (window.showToast) showToast('🃏 Use the panel at the table to play', '#c9a3ff'); }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function isDevAccount() {
  const u = (window.currentUsername || (document.getElementById('username') && document.getElementById('username').value) || '');
  return u.endsWith('.devtest');
}

function toggleVoice() {
  const btn = document.getElementById('voiceBtn');
  if (!voiceEnabled && currentPlayerId) {
    initVoiceChat(currentPlayerId, document.getElementById('username').value);
    btn.innerHTML = 'Disable Voice';
    btn.style.background = '#ff4444';
  } else if (voiceEnabled) {
    leaveVoiceChat();
    btn.innerHTML = 'Enable Voice';
    btn.style.background = '#00aa00';
  }
}

function initGameScene() {
  if (scene) return;
  init();
  const username = document.getElementById('username').value;
  if (username) {
    const avatar = createAvatar('local', username, true);
    avatar.setPosition(-50, 0, 0); // lobby spawn
    scene.add(avatar.getGroup());
    localAvatar = avatar;
    if (window.applyCosmeticsToLocalAvatar) window.applyCosmeticsToLocalAvatar();
  }
  enforcePcGate();
}

// PC-mode access: gate the flat desktop experience behind the players.pc_able flag.
// Always allowed in VR, for admins, or when not signed in via Supabase (offline).
function pcAllowed() {
  if (isVR) return true;
  if (!window.sbActive) return true;
  const p = window.currentPlayer || {};
  return !!(p.pc_able || p.is_admin);
}

function enforcePcGate() {
  let g = document.getElementById('pcGate');
  if (pcAllowed()) { if (g) g.style.display = 'none'; return; }
  if (!g) {
    g = document.createElement('div');
    g.id = 'pcGate';
    g.style.cssText = 'position:fixed; inset:0; z-index:200; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:rgba(6,4,14,0.97); color:#fff; font-family:Segoe UI,Arial,sans-serif; text-align:center;';
    g.innerHTML = `
      <div style="font-size:54px;">🖥️🚫</div>
      <h2 style="color:#ffd24a; margin:0;">PC mode is restricted</h2>
      <p style="max-width:380px; color:#cdbff5;">Your account can only play in VR. Put on your headset and press <b>Enter VR</b>.</p>
      <button onclick="document.getElementById('vrButton') && document.getElementById('vrButton').click()" style="padding:12px 22px; background:linear-gradient(135deg,#ffd24a,#ff9d2f); color:#1a1006; border:none; border-radius:10px; font-weight:700; cursor:pointer;">Enter VR</button>
      <button onclick="location.reload()" style="padding:8px 16px; background:transparent; color:#9fb4ff; border:1px solid rgba(157,180,255,0.4); border-radius:8px; cursor:pointer;">Log out</button>`;
    document.body.appendChild(g);
  }
  g.style.display = 'flex';
}
window.enforcePcGate = enforcePcGate;

window.initGameScene = initGameScene;
window.toggleVoice = toggleVoice;
