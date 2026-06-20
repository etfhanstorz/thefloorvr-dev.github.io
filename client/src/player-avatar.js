// Avatar height + hat anchor (hats float at roughly the character's head height)
const AV_HEIGHT = 1.7;
const AV_HEAD_TOP = 1.55;

class PlayerAvatar {
  constructor(playerId, username, isLocal = false) {
    this.playerId = playerId;
    this.username = username;
    this.isLocal = isLocal;
    this.position = { x: 0, y: 0, z: 0 };

    const group = new THREE.Group();

    // cosmetic color disc at the feet (this.body is the setBodyColor target)
    const discCol = isLocal ? 0x2ec27e : 0x3b7dff;
    const discMat = new THREE.MeshStandardMaterial({ color: discCol, emissive: discCol, emissiveIntensity: 0.5, roughness: 0.5, transparent: true, opacity: 0.85 });
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 36), discMat);
    this.body.position.y = 0.012;
    group.add(this.body);

    // placeholder shown until the character model finishes loading (or if it fails)
    const fbMat = new THREE.MeshStandardMaterial({ color: discCol, roughness: 0.5, metalness: 0.2, emissive: discCol, emissiveIntensity: 0.15 });
    this.fallback = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.45, 18), fbMat);
    this.fallback.position.y = 0.78; this.fallback.castShadow = true;
    group.add(this.fallback);

    // ---- nametag ----
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,6,20,0.72)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(8, 24, 496, 80, 16); ctx.fill(); } else ctx.fillRect(8, 24, 496, 80);
    ctx.fillStyle = isLocal ? '#7dffb0' : '#9fc2ff';
    ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(username, 256, 66);
    const texture = new THREE.CanvasTexture(canvas);
    const nametag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.3),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    nametag.position.set(0, 2.05, 0);
    nametag.renderOrder = 2;
    this.nametag = nametag;
    group.add(nametag);

    this.group = group;
    this.mixer = null;
    this._loadCharacter();
  }

  // Load the rigged glTF character, scale it to height, stand it on the floor, and
  // play its idle animation. Falls back to the placeholder if the model can't load.
  async _loadCharacter() {
    if (!window.loadModel) return;
    const root = await loadModel('models/RobotExpressive.glb', {});
    if (!root || !this.group) return;
    let box = new THREE.Box3().setFromObject(root);
    const h = (box.max.y - box.min.y) || AV_HEIGHT;
    root.scale.setScalar(AV_HEIGHT / h);
    box = new THREE.Box3().setFromObject(root);
    root.position.y = -box.min.y;                 // feet on the floor
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.character = root;
    this.group.add(root);
    if (this.fallback) { this.group.remove(this.fallback); this.fallback = null; }
    const gltf = root.userData.gltf;
    if (gltf && gltf.animations && gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(root);
      const clip = THREE.AnimationClip.findByName(gltf.animations, 'Idle') || gltf.animations[0];
      if (clip) this.mixer.clipAction(clip).play();
      ensureAvatarTick();
    }
  }

  setPosition(x, y, z) {
    this.position = { x, y, z };
    this.group.position.set(x, y, z);
  }

  getGroup() {
    return this.group;
  }

  setBodyColor(hex) {
    if (hex == null) return;
    this.body.material.color.setHex(hex);
    if (this.body.material.emissive) {
      this.body.material.emissive.setHex(hex);
      this.body.material.emissiveIntensity = 0.2;
    }
  }

  setShirt(hex) {
    if (this._shirt) { this.group.remove(this._shirt); this._shirt = null; }
    if (hex == null) return;
    const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.12, roughness: 0.6 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24), mat);
    band.position.y = 0.95;
    this._shirt = band;
    this.group.add(band);
  }

  // Each hat type maps to a GLB file + target height (m) + y-offset above AV_HEAD_TOP.
  // Models are loaded async and cached by model-loader.js.
  setHat(type) {
    if (this.hat) { this.group.remove(this.hat); this.hat = null; }
    if (!type) return;

    const HAT_MODELS = {
      'gold-crown':    { file: 'models/HatCrown.glb',     h: 0.22, dy: 0.02 },
      'top-hat':       { file: 'models/HatTopHat.glb',    h: 0.38, dy: 0.02 },
      'cowboy':        { file: 'models/HatCowboy.glb',    h: 0.26, dy: 0.02 },
      'wizard':        { file: 'models/HatWizard.glb',    h: 0.48, dy: 0.04 },
      'viking':        { file: 'models/HatVikingHelm.glb',h: 0.30, dy: 0.0  },
      'halo':          { file: 'models/HatHalo.glb',      h: 0.14, dy: 0.32 },
      'hardhat':       { file: 'models/HatHardHat.glb',   h: 0.28, dy: 0.02 },
      'party-hat':     { file: 'models/HatParty.glb',     h: 0.34, dy: 0.06 },
      'cap':           { file: 'models/HatCap.glb',       h: 0.20, dy: 0.0  },
      'jester':        { file: 'models/HatMagician.glb',  h: 0.38, dy: 0.02 },
      'crown-diamond': { file: 'models/HatKingCrown.glb', h: 0.28, dy: 0.02 },
      'beret':         { file: 'models/HatPirate.glb',    h: 0.22, dy: 0.02 },
      'horse':         { file: 'models/Horse.glb',        h: 0.28, dy: 0.12 },
    };

    const def = HAT_MODELS[type];
    if (!def || !window.loadModel) return;

    const hatGroup = new THREE.Group();
    hatGroup.position.y = AV_HEAD_TOP + def.dy;
    this.hat = hatGroup;
    this.group.add(hatGroup);

    loadModel(def.file, {}).then(root => {
      if (!root || this.hat !== hatGroup) return;
      const box = new THREE.Box3().setFromObject(root);
      const h = (box.max.y - box.min.y) || def.h;
      root.scale.setScalar(def.h / h);
      const box2 = new THREE.Box3().setFromObject(root);
      root.position.y = -box2.min.y;
      root.traverse(o => { if (o.isMesh) o.castShadow = true; });
      hatGroup.add(root);
    });
  }

  applyCosmetics(cos) {
    if (!cos) return;
    if (cos.bodyColor != null) this.setBodyColor(cos.bodyColor);
    this.setHat(cos.hat || null);
    if (cos.shirt != null && this.setShirt) this.setShirt(cos.shirt);
  }
}

const avatars = {};

// One render-loop hook drives every avatar's animation mixer; avatars removed from
// the map simply stop updating (no per-avatar updater leak).
let _avatarTickHooked = false;
function ensureAvatarTick() {
  if (_avatarTickHooked) return;
  _avatarTickHooked = true;
  (window.sceneUpdaters = window.sceneUpdaters || []).push((t, dt) => {
    for (const id in avatars) { const a = avatars[id]; if (a && a.mixer) a.mixer.update(dt || 0); }
  });
}

function createAvatar(playerId, username, isLocal = false) {
  if (avatars[playerId]) return avatars[playerId];
  const avatar = new PlayerAvatar(playerId, username, isLocal);
  avatars[playerId] = avatar;
  return avatar;
}

function getAvatar(playerId) {
  return avatars[playerId];
}

function removeAvatar(playerId) {
  const avatar = avatars[playerId];
  if (avatar) {
    avatar.getGroup().parent.remove(avatar.getGroup());
    delete avatars[playerId];
  }
}
