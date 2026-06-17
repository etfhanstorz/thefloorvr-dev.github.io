let scene, camera, renderer, localAvatar;
let keys = {};
let moveUpdateTimer = 0;
let xrSession = null;
let isVR = false;

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 200, 500);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, xrCompatible: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Create floor
  createCasinoFloor(scene);

  // Input
  document.addEventListener('keydown', (e) => keys[e.key] = true);
  document.addEventListener('keyup', (e) => keys[e.key] = false);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // VR Button
  const vrButton = document.createElement('button');
  vrButton.innerHTML = 'Enter VR';
  vrButton.style.cssText = 'position: absolute; bottom: 20px; right: 20px; padding: 10px 20px; background: #ff6600; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 100; font-size: 16px;';
  document.body.appendChild(vrButton);

  // Game Buttons
  const gameButtonsDiv = document.createElement('div');
  gameButtonsDiv.style.cssText = 'position: absolute; bottom: 60px; right: 20px; display: flex; flex-direction: column; gap: 5px; z-index: 100;';

  const blackjackBtn = document.createElement('button');
  blackjackBtn.innerHTML = '♠️ Blackjack';
  blackjackBtn.style.cssText = 'padding: 10px 15px; background: #00aa00; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
  blackjackBtn.addEventListener('click', () => {
    showBlackjack();
    if (socket && socket.connected) socket.emit('join_blackjack');
  });
  gameButtonsDiv.appendChild(blackjackBtn);

  const plinkoBtn = document.createElement('button');
  plinkoBtn.innerHTML = '🎯 Plinko';
  plinkoBtn.style.cssText = 'padding: 10px 15px; background: #00ff00; color: black; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
  plinkoBtn.addEventListener('click', showPlinko);
  gameButtonsDiv.appendChild(plinkoBtn);

  const wheelBtn = document.createElement('button');
  wheelBtn.innerHTML = '🎡 Wheel';
  wheelBtn.style.cssText = 'padding: 10px 15px; background: #ffff00; color: black; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
  wheelBtn.addEventListener('click', showWheel);
  gameButtonsDiv.appendChild(wheelBtn);

  const shopBtn = document.createElement('button');
  shopBtn.innerHTML = '🛍️ Shop';
  shopBtn.style.cssText = 'padding: 10px 15px; background: #ff6600; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
  shopBtn.addEventListener('click', showShop);
  gameButtonsDiv.appendChild(shopBtn);

  document.body.appendChild(gameButtonsDiv);

  vrButton.addEventListener('click', async () => {
    if (!isVR && navigator.xr) {
      try {
        const session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body }
        });
        xrSession = session;
        isVR = true;
        vrButton.innerHTML = 'Exit VR';
        renderer.xr.setSession(session);
      } catch (e) {
        console.error('VR not available:', e);
        alert('WebXR not supported or permission denied');
      }
    } else if (isVR && xrSession) {
      await xrSession.end();
      isVR = false;
      vrButton.innerHTML = 'Enter VR';
    }
  });

  // Check VR support
  if (!navigator.xr) {
    vrButton.disabled = true;
    vrButton.innerHTML = 'VR Not Supported';
  }

  // Socket handlers
  window.onPlayersUpdated = (players) => {
    players.forEach(player => {
      if (player.id !== currentPlayerId) {
        let avatar = getAvatar(player.id);
        if (!avatar) {
          avatar = createAvatar(player.id, player.username, false);
          avatar.setPosition(player.x, player.y, player.z);
          scene.add(avatar.getGroup());
        }
      }
    });
  };

  window.onPlayerMoved = (data) => {
    if (data.playerId !== currentPlayerId) {
      let avatar = getAvatar(data.playerId);
      if (!avatar) {
        avatar = createAvatar(data.playerId, 'Player', false);
        scene.add(avatar.getGroup());
      }
      avatar.setPosition(data.x, data.y, data.z);
    }
  };

  window.onPlayerLeft = (data) => {
    removeAvatar(data.playerId);
  };

  animate();
}

function animate() {
  if (isVR) {
    renderer.xr.getSession().requestAnimationFrame(animate);
  } else {
    requestAnimationFrame(animate);
  }

  // Local player movement (WASD in desktop, XR controller in VR)
  if (localAvatar) {
    if (!isVR) {
      // Desktop movement
      const speed = 0.3;
      if (keys['w'] || keys['W']) localAvatar.position.z -= speed;
      if (keys['s'] || keys['S']) localAvatar.position.z += speed;
      if (keys['a'] || keys['A']) localAvatar.position.x -= speed;
      if (keys['d'] || keys['D']) localAvatar.position.x += speed;

      localAvatar.setPosition(localAvatar.position.x, 0, localAvatar.position.z);

      // Camera follow desktop
      camera.position.x = localAvatar.position.x;
      camera.position.z = localAvatar.position.z + 5;
      camera.lookAt(localAvatar.position.x, 1.5, localAvatar.position.z);
    } else {
      // VR: sync avatar to camera position
      const cameraPos = camera.position;
      localAvatar.setPosition(cameraPos.x, 0, cameraPos.z);
    }

    // Broadcast position every 100ms
    moveUpdateTimer++;
    if (moveUpdateTimer > 6) {
      broadcastPosition(localAvatar.position.x, 0, localAvatar.position.z);
      moveUpdateTimer = 0;
    }

    // Update voice chat volumes based on distance
    updateVoiceVolumes(localAvatar.position, avatars);
  }

  renderer.render(scene, camera);
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

document.addEventListener('DOMContentLoaded', () => {
  const originalLogin = window.login;
  window.login = function() {
    originalLogin();
    setTimeout(() => initGameScene(), 500);
  };

  const originalRegister = window.register;
  window.register = function() {
    originalRegister();
    setTimeout(() => initGameScene(), 500);
  };

  function initGameScene() {
    if (scene || !currentPlayerId) return;

    init();
    const username = document.getElementById('username').value;
    const avatar = createAvatar(currentPlayerId, username, true);
    avatar.setPosition(0, 0, 0);
    scene.add(avatar.getGroup());
    localAvatar = avatar;

    setTimeout(() => {
      if (socket && socket.connected) {
        socket.emit('get_players_in_room');
      }
    }, 200);
  }
});
