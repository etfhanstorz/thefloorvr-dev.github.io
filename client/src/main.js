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
let yaw = 0, pitch = 0;        // desktop mouse-look (radians)
let pointerLocked = false;
let lastFrameTime = 0;
let snapTurnArmed = true;      // debounce for VR snap turn

const WALK_SPEED = 4.0;        // metres / second
const SPRINT_SPEED = 8.0;
const EYE_HEIGHT = 1.7;
const BOUND = 48;              // keep inside the ±50 walls
const SNAP_TURN_RAD = 30 * Math.PI / 180;

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 200, 500);

  // Camera inside a movable rig (rig moves the player; headset drives camera in VR)
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, EYE_HEIGHT, 0);

  playerRig = new THREE.Group();
  playerRig.position.set(0, 0, 5);
  playerRig.add(camera);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, xrCompatible: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  createCasinoFloor(scene);
  scene.add(playerRig);

  // Keyboard
  document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
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
  vrButton.innerHTML = 'Enter VR';
  vrButton.style.cssText = 'position: absolute; bottom: 20px; right: 20px; padding: 10px 20px; background: #ff6600; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100; font-size: 16px;';
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
        xrRefSpace = await session.requestReferenceSpace('local-floor');

        initVRHands(session, null);
        createBlackjackBoard(scene);
        createPlinkoBoard(scene);
        createWheelBoard(scene);
        createShopBoard(scene);
        controllerLeft = createControllerModel(scene, 'left');
        controllerRight = createControllerModel(scene, 'right');

        session.addEventListener('end', () => { isVR = false; vrButton.innerHTML = 'Enter VR'; });
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
    const hint = document.getElementById('lookHint');
    if (hint) hint.style.display = pointerLocked ? 'none' : 'block';
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

  const hint = document.createElement('div');
  hint.id = 'lookHint';
  hint.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,40px); color:white; background:rgba(0,0,0,0.6); padding:6px 12px; border-radius:6px; font-family:Arial; font-size:13px; z-index:55; pointer-events:none;';
  hint.textContent = 'Click to look · WASD move · Shift sprint · Esc release';
  document.body.appendChild(hint);
}

function updateHUD() {
  const bal = document.getElementById('balanceHud');
  if (bal && window.currentPlayer) bal.textContent = 'P$ ' + Math.floor(window.currentPlayer.balance);
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
    updateControllers(xrFrame, xrRefSpace);
    vrLocomotion(dt);
  } else if (!isVR) {
    desktopMovement(dt);
  }

  // Keep the local avatar under the player's head position
  if (localAvatar) {
    const head = new THREE.Vector3();
    camera.getWorldPosition(head);
    localAvatar.setPosition(head.x, 0, head.z);

    moveUpdateTimer++;
    if (moveUpdateTimer > 6) {
      broadcastPosition(head.x, 0, head.z);
      moveUpdateTimer = 0;
    }
    if (typeof updateVoiceVolumes === 'function') updateVoiceVolumes(localAvatar.position, avatars);
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
    playerRig.position.z = clamp(playerRig.position.z + move.z, -BOUND, BOUND);
  }
  camera.position.set(0, EYE_HEIGHT, 0); // camera fixed in rig; rig carries position
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
    playerRig.position.z = clamp(playerRig.position.z + dz, -BOUND, BOUND);
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

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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
    avatar.setPosition(0, 0, 5);
    scene.add(avatar.getGroup());
    localAvatar = avatar;
  }
}

window.initGameScene = initGameScene;
window.toggleVoice = toggleVoice;
