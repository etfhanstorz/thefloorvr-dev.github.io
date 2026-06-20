// Blender / glTF model loader.
//
// Workflow: model it in Blender -> File > Export > glTF 2.0 (.glb, "Include > Selected
// Objects", +Y up) -> drop the .glb in client/models/ -> load it by URL or registry key.
// GLB files are static assets, so they serve fine from GitHub Pages.
//
// API (all on window):
//   loadModel(url, opts)            -> Promise<THREE.Group|null>   (a fresh clone)
//   loadModelInto(url, parent, opts)-> Promise<THREE.Group|null>   (clone added to parent)
//   swapForModel(group, url, opts)  -> Promise<THREE.Group|null>   (replace a procedural build)
//   registerModels({key:url,...});  loadModelKey(key, opts)
//   playModelAnimation(root, name)  -> AnimationMixer|null   (auto-driven each frame)
//   preloadModel(url)               -> Promise<gltf>         (warm the cache)
//
// opts: { scale:number|{x,y,z}, position:{x,y,z}, rotationY:number, castShadow:bool }

(function () {
  if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
    console.warn('[models] THREE.GLTFLoader not available — model loading disabled.');
    window.loadModel = window.loadModelInto = window.loadModelKey = () => Promise.resolve(null);
    window.swapForModel = () => Promise.resolve(null);
    window.registerModels = () => {};
    window.playModelAnimation = () => null;
    window.preloadModel = () => Promise.resolve(null);
    return;
  }

  const loader = new THREE.GLTFLoader();
  // Optional Draco support (only if the decoder script is also loaded). Blender's
  // "Compression" export option needs this; uncompressed .glb works without it.
  if (THREE.DRACOLoader) {
    try {
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(draco);
    } catch (e) { /* ignore */ }
  }

  const cache = new Map(); // url -> Promise<gltf>
  function preloadModel(url) {
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    cache.set(url, p);
    return p;
  }

  function applyOpts(root, opts) {
    opts = opts || {};
    if (opts.scale != null) {
      const s = opts.scale;
      if (typeof s === 'number') root.scale.set(s, s, s);
      else root.scale.set(s.x != null ? s.x : 1, s.y != null ? s.y : 1, s.z != null ? s.z : 1);
    }
    if (opts.position) root.position.set(opts.position.x || 0, opts.position.y || 0, opts.position.z || 0);
    if (opts.rotationY != null) root.rotation.y = opts.rotationY;
    if (opts.castShadow) root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // Load (and cache) a model, returning a fresh clone so it can be used many times.
  // Static props clone cleanly; rigged/skinned characters need SkeletonUtils (loaded
  // separately) — if THREE_SkeletonUtils is present we use it automatically.
  async function loadModel(url, opts) {
    try {
      const gltf = await preloadModel(url);
      // SkeletonUtils.clone preserves skinning/bones for rigged models; plain clone is fine for static props
      const SU = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils : (window.THREE_SkeletonUtils || null);
      const root = (SU && SU.clone) ? SU.clone(gltf.scene) : gltf.scene.clone(true);
      root.userData.gltf = gltf; // keep animations/cameras reachable
      applyOpts(root, opts);
      return root;
    } catch (e) {
      console.warn('[models] failed to load ' + url, e && e.message ? e.message : e);
      return null;
    }
  }

  async function loadModelInto(url, parent, opts) {
    const m = await loadModel(url, opts);
    if (m && parent) parent.add(m);
    return m;
  }

  // Drop-in replacement for a procedural build: if the .glb loads, hide the procedural
  // meshes in `group` and add the model; if the file is missing, keep the procedural
  // version untouched. Children flagged userData.keepVisible (e.g. VR panels, lights)
  // are left alone.
  async function swapForModel(group, url, opts) {
    const m = await loadModel(url, opts);
    if (!m || !group) return null;
    group.children.slice().forEach((ch) => {
      if (ch === m) return;
      if (ch.userData && ch.userData.keepVisible) return;
      if (ch.isLight) return;
      ch.visible = false;
    });
    group.add(m);
    return m;
  }

  function playModelAnimation(root, clipName) {
    const gltf = root && root.userData && root.userData.gltf;
    if (!gltf || !gltf.animations || !gltf.animations.length) return null;
    const mixer = new THREE.AnimationMixer(root);
    const clip = clipName ? THREE.AnimationClip.findByName(gltf.animations, clipName) : gltf.animations[0];
    if (!clip) return null;
    mixer.clipAction(clip).play();
    (window.sceneUpdaters = window.sceneUpdaters || []).push((t, dt) => mixer.update(dt || 0));
    return mixer;
  }

  // Optional name->url registry so gameplay code can refer to models by key.
  window.MODELS = window.MODELS || {};
  function registerModels(map) { Object.assign(window.MODELS, map || {}); }
  function loadModelKey(key, opts) {
    const url = window.MODELS[key];
    if (!url) { console.warn('[models] unknown model key: ' + key); return Promise.resolve(null); }
    return loadModel(url, opts);
  }

  window.loadModel = loadModel;
  window.loadModelInto = loadModelInto;
  window.swapForModel = swapForModel;
  window.loadModelKey = loadModelKey;
  window.registerModels = registerModels;
  window.playModelAnimation = playModelAnimation;
  window.preloadModel = preloadModel;

  console.log('[models] loader ready (GLTF' + (THREE.DRACOLoader ? ' + Draco' : '') + ')');
})();
