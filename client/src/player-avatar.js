class PlayerAvatar {
  constructor(playerId, username, isLocal = false) {
    this.playerId = playerId;
    this.username = username;
    this.isLocal = isLocal;
    this.position = { x: 0, y: 0, z: 0 };

    const group = new THREE.Group();

    // Body capsule
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.5, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: isLocal ? 0x00ff00 : 0x0066ff
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.castShadow = true;
    group.add(this.body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.position.y = 1.2;
    this.head.castShadow = true;
    group.add(this.head);

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
