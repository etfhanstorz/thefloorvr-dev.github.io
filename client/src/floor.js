function createCasinoFloor(scene) {
  // Ground/Floor with better material
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.3,
    metalness: 0.1
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Walls with better materials
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.7,
    metalness: 0.0
  });

  // North wall
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(100, 20, 1), wallMaterial);
  northWall.position.set(0, 10, -50);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  scene.add(northWall);

  // South wall
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(100, 20, 1), wallMaterial);
  southWall.position.set(0, 10, 50);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  scene.add(southWall);

  // East wall
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 100), wallMaterial);
  eastWall.position.set(50, 10, 0);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  scene.add(eastWall);

  // West wall
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 100), wallMaterial);
  westWall.position.set(-50, 10, 0);
  westWall.castShadow = true;
  westWall.receiveShadow = true;
  scene.add(westWall);

  // Improved lighting
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(20, 40, 20);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  scene.add(mainLight);

  // Secondary light for depth
  const secondaryLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  secondaryLight.position.set(-30, 25, -30);
  scene.add(secondaryLight);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x444466, 0.6);
  scene.add(ambientLight);

  // Neon accent lights
  const neonRed = new THREE.PointLight(0xff0000, 0.5, 50);
  neonRed.position.set(-45, 5, 0);
  scene.add(neonRed);

  const neonBlue = new THREE.PointLight(0x0088ff, 0.5, 50);
  neonBlue.position.set(45, 5, 0);
  scene.add(neonBlue);

  // Improved slot machines on sides
  const slotMaterial = new THREE.MeshStandardMaterial({
    color: 0xcc0000,
    roughness: 0.4,
    metalness: 0.6,
    emissive: 0x330000,
    emissiveIntensity: 0.3
  });

  for (let i = 0; i < 8; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), slotMaterial);
    slot.position.set(-45, 2, -30 + i * 10);
    slot.castShadow = true;
    slot.receiveShadow = true;
    scene.add(slot);

    // Add glowing screen effect
    const screenGeo = new THREE.PlaneGeometry(1.8, 2);
    // MeshBasicMaterial ignores lighting, so it already looks "lit"/glowing.
    // emissive/emissiveIntensity aren't valid here (they belong on Standard).
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(-45, 2, -30 + i * 10 + 1.01);
    scene.add(screen);

    const slot2 = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), slotMaterial);
    slot2.position.set(45, 2, -30 + i * 10);
    slot2.castShadow = true;
    slot2.receiveShadow = true;
    scene.add(slot2);

    const screen2 = new THREE.Mesh(screenGeo, screenMat);
    screen2.position.set(45, 2, -30 + i * 10 + 1.01);
    scene.add(screen2);
  }

  // Casino signage
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 256;
  const signCtx = signCanvas.getContext('2d');
  signCtx.fillStyle = '#000000';
  signCtx.fillRect(0, 0, 512, 256);
  signCtx.fillStyle = '#ffff00';
  signCtx.font = 'bold 80px Arial';
  signCtx.textAlign = 'center';
  signCtx.fillText('THE FLOOR', 256, 150);

  const signTexture = new THREE.CanvasTexture(signCanvas);
  const signGeo = new THREE.PlaneGeometry(20, 10);
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0, 15, -49.5);
  scene.add(sign);
}
