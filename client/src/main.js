// Snapshot native Math.random so games can verify it hasn't been tampered with.
const _nativeRandom = Math.random;
window._checkRng = function () { return Math.random === _nativeRandom; };

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
  if (window.placeRealModels) placeRealModels(scene);

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
    if (renderer.xr && renderer.xr.isPresenting) return;
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
        // Tell Three.js which ref space to use before the session starts
        renderer.xr.setReferenceSpaceType('local-floor');

        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'hand-tracking', 'dom-overlay'],
          domOverlay: { root: document.body }
        });
        xrSession = session;

        // Hand session to Three.js FIRST — it owns the render loop from here
        await renderer.xr.setSession(session);

        isVR = true;
        vrButton.innerHTML = 'Exit VR';
        enforcePcGate();

        // Controllers must be set up after the session is wired in
        setupVRControllers();

        session.addEventListener('end', () => {
          isVR = false;
          xrSession = null;
          vrButton.innerHTML = 'Enter VR';
          enforcePcGate();
        });
      } catch (e) {
        console.error('VR not available:', e);
        alert('WebXR not supported or permission denied: ' + e.message);
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
    vrLocomotion(dt);
    updateVRBody();
    _pollModMenuGrip(xrFrame);
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
    // in VR you ARE the rig (arms + hands), so hide your own full-body avatar
    localAvatar.getGroup().visible = !isVR;

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
  if (isVR && window._updateWristHUD) window._updateWristHUD();
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
    else if (z.game === 'upgrades') createUpgradeBoard(scene, pos, z.face);
    else if (z.game === 'poker') createPokerBoard(scene, pos, z.face);
  });
  if (window.buildVRGamePanels) buildVRGamePanels(scene);
}

// ---------- VR controllers (tracked, with laser + point-to-open) ----------

let vrRaycaster = null, vrTmpMatrix = null;
let vrControllersSetup = false;
let vrGrips = [];   // controllerGrip objects (their .position is the wrist, in rig space)
let vrGripByHand = {};  // { left: grip, right: grip } — set on connected event
let vrBody = null;  // shoulders + arms that connect to the controllers

function setupVRControllers() {
  if (vrControllersSetup) return; // build once; grips persist across sessions
  vrControllersSetup = true;
  vrRaycaster = new THREE.Raycaster();
  vrTmpMatrix = new THREE.Matrix4();
  vrGrips = [];

  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    ctrl.addEventListener('selectstart', onVRSelect);
    ctrl.add(makeLaser());
    playerRig.add(ctrl);

    // detailed procedural controller model (reliable in the emulator and on-device)
    const grip = renderer.xr.getControllerGrip(i);
    const placeModel = (hand) => {
      while (grip.children.length) grip.remove(grip.children[0]);
      grip.add(window.makeControllerModel ? window.makeControllerModel(hand) : makeControllerMesh());
    };
    grip.addEventListener('connected', (e) => {
      const hand = (e.data && e.data.handedness) || (i === 0 ? 'left' : 'right');
      vrGripByHand[hand] = grip;
      placeModel(hand);
      // re-attach wrist HUD and mod menu now that we know which grip is left
      if (hand === 'left') {
        if (_wristMesh && !grip.children.includes(_wristMesh)) grip.add(_wristMesh);
        if (_vrModMenu && !grip.children.includes(_vrModMenu)) grip.add(_vrModMenu);
      }
    });
    grip.addEventListener('disconnected', () => { while (grip.children.length) grip.remove(grip.children[0]); });
    placeModel(i === 0 ? 'left' : 'right'); // immediate fallback so a model always shows
    playerRig.add(grip);
    vrGrips[i] = grip;
  }

  buildVRBody();
  buildWristHUD();
  buildVRModMenu();
}

// ---- Wrist HUD (left controller) ----
let _wristCanvas = null, _wristCtx = null, _wristTex = null, _wristMesh = null;
let _wristLastBal = -1;

function buildWristHUD() {
  if (_wristMesh) return;
  _wristCanvas = document.createElement('canvas');
  _wristCanvas.width = 256; _wristCanvas.height = 96;
  _wristCtx = _wristCanvas.getContext('2d');
  _wristTex = new THREE.CanvasTexture(_wristCanvas);
  const mat = new THREE.MeshBasicMaterial({ map: _wristTex, transparent: true, depthWrite: false });
  _wristMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.052), mat);
  // sit on top of the wrist, tilted to face the player when arm is raised
  _wristMesh.position.set(0, 0.01, -0.04);
  _wristMesh.rotation.x = -Math.PI / 4;
  if (vrGrips[0]) vrGrips[0].add(_wristMesh);
  _drawWristHUD(0);
}

