class PlayerAvatar {
  constructor(playerId, username, isLocal = false) {
    this.playerId = playerId;
    this.username = username;
    this.isLocal = isLocal;
    this.position = { x: 0, y: 0, z: 0 };

    const group = new THREE.Group();

    // Body (CapsuleGeometry needs three r142+; r128 only has Cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16);
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

  setBodyColor(hex) {
    if (hex == null) return;
    this.body.material.color.setHex(hex);
    if (this.body.material.emissive) {
      this.body.material.emissive.setHex(hex);
      this.body.material.emissiveIntensity = 0.2;
    }
  }

  setHat(type) {
    // remove existing hat
    if (this.hat) { this.group.remove(this.hat); this.hat = null; }
    if (!type) return;

    let mesh;
    if (type === 'gold-crown') {
      const geo = new THREE.CylinderGeometry(0.34, 0.4, 0.25, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.3 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.62;
    } else if (type === 'party-hat') {
      const geo = new THREE.ConeGeometry(0.3, 0.6, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff44aa, roughness: 0.5, emissive: 0x551133, emissiveIntensity: 0.3 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.85;
    } else if (type === 'top-hat') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
      top.position.y = 0.27;
      mesh = new THREE.Group();
      mesh.add(brim); mesh.add(top);
      mesh.position.y = 1.6;
    }
    if (mesh) {
      mesh.castShadow = true;
      this.hat = mesh;
      this.group.add(mesh);
    }
  }

  applyCosmetics(cos) {
    if (!cos) return;
    if (cos.bodyColor != null) this.setBodyColor(cos.bodyColor);
    this.setHat(cos.hat || null);
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
