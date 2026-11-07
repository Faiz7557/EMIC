import * as THREE from "three";
import { copy } from "../data/copy";
import { ZONES, type SimEffect } from "../sim/types";
import { endpointXY, FLOOR_CELLS, FLOOR_TINTS, NODE_XY, traceKey, zoneAppearance, type RoomViewProps } from "../ui/denah-2d";
import { add, barrel, makeMats, rbox } from "./kit";
import { createPipeline, studioFloor, studioLights } from "./stage";

export const floorToThree = (x: number, y: number) => new THREE.Vector3(x - 5, 0, y - 2.5);
export function threeToFloor(point: THREE.Vector3): readonly [number, number] | null {
  const x = point.x + 5; const y = point.z + 2.5;
  const epsilon = 1e-7;
  return x < -epsilon || x > 10 + epsilon || y < -epsilon || y > 5 + epsilon ? null : [THREE.MathUtils.clamp(x, 0, 10), THREE.MathUtils.clamp(y, 0, 5)];
}

function groundTexture(zones: RoomViewProps["zones"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048; canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Floor texture unavailable");
  const draw = (states: RoomViewProps["zones"]) => {
    const k = canvas.width / 10;
    for (const [x, y, primary, , deltaDb] of FLOOR_CELLS) {
      const zone = states[ZONES[primary]];
      const left = (x - 0.125) * k; const top = (y - 0.125) * k; const size = 0.25 * k;
      context.fillStyle = zone.nodeStatus === "normal" && zone.tier === "normal" ? FLOOR_TINTS[primary] : zoneAppearance(zone).fill;
      context.fillRect(left, top, size + 0.5, size + 0.5);
      if (deltaDb < 3 || zone.nodeStatus === "luring") {
        context.save(); context.beginPath(); context.rect(left, top, size, size); context.clip();
        context.strokeStyle = "#899c9c"; context.lineWidth = 1.4;
        context.beginPath();
        for (let offset = -size; offset < size * 2; offset += 13) {
          context.moveTo(left + offset, top + size); context.lineTo(left + offset + size, top);
        }
        context.stroke(); context.restore();
      }
    }
    context.strokeStyle = "#7b9696"; context.lineWidth = 2;
    for (const x of [2.5, 5, 7.5]) { context.beginPath(); context.moveTo(x * k, 0); context.lineTo(x * k, canvas.height); context.stroke(); }
  };
  draw(zones);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { texture, update: (states: RoomViewProps["zones"]) => { draw(states); texture.needsUpdate = true; } };
}

/** Build geometry only. Zone state is supplied by the caller, never inferred here. */
export function createRoom(scene: THREE.Scene, zones: RoomViewProps["zones"]) {
  const ground = groundTexture(zones);
  const group = new THREE.Group(); scene.add(group);
  const mats = makeMats();
  add(group, rbox(10.12, 0.12, 5.12, 0.04), mats.white, 0, -0.07, 0);
  // Plane UV top maps to negative Z after rotation: (0,0) stays the back-left corner.
  const floor = add(group, new THREE.PlaneGeometry(10, 5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ground.texture, roughness: 0.9 }), 0, 0, 0);
  floor.castShadow = false;
  add(group, rbox(10.15, 3, 0.1), mats.white, 0, 1.5, -2.57);
  add(group, rbox(0.1, 3, 5.15), mats.white, -5.07, 1.5, 0);
  add(group, rbox(10.1, 0.09, 0.09), mats.steel, 0, 3, 0);

  const seat = rbox(0.45, 0.09, 0.43, 0.035);
  const back = rbox(0.45, 0.35, 0.07, 0.035);
  const leg = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  const leds: THREE.MeshStandardMaterial[] = [];
  const anchors: THREE.Vector3[] = [];
  ZONES.forEach((zone) => {
    const center = NODE_XY[zone][0] - 5;
    for (const z of [-1.5, 1.5]) for (let chair = 0; chair < 4; chair++) {
      const x = center - 0.75 + chair * 0.5;
      add(group, seat, mats.paintLight, x, 0.44, z);
      add(group, back, mats.paintLight, x, 0.65, z - 0.2);
      for (const dx of [-0.16, 0.16]) for (const dz of [-0.14, 0.14]) add(group, leg, mats.steel, x + dx, 0.2, z + dz);
    }
    // Node is drawn at twice its physical diameter/height, with its center at 2 m.
    add(group, new THREE.CylinderGeometry(0.008, 0.008, 0.966, 8), mats.steel, center, 2.517, 0);
    add(group, barrel(0.096, 0.068, 48).rotateZ(Math.PI / 2), mats.white, center, 2, 0);
    const led = new THREE.MeshStandardMaterial({ color: 0x1f8a8a, emissive: 0x1f8a8a, emissiveIntensity: 0.2, roughness: 0.5 });
    leds.push(led);
    const ring = add(group, new THREE.TorusGeometry(0.079, 0.008, 8, 48).rotateX(Math.PI / 2), led, center, 1.962, 0);
    ring.castShadow = false; anchors.push(new THREE.Vector3(center, 2.22, 0));
  });

  // Desk and mask stand are outside the raycastable 10 × 5 m floor.
  add(group, rbox(1.4, 0.1, 2.3, 0.035), mats.white, 6, 0.8, 0.4);
  for (const x of [5.5, 6.5]) for (const z of [-0.4, 1.2]) add(group, rbox(0.07, 0.75, 0.07), mats.steel, x, 0.375, z);
  add(group, rbox(0.48, 0.32, 0.08), mats.paintDark, 6, 1.03, -0.5);
  add(group, rbox(0.2, 0.035, 0.14), mats.paintDark, 6, 0.87, 1.2);
  add(group, rbox(0.52, 0.2, 0.35, 0.025), mats.paint, 6, 0.95, 0.4);
  add(group, rbox(0.32, 0.012, 0.22), mats.white, 6, 1.06, 0.4);
  add(group, new THREE.CylinderGeometry(0.15, 0.17, 0.3, 24), mats.rubber, 6, 0.15, 2);

  const boardCanvas = document.createElement("canvas"); boardCanvas.width = 1024; boardCanvas.height = 320;
  const context = boardCanvas.getContext("2d");
  if (!context) throw new Error("Board texture unavailable");
  context.fillStyle = "#14365e"; context.fillRect(0, 0, 1024, 320);
  context.fillStyle = "#c8f25a"; context.font = "600 34px sans-serif"; context.fillText(copy.board.label, 40, 65);
  context.fillStyle = "#ffffff"; context.font = "32px sans-serif";
  context.fillText(copy.board.title, 40, 135);
  context.font = "24px sans-serif";
  // Wrap the source copy without changing its wording.
  let line = ""; let baseline = 192;
  for (const word of copy.board.body.split(" ")) {
    if (context.measureText(`${line} ${word}`).width > 940) { context.fillText(line, 40, baseline); baseline += 36; line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  context.fillText(line, 40, baseline);
  const boardTexture = new THREE.CanvasTexture(boardCanvas); boardTexture.colorSpace = THREE.SRGBColorSpace;
  add(group, new THREE.PlaneGeometry(3.1, 0.97), new THREE.MeshBasicMaterial({ map: boardTexture }), 0, 2.15, -2.505);
  const clock = add(group, new THREE.CircleGeometry(0.22, 40), mats.paintLight, 3.85, 2.3, -2.505);
  clock.castShadow = false;
  add(group, rbox(0.015, 0.14, 0.01), mats.paintDark, 3.85, 2.35, -2.49);
  add(group, rbox(0.1, 0.015, 0.01), mats.paintDark, 3.89, 2.3, -2.49);
  return { group, anchors, leds, ground };
}

export type RoomStage = ReturnType<typeof createRoomStage>;
export function createRoomStage(canvas: HTMLCanvasElement, labels: HTMLElement, initial: RoomViewProps, options: {
  onReady: () => void; onError: () => void; onHoverEnd: () => void;
}) {
  const pipe = createPipeline(canvas, { fov: 26, onFirstFrame: options.onReady, onError: options.onError });
  let room: ReturnType<typeof createRoom>;
  try {
    studioLights(pipe.scene, 8); studioFloor(pipe.scene, 0xeee9e3);
    room = createRoom(pipe.scene, initial.zones);
  } catch (error) { pipe.dispose(); throw error; }
  let props = initial;
  let disposed = false;
  let signature = "";
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  let seenEffects = new Set(initial.effects.map(traceKey));
  let seenPackets = new Set(initial.packets.map(traceKey));
  const animations: { object: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; start: number; duration: number; from: THREE.Vector3; to?: THREE.Vector3 }[] = [];
  const clearAnimation = (index: number) => {
    const [{ object }] = animations.splice(index, 1); object.removeFromParent(); object.geometry.dispose(); object.material.dispose();
  };
  const onReduced = () => {
    reduced = media.matches;
    if (reduced) { for (let i = animations.length - 1; i >= 0; i--) clearAnimation(i); pipe.setMoving(false); pipe.invalidate(); }
  };
  media.addEventListener("change", onReduced);
  const orbit = { yaw: 0.22, pitch: 0.64, distance: 23 };
  const target = new THREE.Vector3(0.6, 0.65, 0);
  const projected = new THREE.Vector3();
  const place = () => {
    // Fit the same room on a narrower canvas without cropping either floor corner.
    const distance = orbit.distance * Math.max(1, 1.65 / pipe.camera.aspect);
    pipe.camera.position.set(target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * distance, target.y + Math.sin(orbit.pitch) * distance, target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * distance);
    pipe.camera.lookAt(target); pipe.camera.updateMatrixWorld();
    room.anchors.forEach((anchor, i) => {
      const label = labels.children.item(i) as HTMLElement | null;
      if (!label) return;
      projected.copy(anchor).project(pipe.camera);
      label.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * pipe.size.w}px,${(-projected.y * 0.5 + 0.5) * pipe.size.h}px,0) translate(-50%,-100%)`;
      label.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
    });
  };
  pipe.onTick(() => {
    place();
    const hadAnimations = animations.length > 0;
    const now = performance.now();
    for (let i = animations.length - 1; i >= 0; i--) {
      const animation = animations[i];
      const progress = Math.min(1, (now - animation.start) / animation.duration);
      if (progress >= 1) { clearAnimation(i); continue; }
      if (animation.to) animation.object.position.lerpVectors(animation.from, animation.to, progress);
      else { animation.object.scale.setScalar(0.12 + progress * 1.15); animation.object.material.opacity = 0.8 * (1 - progress); }
    }
    if (hadAnimations && !animations.length && !press) pipe.setMoving(false);
    return animations.length > 0;
  });
  const ripple = (effect: SimEffect) => {
    const points = effect.x !== undefined && effect.y !== undefined ? [[effect.x, effect.y]] : (effect.zones ?? []).map((zone) => NODE_XY[zone]);
    for (const [x, y] of points) {
      const from = floorToThree(x, y); from.y = 0.016;
      const object = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: effect.kind === "speech" ? 0x7d8088 : 0x1f8a8a, transparent: true, opacity: 0.8, depthWrite: false }));
      object.position.copy(from); object.scale.setScalar(0.12); pipe.scene.add(object);
      animations.push({ object, from, start: performance.now(), duration: 900 });
    }
  };
  const update = (next: RoomViewProps) => {
    if (disposed) return;
    props = next;
    const nextSignature = ZONES.map((zone) => `${next.zones[zone].tier}:${next.zones[zone].nodeStatus}:${next.zones[zone].rebuzzCount > 0}`).join("|");
    if (nextSignature !== signature) {
      signature = nextSignature; room.ground.update(next.zones);
      ZONES.forEach((zone, i) => {
        const state = next.zones[zone]; const color = zoneAppearance(state).color;
        room.leds[i].color.set(color); room.leds[i].emissive.set(color);
        room.leds[i].emissiveIntensity = state.nodeStatus !== "normal" ? 0 : state.tier === "normal" ? 0.15 : 0.8;
      });
      pipe.invalidate();
    }
    if (!next.effects.length && !next.packets.length) {
      if (animations.length) { for (let i = animations.length - 1; i >= 0; i--) clearAnimation(i); pipe.invalidate(); }
    }
    if (!reduced) {
      for (const effect of next.effects) if (!seenEffects.has(traceKey(effect)) && effect.kind !== "buzz") ripple(effect);
      for (const packet of next.packets) if (!seenPackets.has(traceKey(packet))) {
        const from = floorToThree(...endpointXY(packet.from)); const to = floorToThree(...endpointXY(packet.to));
        from.y = packet.from === "PAGER" || packet.from === "DASBOR" ? 1 : 2;
        to.y = packet.to === "PAGER" || packet.to === "DASBOR" ? 1 : 2;
        const object = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: packet.kind === "ALERT" ? 0x855a00 : 0x14365e }));
        object.position.copy(from); pipe.scene.add(object); animations.push({ object, from, to, start: performance.now(), duration: 500 });
      }
    }
    seenEffects = new Set(next.effects.map(traceKey)); seenPackets = new Set(next.packets.map(traceKey));
    if (animations.length) { pipe.setMoving(true); pipe.invalidate(); }
  };
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const floorPoint = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), pipe.camera);
    return raycaster.ray.intersectPlane(plane, hit) ? threeToFloor(hit) : null;
  };
  let press: { id: number; x: number; y: number; yaw: number; pitch: number; dragged: boolean; onFloor: boolean } | null = null;
  const down = (event: PointerEvent) => {
    if (press) { press.dragged = true; return; }
    if (!event.isPrimary || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: orbit.yaw, pitch: orbit.pitch, dragged: false, onFloor: floorPoint(event) !== null };
    canvas.setPointerCapture(event.pointerId); options.onHoverEnd();
  };
  const move = (event: PointerEvent) => {
    if (press) {
      if (event.pointerId !== press.id) return;
      const dx = event.clientX - press.x; const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 5) press.dragged = true;
      if (press.dragged) {
        orbit.yaw = THREE.MathUtils.clamp(press.yaw - dx * 0.003, -0.32, 0.55);
        orbit.pitch = THREE.MathUtils.clamp(press.pitch + dy * 0.003, 0.48, 1.1);
        place(); pipe.setMoving(true); pipe.invalidate(); canvas.style.cursor = "grabbing";
      }
      return;
    }
    const point = floorPoint(event);
    canvas.style.cursor = point ? "crosshair" : "grab";
    if (point) props.onFloorHover(...point); else options.onHoverEnd();
  };
  const cancel = () => { press = null; canvas.style.cursor = "grab"; pipe.setMoving(false); options.onHoverEnd(); };
  const up = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    const start = press; press = null;
    const point = floorPoint(event);
    if (start.onFloor && !start.dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5 && point) props.onFloorClick(...point);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = "grab"; pipe.setMoving(false);
  };
  const leave = () => { options.onHoverEnd(); };
  const lostContext = (event: Event) => { event.preventDefault(); options.onError(); };
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel); canvas.addEventListener("lostpointercapture", cancel); canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("webglcontextlost", lostContext);
  canvas.style.cursor = "grab";
  place(); update(initial);
  return {
    pipe, update,
    resetCamera: () => { orbit.yaw = 0.22; orbit.pitch = 0.64; place(); pipe.invalidate(); },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel); canvas.removeEventListener("lostpointercapture", cancel); canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", lostContext); media.removeEventListener("change", onReduced);
      if (press && canvas.hasPointerCapture(press.id)) canvas.releasePointerCapture(press.id);
      for (let i = animations.length - 1; i >= 0; i--) clearAnimation(i);
      pipe.dispose();
    },
  };
}