function _drawWristHUD(bal) {
  if (!_wristCtx) return;
  const x = _wristCtx, W = 256, H = 96;
  x.clearRect(0, 0, W, H);
  // background pill
  x.fillStyle = 'rgba(8,5,20,0.88)';
  x.beginPath(); x.roundRect(4, 4, W-8, H-8, 14); x.fill();
  // gold border
  x.strokeStyle = '#ffd700'; x.lineWidth = 4;
  x.shadowColor = '#ffd700'; x.shadowBlur = 10;
  x.beginPath(); x.roundRect(4, 4, W-8, H-8, 14); x.stroke();
  x.shadowBlur = 0;
  // label
  x.fillStyle = '#aaa'; x.font = '18px Arial'; x.textAlign = 'center';
  x.fillText('BALANCE', W/2, 30);
  // value
  x.fillStyle = '#ffd700'; x.font = 'bold 36px Arial';
  x.fillText('P$ ' + Math.floor(bal).toLocaleString(), W/2, 70);
  _wristTex.needsUpdate = true;
}

window._updateWristHUD = function() {
  const bal = (window.currentPlayer && window.currentPlayer.balance) || 0;
  if (bal === _wristLastBal) return;
  _wristLastBal = bal;
  _drawWristHUD(bal);
};

// ---- VR Mod Menu (admin only, right grip squeeze to toggle) ----
let _vrModMenu = null, _vrModCanvas = null, _vrModCtx = null, _vrModTex = null;
let _vrModVisible = false, _vrModTab = 'players', _vrModPage = 0;
let _vrModBtnMeshes = [];

// Poll gamepad grip buttons directly — squeezestart events aren't reliable in all emulators.
// buttons[1] is the grip/squeeze on both Quest controllers and the Immersive Web Emulator.
let _gripWasPressed = false;
function _pollModMenuGrip(xrFrame) {
  if (!xrSession) return;
  let pressed = false;
  for (const src of xrSession.inputSources) {
    if (src.handedness === 'right' && src.gamepad) {
      // try both common A-button indices
      for (const idx of [4, 3, 5]) {
        if (src.gamepad.buttons[idx] && src.gamepad.buttons[idx].pressed) { pressed = true; break; }
      }
    }
  }
  if (pressed && !_gripWasPressed) {
    if (!_vrModMenu || !window.currentPlayer || !window.currentPlayer.is_admin) { _gripWasPressed = pressed; return; }
    _vrModVisible = !_vrModVisible;
    _vrModMenu.visible = _vrModVisible;
    if (_vrModVisible) _refreshVRMod();
  }
  _gripWasPressed = pressed;
}

function buildVRModMenu() {
  if (!window.currentPlayer || !window.currentPlayer.is_admin) return;
  if (_vrModMenu) return;

  _vrModCanvas = document.createElement('canvas');
  _vrModCanvas.width = 512; _vrModCanvas.height = 640;
  _vrModCtx = _vrModCanvas.getContext('2d');
  _vrModTex = new THREE.CanvasTexture(_vrModCanvas);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.575),
    new THREE.MeshBasicMaterial({ map: _vrModTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );

  _vrModMenu = new THREE.Group();
  _vrModMenu.add(panel);
  _vrModMenu.visible = false;

  // Attach above the left palm, face-up (readable when you raise your palm).
  // Grip space: Y = thumb-up, Z = toward player (wrist). Plane default faces +Z.
  _vrModMenu.position.set(0, 0.06, 0.0);
  _vrModMenu.rotation.x = -Math.PI / 2; // lay flat, face up (palm side)
  const leftGrip = vrGripByHand['left'] || vrGrips[0];
  if (leftGrip) leftGrip.add(_vrModMenu);

  // Tab buttons
  _vrModAddBtn('PLAYERS', -0.10, -0.26, () => { _vrModTab = 'players'; _vrModPage = 0; _drawVRMod(); });
  _vrModAddBtn('LOGS',    0.10, -0.26, () => { _vrModTab = 'logs';    _vrModPage = 0; _drawVRMod(); });
  // Pagination
  _vrModAddBtn('◀', -0.18, -0.31, () => { _vrModPage = Math.max(0, _vrModPage - 1); _drawVRMod(); });
  _vrModAddBtn('▶',  0.18, -0.31, () => { _vrModPage++; _drawVRMod(); });
  // Refresh
  _vrModAddBtn('↺ REFRESH', 0, -0.26, () => _refreshVRMod());

  _drawVRMod();
}

