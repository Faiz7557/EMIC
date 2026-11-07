/** Studio pipeline adapted from the local reference, with no idle animation loop. */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Pipeline = ReturnType<typeof createPipeline>;

/** Dispose shared geometries, materials and textures once, including light shadows. */
export function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
    if (object instanceof THREE.Light && "shadow" in object) (object.shadow as THREE.LightShadow).dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  scene.clear();
}

export function createPipeline(canvas: HTMLCanvasElement, opt: {
  fov?: number; exposure?: number; ao?: { radius: number; scale: number } | false;
  onFirstFrame?: () => void; onError?: () => void;
} = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opt.fov ?? 26, 1, 0.2, 200);
  const size = { w: 1, h: 1 };
  let composer: EffectComposer | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  let target: THREE.WebGLRenderTarget | undefined;
  let gtao: GTAOPass | undefined;
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opt.exposure ?? 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try { environment = pm.fromScene(room, 0.03); scene.environment = environment.texture; }
    finally { room.dispose(); pm.dispose(); }
    target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    if (opt.ao !== false) {
      gtao = new GTAOPass(scene, camera, 4, 4);
      gtao.blendIntensity = 1;
      gtao.updateGtaoMaterial({ radius: opt.ao?.radius ?? 0.28, distanceExponent: 1.4, thickness: 1.2, scale: opt.ao?.scale ?? 1.25, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1.5, rings: 2, samples: 12 });
      composer.addPass(gtao);
    }
    composer.addPass(new OutputPass());
  } catch (error) {
    composer?.passes.forEach((pass) => pass.dispose());
    composer?.dispose(); target?.dispose(); environment?.dispose(); renderer.dispose();
    throw error;
  }
  const readyComposer = composer;
  let disposed = false;
  let dirty = true;
  let raf = 0;
  let last = 0;
  let visible = true;
  let first = true;
  let ms = 0;
  let settle = 0;
  let moving = false;
  const ticks = new Set<(dt: number) => boolean | void>();

  const invalidate = () => {
    if (disposed) return;
    dirty = true;
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };
  function frame(time: number) {
    raf = 0;
    if (disposed || !visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    let active = false;
    try {
      for (const tick of ticks) if (tick(dt)) active = true;
      if (dirty || active) {
        dirty = false;
        const start = performance.now();
        readyComposer.render();
        ms = performance.now() - start;
        if (first) { first = false; opt.onFirstFrame?.(); }
      }
    } catch {
      dispose();
      opt.onError?.();
      return;
    }
    if (active || dirty) invalidate();
    else last = 0;
  }
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    if (disposed || bounds.width < 2 || bounds.height < 2) return;
    size.w = bounds.width; size.h = bounds.height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(size.w, size.h, false);
    readyComposer.setPixelRatio(renderer.getPixelRatio());
    readyComposer.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { last = 0; invalidate(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  const visibility = () => {
    last = 0;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else invalidate();
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(settle);
    ro.disconnect(); io.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    ticks.clear();
    disposeScene(scene);
    readyComposer.passes.forEach((pass) => pass.dispose());
    readyComposer.dispose(); environment?.dispose();
    renderer.renderLists.dispose(); renderer.dispose();
  }
  ro.observe(canvas); io.observe(canvas);
  document.addEventListener("visibilitychange", visibility);
  resize();
  return {
    renderer, scene, camera, size, invalidate, dispose,
    render: invalidate,
    onTick: (tick: (dt: number) => boolean | void) => { ticks.add(tick); return () => { ticks.delete(tick); }; },
    setMoving: (nextMoving: boolean) => {
      if (disposed || !gtao || nextMoving === moving) return;
      moving = nextMoving;
      window.clearTimeout(settle);
      if (moving) { gtao.enabled = false; invalidate(); }
      else settle = window.setTimeout(() => { if (!disposed && gtao) { gtao.enabled = true; invalidate(); } }, 140);
    },
    updateShadows: () => { renderer.shadowMap.needsUpdate = true; invalidate(); },
    msLast: () => ms,
  };
}

export function studioLights(scene: THREE.Scene, reach: number, center = new THREE.Vector3()) {
  const key = new THREE.DirectionalLight(0xfff3e4, 2.3);
  key.position.set(center.x + reach * 0.55, center.y + reach * 1.25, center.z + reach * 0.75);
  key.target.position.copy(center); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const s = reach * 1.05;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: reach * 4 });
  key.shadow.radius = 4; key.shadow.bias = -0.00025; key.shadow.normalBias = 0.012;
  const rim = new THREE.DirectionalLight(0xcfe2ff, 0.75);
  rim.position.set(center.x - reach, center.y + reach * 0.6, center.z - reach);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(center.x - reach * 0.7, center.y + reach * 0.3, center.z + reach);
  scene.add(key, key.target, rim, fill);
}

export function studioFloor(scene: THREE.Scene, color: number) {
  scene.background = new THREE.Color(color); scene.fog = new THREE.Fog(color, 22, 60);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, envMapIntensity: 0.55 }));
  floor.position.y = -0.14; floor.receiveShadow = true; scene.add(floor);
  return floor;
}
