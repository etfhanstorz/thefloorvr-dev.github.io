class PlayerAvatar {
  constructor(playerId, username, isLocal = false) {
    this.playerId = playerId;
    this.username = username;
    this.isLocal = isLocal;
    this.position = { x: 0, y: 0, z: 0 };

    const group = new THREE.Group();

    // Body capsule with better materials
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.5, 8, 16);
    const bodyColor = isLocal ? 0x00ff00 : 0x0066ff;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.4,
      metalness: 0.2,
      emissive: bodyColor,
      emissiveIntensity: 0.2
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    group.add(this.body);

    // Head with better geometry
    const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.5,
      metalness: 0.0
    });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.position.y = 1.2;
    this.head.castShadow = true;
    this.head.receiveShadow = true;
    group.add(this.head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: isLocal ? 0x00aa00 : 0x0044ff,
      emissive: isLocal ? 0x00aa00 : 0x0044ff,
      emissiveIntensity: 0.5
    });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.12, 1.35, 0.2);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.12, 1.35, 0.2);
    group.add(rightEye);

    // Nametag
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(username, 256, 80);

    const texture = new THREE.CanvasTexture(canvas);
    const nametag = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.5),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    nametag.position.y = 2.2;
    nametag.position.z = 0.3;
    group.add(nametag);

    this.group = group;
  }

  setPosition(x, y, z) {
    this.position = { x, y, z };
    this.group.position.set(x, y, z);
  }

  getGroup() {
    return this.group;
  }
}

const avatars = {};

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
