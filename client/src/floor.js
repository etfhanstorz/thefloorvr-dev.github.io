function createCasinoFloor(scene) {
  // Ground/Floor
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Walls
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

  // North wall
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(100, 20, 1), wallMaterial);
  northWall.position.set(0, 10, -50);
  scene.add(northWall);

  // South wall
  const southWall = new THREE.Mesh(new THREE.BoxGeometry(100, 20, 1), wallMaterial);
  southWall.position.set(0, 10, 50);
  scene.add(southWall);

  // East wall
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 100), wallMaterial);
  eastWall.position.set(50, 10, 0);
  scene.add(eastWall);

  // West wall
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 100), wallMaterial);
  westWall.position.set(-50, 10, 0);
  scene.add(westWall);

  // Ceiling light
  const light = new THREE.PointLight(0xffffff, 1, 1000);
  light.position.set(0, 30, 0);
  scene.add(light);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x666666);
  scene.add(ambientLight);

  // Slot machines on sides (decorative)
  const slotMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
  for (let i = 0; i < 8; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), slotMaterial);
    slot.position.set(-45, 2, -30 + i * 10);
    scene.add(slot);

    const slot2 = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), slotMaterial);
    slot2.position.set(45, 2, -30 + i * 10);
    scene.add(slot2);
  }
}