function _vrModAddBtn(label, x, y, fn) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 52;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(30,10,50,0.92)';
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(3,3,154,46,10); else ctx.rect(3,3,154,46); ctx.fill();
  ctx.strokeStyle = '#cc44ff'; ctx.lineWidth = 3;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(3,3,154,46,10); else ctx.rect(3,3,154,46); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 80, 27);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.10, 0.033),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.position.set(x, y, 0.002);
  mesh.userData.onSelect = fn;
  mesh.userData.vrButton = true;
  _vrModMenu.add(mesh);
  _vrModBtnMeshes.push(mesh);
  (window.vrInteractables = window.vrInteractables || []).push(mesh);
}

async function _refreshVRMod() {
  _drawVRMod('Loading…');
  if (window.sbFetchAllPlayers) window._vrModPlayersCache = await sbFetchAllPlayers();
  _drawVRMod();
}

function _drawVRMod(override) {
  if (!_vrModCtx) return;
  const x = _vrModCtx, W = 512, H = 640;
  x.clearRect(0, 0, W, H);

  // Background
  x.fillStyle = 'rgba(8,3,18,0.95)';
  x.beginPath(); if (x.roundRect) x.roundRect(4,4,W-8,H-8,20); else x.rect(4,4,W-8,H-8); x.fill();
  x.strokeStyle = '#cc44ff'; x.lineWidth = 5;
  x.shadowColor = '#cc44ff'; x.shadowBlur = 16;
  x.beginPath(); if (x.roundRect) x.roundRect(4,4,W-8,H-8,20); else x.rect(4,4,W-8,H-8); x.stroke();
  x.shadowBlur = 0;

  // Header
  x.fillStyle = '#cc44ff'; x.font = 'bold 36px Arial'; x.textAlign = 'center';
  x.fillText('🛡️ MOD MENU', W/2, 46);

  // Tab indicator
  const tabs = ['players','logs'];
  tabs.forEach((t, i) => {
    const active = _vrModTab === t;
    x.fillStyle = active ? '#cc44ff' : 'rgba(255,255,255,0.12)';
    x.fillRect(20 + i*236, 68, 216, 3);
  });

  x.fillStyle = '#888'; x.font = '14px Arial'; x.textAlign = 'left';
  x.fillText(_vrModTab === 'players' ? 'PLAYERS  ·  ↺ to refresh' : 'LOGS  ·  ↺ to refresh', 20, 92);

  if (override) {
    x.fillStyle = '#ccc'; x.font = '22px Arial'; x.textAlign = 'center';
    x.fillText(override, W/2, 340);
    _vrModTex.needsUpdate = true; return;
  }

  if (_vrModTab === 'players') {
    const players = window._vrModPlayersCache || [];
    const PER = 6;
    const page = players.slice(_vrModPage * PER, (_vrModPage + 1) * PER);
    const total = Math.ceil(players.length / PER);
    x.fillStyle = '#888'; x.font = '13px Arial'; x.textAlign = 'right';
    x.fillText(`Page ${_vrModPage+1}/${Math.max(1,total)}  (${players.length} total)`, W-20, 92);

    // Column headers
    x.fillStyle = '#666'; x.font = 'bold 14px Arial'; x.textAlign = 'left';
    x.fillText('USERNAME', 20, 116);
    x.fillText('P$', 220, 116);
    x.fillText('FLAGS', 340, 116);
    x.fillStyle = '#333'; x.fillRect(20, 120, W-40, 1);

    page.forEach((p, i) => {
      const y = 146 + i * 72;
      // row bg
      x.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent';
      x.fillRect(14, y-20, W-28, 64);

      x.fillStyle = p.is_admin ? '#ff6b6b' : '#e8e8ff';
      x.font = 'bold 22px Arial'; x.textAlign = 'left';
      x.fillText((p.username || '?').slice(0,16) + (p.is_admin ? ' 🛡️' : ''), 20, y+4);

      x.fillStyle = '#ffd700'; x.font = '18px Arial';
      x.fillText('P$ ' + Math.floor(p.balance || 0).toLocaleString(), 220, y+4);

      const flags = [p.pc_able ? '💻' : '', p.is_admin ? '👑' : ''].filter(Boolean).join(' ') || '—';
      x.fillStyle = '#aaa'; x.font = '18px Arial';
      x.fillText(flags, 340, y+4);

      // time
      const mins = Math.floor((p.time_played || 0) / 60);
      x.fillStyle = '#555'; x.font = '13px Arial';
      x.fillText(mins + 'm played', 20, y+28);
    });

    if (!players.length) {
      x.fillStyle = '#555'; x.font = '20px Arial'; x.textAlign = 'center';
      x.fillText('No data — press ↺ REFRESH', W/2, 300);
    }
  } else {
    // Logs tab
    const logs = window._remoteLogs || {};
    const lines = [];
    Object.entries(logs).forEach(([u, arr]) => (arr||[]).forEach(e => lines.push({ u, ...e })));
    lines.sort((a,b) => a.t - b.t);
    const PER = 10;
    const page = lines.slice(-PER * (_vrModPage + 1)).slice(0, PER);
    const col = l => l==='error'?'#ff6b6b':l==='warn'?'#ffd24a':'#9fe';
    page.forEach((e, i) => {
      const y = 116 + i * 48;
      x.fillStyle = '#666'; x.font = '13px Arial'; x.textAlign = 'left';
      x.fillText('[' + (e.u||'?').slice(0,10) + ']', 20, y);
      x.fillStyle = col(e.l); x.font = '15px Arial';
      x.fillText((e.m||'').slice(0,52), 20, y+18);
    });
    if (!lines.length) {
      x.fillStyle = '#555'; x.font = '20px Arial'; x.textAlign = 'center';
      x.fillText('No logs yet', W/2, 300);
    }
  }

  _vrModTex.needsUpdate = true;
}

