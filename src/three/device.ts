import * as THREE from "three";
import { add, makeMats, rbox } from "./kit";
import { createPipeline, studioFloor, studioLights } from "./stage";

export type DeviceKind = "simpul" | "pager";
export type DevicePartId = "cover" | "led" | "inmp441" | "esp32-s3" | "rear" | "pager-board" | "battery" | "pager-case";
export interface DeviceView { kind: DeviceKind; open: boolean }

/** Geometry is in metres. Both models share a 30× display scale. */
export function createDevice(scene: THREE.Scene) {
  const mats = makeMats();
  const node = new THREE.Group();
  const pager = new THREE.Group();
  node.scale.setScalar(30); pager.scale.setScalar(30);
  scene.add(node, pager);
  const pcb = new THREE.MeshStandardMaterial({ color: 0x14365e, roughness: 0.65 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f8a8a, emissive: 0x1f8a8a, emissiveIntensity: 0.25, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x253343, roughness: 0.8 });
  const diffuser = new THREE.MeshStandardMaterial({ color: 0xcfe9e2, roughness: 0.45 });
  const layers = Array.from({ length: 5 }, () => new THREE.Group());
  layers.forEach((layer) => node.add(layer));
  const [cover, ring, microphone, board, rear] = layers;
  const disc = (parent: THREE.Object3D, radius: number, height: number, material: THREE.Material, x = 0, y = 0, z = 0) =>
    add(parent, new THREE.CylinderGeometry(radius, radius, height, 64), material, x, y, z);
  const annulus = (parent: THREE.Object3D, inner: number, outer: number, height: number, material: THREE.Material, y = 0) => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, -height / 2, 0);
    return add(parent, geometry, material, 0, y);
  };

  // Front cover: diffuser, central button and acoustic openings.
  disc(cover, 0.048, 0.007, mats.white);
  annulus(cover, 0.034, 0.040, 0.001, diffuser, 0.0038);
  disc(cover, 0.011, 0.002, mats.paint, 0, 0.0045);
  for (let i = 0; i < 3; i++) disc(cover, 0.0009, 0.0003, dark, 0.024 + i * 0.003, 0.0037, 0.018);
  // A separate PCB annulus carrying exactly twelve LED packages.
  annulus(ring, 0.032, 0.043, 0.002, pcb);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const led = add(ring, rbox(0.004, 0.0015, 0.004, 0.0003), teal, Math.cos(angle) * 0.0375, 0.0016, Math.sin(angle) * 0.0375);
    led.rotation.y = -angle;
  }
  add(microphone, rbox(0.015, 0.0015, 0.011, 0.0005), mats.paint);
  disc(microphone, 0.0025, 0.001, mats.steel, 0, 0.0012);
  disc(microphone, 0.0008, 0.0002, dark, 0, 0.0018);
  for (let i = 0; i < 4; i++) disc(microphone, 0.0007, 0.0004, mats.steel, -0.005 + i * 0.0033, 0.001, 0.004);
  add(board, rbox(0.063, 0.002, 0.026, 0.001), pcb);
  add(board, rbox(0.023, 0.002, 0.018, 0.0005), mats.steel, -0.006, 0.002);
  add(board, rbox(0.012, 0.001, 0.018, 0.0003), mats.rubber, 0.023, 0.0015);
  for (const z of [-0.011, 0.011]) for (let i = 0; i < 16; i++) {
    add(board, rbox(0.001, 0.003, 0.001, 0.0001), mats.steel, -0.027 + i * 0.0034, 0.002, z);
  }
  add(board, rbox(0.006, 0.003, 0.007, 0.0007), mats.steel, -0.031, 0.001);
  disc(rear, 0.048, 0.003, mats.white, 0, -0.0025);
  annulus(rear, 0.045, 0.048, 0.008, mats.white, 0.001);
  add(rear, rbox(0.018, 0.001, 0.004, 0.001), mats.paintLight, 0, -0.0005, -0.022);
  add(rear, rbox(0.006, 0.003, 0.004, 0.0006), dark, -0.045, 0.001);
  for (const x of [-0.028, 0.028]) disc(rear, 0.002, 0.004, mats.paintLight, x, 0, 0.018);

  // Pager enclosure: 70 × 44 × 18 mm, four zone LEDs and one large button.
  add(pager, rbox(0.070, 0.044, 0.018, 0.005), mats.paintDark, 0, 0.024);
  add(pager, rbox(0.036, 0.025, 0.003, 0.002), mats.paintDark, 0, 0.029, -0.0105);
  add(pager, rbox(0.008, 0.003, 0.001, 0.0005), mats.steel, 0, 0.004, 0.0091);
  const zoneLabels = ["A", "B", "C", "D"];
  zoneLabels.forEach((zone, index) => {
    const x = -0.024 + index * 0.016;
    const led = disc(pager, 0.003, 0.001, teal, x, 0.036, 0.0095); led.rotation.x = Math.PI / 2;
    // Text belongs to scene-owned textures and is released by disposeScene.
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#ffffff"; context.font = "600 44px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(zone, 32, 32);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      add(pager, new THREE.PlaneGeometry(0.006, 0.006), material, x, 0.026, 0.0091);
    }
  });
  add(pager, rbox(0.035, 0.008, 0.002, 0.003), mats.paint, 0, 0.012, 0.010);
  const anchors = {
    simpul: layers.map((layer, index) => ({ id: (["cover", "led", "inmp441", "esp32-s3", "rear"] as const)[index], object: layer, point: new THREE.Vector3(index === 2 ? 0.010 : index === 3 ? 0.034 : 0.050, 0.003, 0.004) })),
    pager: [
      { id: "pager-board", object: pager, point: new THREE.Vector3(0.033, 0.036, 0.011) },
      { id: "battery", object: pager, point: new THREE.Vector3(-0.033, 0.021, 0.011) },
      { id: "pager-case", object: pager, point: new THREE.Vector3(0.033, 0.009, 0.011) },
    ],
  } satisfies Record<DeviceKind, { id: DevicePartId; object: THREE.Object3D; point: THREE.Vector3 }[]>;
  const closedY = [0.0285, 0.022, 0.017, 0.011, 0.004];
  const separation = [0.09, 0.066, 0.044, 0.022, 0];
  const arrange = (amount: number) => layers.forEach((layer, index) => { layer.position.y = closedY[index] + separation[index] * amount; });
  arrange(0);
  return { node, pager, anchors, arrange };
}

