# Models (Blender → glTF)

Drop exported `.glb` files here and load them at runtime with `src/model-loader.js`.

## Export from Blender
1. Select the object(s) you want.
2. **File → Export → glTF 2.0 (.glb/.gltf)**.
3. Format: **glTF Binary (.glb)** (single file, easiest to host).
4. Include → **Selected Objects**; Transform → **+Y Up** (matches Three.js).
5. Leave **Compression** OFF unless you also load a Draco decoder (see model-loader.js).
6. Save into this folder, e.g. `client/models/poker-table.glb`.

Scale in Blender is meters → Three.js units (1 Blender meter = 1 unit here).

## Load it
```js
// one-off, positioned in the world:
loadModelInto('models/poker-table.glb', scene, {
  position: { x: -12, y: 0, z: -18 }, rotationY: 0, scale: 1, castShadow: true
});

// or register keys once, then load by name:
registerModels({ 'poker-table': 'models/poker-table.glb', 'chip': 'models/chip.glb' });
const chip = await loadModelKey('chip', { scale: 0.05 });

// drop-in replace a procedural build (keeps procedural if the file is missing):
swapForModel(pokerTableGroup, 'models/poker-table.glb', { scale: 1 });
```

`swapForModel` hides the procedural meshes in the group but leaves anything tagged
`userData.keepVisible = true` (VR control panels) and lights intact.

## Animations
If the Blender model has actions, play the first (or a named) clip:
```js
const m = await loadModelInto('models/wheel.glb', scene);
playModelAnimation(m, 'Spin'); // auto-updated every frame
```