// A simple upper body (chest + shoulders + two jointed arms) parented to the rig.
// Each frame updateVRBody() bends the arms so the hands follow the controllers.
function buildVRBody() {
  if (vrBody) return;
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.6, metalness: 0.15 });
  const cuff = new THREE.MeshStandardMaterial({ color: 0x121521, roughness: 0.5, metalness: 0.2 });
  const seg = (rt, rb, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 1, 12), mat); m.castShadow = true; return m; };

  const group = new THREE.Group();
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.46, 16), sleeve);
  chest.castShadow = true; group.add(chest);
  const arms = [];
  for (let i = 0; i < 2; i++) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), sleeve); group.add(shoulder);
    const upper = seg(0.042, 0.036, sleeve); group.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), sleeve); group.add(elbow);
    const fore = seg(0.036, 0.03, cuff); group.add(fore);
    arms.push({ shoulder, upper, elbow, fore });
  }
  playerRig.add(group);
  vrBody = { group, chest, arms };
}

const _VR_Y = new THREE.Vector3(0, 1, 0);
function orientSeg(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1e-4;
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(_VR_Y, dir.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1);
}

// Bend the arms so the hands sit at the controllers (all in rig-local space).
function updateVRBody() {
  if (!vrBody) return;
  vrBody.group.visible = true;
  const head = camera.position; // rig-local
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const yaw = Math.atan2(fwd.x, fwd.z);
  const q = new THREE.Quaternion().setFromAxisAngle(_VR_Y, yaw);
  const flatBack = new THREE.Vector3(fwd.x, 0, fwd.z).normalize().multiplyScalar(-0.05);
  const off = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q).add(head);

  vrBody.chest.position.copy(off(0, -0.5, -0.02));
  vrBody.chest.quaternion.copy(q);

  const MAX_REACH = 0.65; // natural arm length cap (m); prevents stretching when controller moves far
  const sign = [-1, 1];
  for (let i = 0; i < 2; i++) {
    const arm = vrBody.arms[i];
    const shoulder = off(sign[i] * 0.19, -0.32, -0.04);
    let wrist = (vrGrips[i] && vrGrips[i].position) ? vrGrips[i].position.clone() : off(sign[i] * 0.22, -0.7, -0.3);
    // clamp to natural arm length so arm doesn't stretch when controller is extended far out
    const reach = wrist.clone().sub(shoulder);
    if (reach.length() > MAX_REACH) wrist = shoulder.clone().add(reach.normalize().multiplyScalar(MAX_REACH));
    arm.shoulder.position.copy(shoulder);
    const elbow = shoulder.clone().add(wrist).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.12, 0)).add(flatBack);
    arm.elbow.position.copy(elbow);
    orientSeg(arm.upper, shoulder, elbow);
    orientSeg(arm.fore, elbow, wrist);
  }
}

// glowing beam + reticle (nicer than a 1px line)
function makeLaser() {
  const g = new THREE.Group();
  const len = 5;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0010, len, 8),
    new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.55, depthWrite: false })
  );
  beam.rotation.x = -Math.PI / 2;   // align the cylinder's +Y to -Z
  beam.position.z = -len / 2;
  g.add(beam);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x99eeff, transparent: true, opacity: 0.85, depthWrite: false })
  );
  tip.position.z = -2.2;
  g.add(tip);
  g.name = 'laser';
  return g;
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
  const hits = vrRaycaster.intersectObjects(Object.values(gameBoards).filter(o => o && o.isObject3D), true);
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
  else if (name === 'upgrades') { if (window.showUpgrades) showUpgrades(); }
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
    window.localAvatarRef = avatar;
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
