let vrSession = null;
let controllers = { left: null, right: null };
let controllerModels = { left: null, right: null };

async function initVRHands(session, xrFrame) {
  vrSession = session;

  // Request input sources for controllers
  const inputSources = session.inputSources;

  inputSources.forEach((source, index) => {
    if (source.handedness === 'left') {
      controllers.left = source;
    } else if (source.handedness === 'right') {
      controllers.right = source;
    }
  });

  console.log('VR hands initialized');
}

function updateControllers(xrFrame, refSpace) {
  if (!vrSession || !xrFrame) return;

  vrSession.inputSources.forEach((source) => {
    const grip = xrFrame.getPose(source.gripSpace, refSpace);

    if (!grip) return;

    const handedness = source.handedness;
    const pose = grip.transform;

    // Update controller position and rotation
    if (window.onControllerUpdate) {
      window.onControllerUpdate({
        handedness,
        position: {
          x: pose.position.x,
          y: pose.position.y,
          z: pose.position.z
        },
        quaternion: {
          x: pose.orientation.x,
          y: pose.orientation.y,
          z: pose.orientation.z,
          w: pose.orientation.w
        }
      });
    }

    // Check for squeeze (grip) input
    if (source.gamepad) {
      const buttons = source.gamepad.buttons;

      // Squeeze button (index 0 is typically grip)
      if (buttons[0] && buttons[0].pressed) {
        if (window.onControllerGrip) {
          window.onControllerGrip(handedness);
        }
      }

      // Trigger button (index 1)
      if (buttons[1] && buttons[1].pressed) {
        if (window.onControllerTrigger) {
          window.onControllerTrigger(handedness);
        }
      }
    }
  });
}

// Robot hand that replaces the controller model.
// Matches the RobotExpressive aesthetic: dark gunmetal + cyan/magenta joint glow.
// Oriented so fingers point in -Z (forward), palm faces -Y (down in grip pose).
function makeControllerModel(handedness) {
  const g = new THREE.Group();
  const left = handedness === 'left';
  const sign = left ? -1 : 1;

  const metal  = new THREE.MeshStandardMaterial({ color: 0x252830, roughness: 0.35, metalness: 0.85 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.5,  metalness: 0.7  });
  const accentCol = left ? 0x33ccff : 0xff44aa;
  const joint  = new THREE.MeshStandardMaterial({ color: accentCol, emissive: accentCol, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.6 });

  // ── wrist cylinder ──
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.055, 16), metal);
  wrist.rotation.x = Math.PI / 2;
  wrist.position.set(0, 0, 0.028);
  wrist.castShadow = true; g.add(wrist);

  // wrist glow ring
  const wRing = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 8, 24), joint);
  wRing.rotation.x = Math.PI / 2; wRing.position.set(0, 0, 0.008); g.add(wRing);

  // ── palm (flattened box) ──
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.022, 0.075), metal);
  palm.position.set(0, 0, -0.038);
  palm.castShadow = true; g.add(palm);

  // palm edge detail strips
  [-1, 1].forEach(s => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.024, 0.065), dark);
    strip.position.set(s * 0.038, 0, -0.038); g.add(strip);
  });

  // ── knuckle row ──
  for (let f = 0; f < 4; f++) {
    const fx = -0.027 + f * 0.018;
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), joint);
    knuckle.position.set(fx, 0.013, -0.072); g.add(knuckle);
  }

  // ── four fingers ──
  const fingerDefs = [
    { x: -0.027, len: 0.052, bend: 0.18 },  // index
    { x: -0.009, len: 0.058, bend: 0.14 },  // middle
    { x:  0.009, len: 0.054, bend: 0.16 },  // ring
    { x:  0.027, len: 0.044, bend: 0.22 },  // pinky
  ];
  fingerDefs.forEach(({ x, len, bend }) => {
    const seg = new THREE.Group();
    seg.position.set(x, 0.012, -0.076);
    seg.rotation.x = -bend;

    const prox = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, len * 0.52, 8), metal);
    prox.position.y = len * 0.26; prox.castShadow = true; seg.add(prox);

    const mid = new THREE.Group(); mid.position.y = len * 0.54; mid.rotation.x = -bend * 0.8;
    const midPhal = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, len * 0.32, 8), metal);
    midPhal.position.y = len * 0.16; midPhal.castShadow = true; mid.add(midPhal);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.004, len * 0.2, 8), dark);
    tip.position.y = len * 0.42; mid.add(tip);
    seg.add(mid);

    // joint dot
    const jd = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 6, 5), joint);
    jd.position.y = len * 0.52; seg.add(jd);

    g.add(seg);
  });

  // ── thumb ──
  const thumb = new THREE.Group();
  thumb.position.set(sign * 0.038, 0.006, -0.025);
  thumb.rotation.set(0.2, sign * -0.7, sign * 0.4);
  const tProx = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.034, 8), metal);
  tProx.position.y = 0.017; tProx.castShadow = true; thumb.add(tProx);
  const tTip  = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.024, 8), dark);
  tTip.position.y  = 0.043; thumb.add(tTip);
  const tJoint = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), joint);
  tJoint.position.y = 0.034; thumb.add(tJoint);
  g.add(thumb);

  g.name = 'controllerModel';
  return g;
}
window.makeControllerModel = makeControllerModel;

// kept for back-compat (older callers); now delegates to the detailed model
function createControllerModel(scene, handedness) {
  const m = makeControllerModel(handedness);
  if (scene) scene.add(m);
  return m;
}
