/** Shared render pipeline: studio lighting, soft shadows, ambient occlusion, render on demand. */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Pipeline = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  size: { w: number; h: number };
  render: () => void;
  invalidate: () => void;
  /** Drop ambient occlusion while something moves; bring it back when still. */
  setMoving: (moving: boolean) => void;
  /** Shadows are baked once and redrawn only on request. */
  updateShadows: () => void;
  msLast: () => number;
  onTick: (fn: (dt: number) => boolean | void) => void;
  dispose: () => void;
};

export function createPipeline(canvas: HTMLCanvasElement, opt: { fov?: number; exposure?: number; ao?: { radius: number; scale: number } | false; onFirstFrame?: () => void } = {}): Pipeline {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opt.exposure ?? 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  pm.dispose();

  const camera = new THREE.PerspectiveCamera(opt.fov ?? 26, 1, 0.2, 200);
  const size = { w: 1, h: 1 };

  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const useAo = opt.ao !== false;
  const aoCfg = opt.ao === false ? null : opt.ao;
  const gtao = useAo ? new GTAOPass(scene, camera, 4, 4) : null;
  if (gtao) {
    gtao.blendIntensity = 1;
    gtao.updateGtaoMaterial({ radius: aoCfg?.radius ?? 0.28, distanceExponent: 1.4, thickness: 1.2, scale: aoCfg?.scale ?? 1.25, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1.5, rings: 2, samples: 12 });
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());

  let dirty = true;
  let raf = 0;
  let last = 0;
  let visible = true;
  let first = true;
  let ms = 0;
  let settle = 0;
  const ticks: ((dt: number) => boolean | void)[] = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    size.w = r.width;
    size.h = r.height;
    renderer.setSize(r.width, r.height, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) dirty = true;
  });
  io.observe(canvas);
  resize();

  const loop = (t: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (!visible || document.hidden) return;
    for (const f of ticks) if (f(dt)) dirty = true;
    if (dirty) {
      dirty = false;
      const t0 = performance.now();
      composer.render();
      ms = performance.now() - t0;
      if (first) {
        first = false;
        opt.onFirstFrame?.();
      }
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer,
    scene,
    camera,
    size,
    render: () => composer.render(),
    invalidate: () => {
      dirty = true;
    },
    onTick: (fn) => ticks.push(fn),
    setMoving: (moving) => {
      if (!gtao) return;
      window.clearTimeout(settle);
      if (moving) {
        gtao.enabled = false;
        return;
      }
      settle = window.setTimeout(() => {
        gtao.enabled = true;
        dirty = true;
      }, 140);
    },
    updateShadows: () => {
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
    },
    msLast: () => ms,
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      composer.dispose();
      window.clearTimeout(settle);
      gtao?.dispose();
      target.dispose();
      scene.environment?.dispose();
      renderer.dispose();
    },
  };
}

/** Key, fill and rim for a studio look, with a shadow frustum sized to the subject. */
export function studioLights(scene: THREE.Scene, reach: number, center: THREE.Vector3 = new THREE.Vector3()) {
  const key = new THREE.DirectionalLight(0xfff3e4, 2.3);
  key.position.set(center.x + reach * 0.55, center.y + reach * 1.25, center.z + reach * 0.75);
  key.target.position.copy(center);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const s = reach * 1.05;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: reach * 4 });
  key.shadow.radius = 4;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.012;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xcfe2ff, 0.75);
  rim.position.set(center.x - reach, center.y + reach * 0.6, center.z - reach);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(center.x - reach * 0.7, center.y + reach * 0.3, center.z + reach);
  scene.add(fill);
}

/** A seamless photo sweep: the floor fades into the backdrop colour. */
export function studioFloor(scene: THREE.Scene, color: number) {
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.Fog(color, 22, 44);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, envMapIntensity: 0.55 }));
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}