export type DeviceStageHandle = ReturnType<typeof createDeviceStage>;

export function createDeviceStage(canvas: HTMLCanvasElement, labels: HTMLDivElement, initial: DeviceView, options: { onReady: () => void; onError: () => void }) {
  const pipe = createPipeline(canvas, { fov: 26, onFirstFrame: options.onReady, onError: options.onError });
  let model: ReturnType<typeof createDevice>;
  try { studioLights(pipe.scene, 4); studioFloor(pipe.scene, 0xeee9e3); model = createDevice(pipe.scene); }
  catch (error) { pipe.dispose(); throw error; }
  let view = initial;
  let disposed = false;
  let amount = initial.open ? 1 : 0;
  let from = amount;
  let target = amount;
  let elapsed = 0.6;
  let yaw = 0.27;
  let pitch = 0.48;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  const projected = new THREE.Vector3();
  const place = () => {
    const center = new THREE.Vector3(0, view.kind === "simpul" ? 0.55 + 1.3 * amount : 0.75, 0);
    const distance = (view.kind === "simpul" ? 8.5 + 4 * amount : 7.8) * Math.max(1, 0.95 / pipe.camera.aspect);
    pipe.camera.position.set(center.x + Math.sin(yaw) * Math.cos(pitch) * distance, center.y + Math.sin(pitch) * distance, center.z + Math.cos(yaw) * Math.cos(pitch) * distance);
    pipe.camera.lookAt(center); pipe.camera.updateMatrixWorld(); pipe.scene.updateMatrixWorld(true);
    const anchors = model.anchors[view.kind];
    for (const child of Array.from(labels.children)) {
      const element = child as HTMLElement;
      const anchor = anchors.find((entry) => entry.id === element.dataset.part);
      if (!anchor) { element.hidden = true; continue; }
      projected.copy(anchor.point); anchor.object.localToWorld(projected); projected.project(pipe.camera);
      element.hidden = (view.kind === "simpul" && !view.open && anchor.id !== "cover") || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.92 || Math.abs(projected.y) > 0.92;
      element.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * pipe.size.w}px,${(-projected.y * 0.5 + 0.5) * pipe.size.h}px,0) translate(-50%,-50%)`;
    }
  };
  const moving = () => { pipe.setMoving(elapsed < 0.6 || press !== null); };
  pipe.onTick((dt) => {
    const animating = elapsed < 0.6;
    if (animating) {
      elapsed = Math.min(0.6, elapsed + dt);
      const progress = elapsed / 0.6;
      // CSS --ease-out-expo (0.16, 1, 0.3, 1), evaluated as a cubic Bézier.
      let lo = 0, hi = 1;
      for (let i = 0; i < 16; i++) {
        const t = (lo + hi) / 2;
        const x = 3 * (1 - t) ** 2 * t * 0.16 + 3 * (1 - t) * t ** 2 * 0.3 + t ** 3;
        if (x < progress) lo = t; else hi = t;
      }
      const t = (lo + hi) / 2;
      amount = progress === 1 ? target : from + (target - from) * (1 - (1 - t) ** 3);
      model.arrange(amount); pipe.renderer.shadowMap.needsUpdate = true; moving();
    }
    place();
    return animating;
  });
  const update = (next: DeviceView) => {
    if (disposed) return;
    const changedKind = view.kind !== next.kind;
    view = next;
    model.node.visible = view.kind === "simpul"; model.pager.visible = view.kind === "pager";
    const nextTarget = view.kind === "simpul" && view.open ? 1 : 0;
    if (changedKind) { yaw = view.kind === "simpul" ? 0.27 : 0.15; pitch = view.kind === "simpul" ? 0.48 : 0.18; }
    if (nextTarget !== target || changedKind) {
      from = amount; target = nextTarget; elapsed = reduced || changedKind ? 0.6 : 0;
      if (elapsed === 0.6) { amount = target; model.arrange(amount); }
    }
    moving(); place(); pipe.updateShadows();
  };
  const onReduced = () => {
    reduced = media.matches;
    if (reduced) { amount = target; elapsed = 0.6; model.arrange(amount); moving(); place(); pipe.updateShadows(); }
  };
  let press: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
  const down = (event: PointerEvent) => {
    if (press || !event.isPrimary || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = "grabbing"; moving();
  };
  const move = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    yaw = THREE.MathUtils.clamp(press.yaw - (event.clientX - press.x) * 0.004, -0.65, 0.65);
    pitch = THREE.MathUtils.clamp(press.pitch + (event.clientY - press.y) * 0.003, 0.12, 0.85);
    place(); pipe.invalidate();
  };
  const cancel = () => {
    const id = press?.id; press = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    canvas.style.cursor = "grab"; moving();
  };
  const up = (event: PointerEvent) => { if (press?.id === event.pointerId) cancel(); };
  const lostContext = (event: Event) => { event.preventDefault(); options.onError(); };
  media.addEventListener("change", onReduced);
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up); canvas.addEventListener("lostpointercapture", cancel); canvas.addEventListener("webglcontextlost", lostContext);
  canvas.style.cursor = "grab";
  update(initial);
  return {
    update,
    resetCamera: () => { yaw = view.kind === "simpul" ? 0.27 : 0.15; pitch = view.kind === "simpul" ? 0.48 : 0.18; place(); pipe.invalidate(); },
    dispose: () => {
      if (disposed) return;
      disposed = true; cancel();
      media.removeEventListener("change", onReduced);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("lostpointercapture", cancel); canvas.removeEventListener("webglcontextlost", lostContext);
      pipe.dispose();
    },
  };
}
