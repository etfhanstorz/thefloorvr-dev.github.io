let gameBoards = {};

function createBlackjackBoard(scene) {
  const group = new THREE.Group();
  group.position.set(0, 1.5, -2);

  // Table surface
  const tableGeo = new THREE.BoxGeometry(1, 0.1, 0.6);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  group.add(table);

  // Dealer area text
  const dealerCanvas = document.createElement('canvas');
  dealerCanvas.width = 256;
  dealerCanvas.height = 128;
  const ctx = dealerCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Dealer: 0', 128, 64);

  const dealerTexture = new THREE.CanvasTexture(dealerCanvas);
  const dealerGeo = new THREE.PlaneGeometry(0.8, 0.3);
  const dealerMat = new THREE.MeshBasicMaterial({ map: dealerTexture });
  const dealerDisplay = new THREE.Mesh(dealerGeo, dealerMat);
  dealerDisplay.position.y = 0.1;
  dealerDisplay.position.z = -0.25;
  group.add(dealerDisplay);

  gameBoards.blackjack = group;
  scene.add(group);
  return group;
}

function createPlinkoBoard(scene) {
  const group = new THREE.Group();
  group.position.set(-1.5, 1.5, -2);

  // Frame
  const frameGeo = new THREE.BoxGeometry(0.6, 1, 0.2);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  group.add(frame);

  // Pegs (simplified grid)
  const pegMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < row + 1; col++) {
      const peg = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        pegMat
      );
      peg.position.x = (col - row / 2) * 0.08;
      peg.position.y = 0.3 - row * 0.15;
      group.add(peg);
    }
  }

  // Buckets at bottom
  for (let i = 0; i < 3; i++) {
    const bucket = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.05, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    bucket.position.x = (i - 1) * 0.15;
    bucket.position.y = -0.35;
    group.add(bucket);
  }

  gameBoards.plinko = group;
  scene.add(group);
  return group;
}

function createWheelBoard(scene) {
  const group = new THREE.Group();
  group.position.set(1.5, 1.5, -2);

  // Wheel
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.rotation.x = Math.PI / 2;
  group.add(wheel);

  // Segments (colored)
  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const segmentGeo = new THREE.ConeGeometry(0.05, 0.3, 4);
    const segmentMat = new THREE.MeshStandardMaterial({ color: colors[i] });
    const segment = new THREE.Mesh(segmentGeo, segmentMat);
    segment.position.x = Math.cos(angle) * 0.2;
    segment.position.z = Math.sin(angle) * 0.2;
    segment.rotation.z = angle;
    group.add(segment);
  }

  gameBoards.wheel = group;
  scene.add(group);
  return group;
}

function createShopBoard(scene) {
  const group = new THREE.Group();
  group.position.set(0, 0.8, -3);

  // Shop sign
  const signGeo = new THREE.BoxGeometry(1, 0.5, 0.1);
  const signMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const sign = new THREE.Mesh(signGeo, signMat);
  group.add(sign);

  // Title
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', 128, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const textMat = new THREE.MeshBasicMaterial({ map: texture });
  const text = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4), textMat);
  text.position.z = 0.06;
  group.add(text);

  gameBoards.shop = group;
  scene.add(group);
  return group;
}

window.onControllerGrip = (handedness) => {
  console.log(`Grip detected on ${handedness} hand`);
  // Trigger game interaction based on pointing direction
  if (window.onVRGameInteract) {
    window.onVRGameInteract(handedness);
  }
};

window.onControllerTrigger = (handedness) => {
  console.log(`Trigger pressed on ${handedness} hand`);
  // For future use - secondary interaction
};
