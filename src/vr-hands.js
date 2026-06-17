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

function createControllerModel(scene, handedness) {
  const geometry = new THREE.BoxGeometry(0.05, 0.15, 0.1);
  const material = new THREE.MeshStandardMaterial({
    color: handedness === 'left' ? 0xff0000 : 0x0000ff
  });
  const controller = new THREE.Mesh(geometry, material);

  // Add a visual indicator for the grip direction
  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.02, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  pointer.position.z = -0.06;
  controller.add(pointer);

  scene.add(controller);
  return controller;
}
